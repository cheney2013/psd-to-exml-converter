#!/usr/bin/env python3
"""
Simple Flask server that accepts a POST /ocr with JSON { dataUrl, langs }
and returns { text: "...recognized text..." } using PaddleOCR.

NOTE:
- PaddleOCR requires paddlepaddle; installing on CPU may require platform-specific wheels.
- This script is intended for local use. For production, secure and harden as needed.
"""
from flask import Flask, request, jsonify, Response
import json
from io import BytesIO
import base64
from PIL import Image
import os
import numpy as np
import cv2
import threading

# Global lock to serialize calls into the PaddleOCR native runtime. Some
# paddle/paddleocr native backends are not thread-safe on Windows and can
# crash when predict/ocr is called concurrently. Use a module-level lock so
# all handler invocations share the same lock object.
paddleocr_call_lock = threading.Lock()

# Force Paddlex cache directory to an ASCII-only path inside the project to avoid
# issues where non-ASCII user paths can break the native paddle inference loader.
# This must be set before importing PaddleOCR so paddlex uses this path for model cache.
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
cache_dir = os.path.join(project_root, '.paddlex_cache')
# paddlex respects PADDLE_PDX_CACHE_HOME for its cache directory; set it to an ASCII path
os.environ.setdefault('PADDLE_PDX_CACHE_HOME', cache_dir)
os.makedirs(cache_dir, exist_ok=True)

try:
    from paddleocr import PaddleOCR
except Exception as e:
    raise RuntimeError("PaddleOCR import failed. Ensure paddleocr and paddlepaddle are installed.")

app = Flask(__name__)
# Try to enable CORS. If flask_cors is available, use it. Otherwise add a permissive
# after_request handler so browsers can call this local server from the client app.
try:
    from flask_cors import CORS
    CORS(app)
    print('CORS enabled via flask_cors')
except Exception:
    print('flask_cors not available; enabling minimal CORS headers via after_request')
    @app.after_request
    def _add_cors_headers(response):
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
        return response
# Initialize PaddleOCR for Chinese + English.
# Newer paddleocr versions deprecate `use_angle_cls` in favor of `use_textline_orientation`.
# Try the modern parameter first and fall back to the older one for compatibility.
try:
    # prefer the newer parameter name where available
    ocr = PaddleOCR(use_textline_orientation=True, lang='ch')
    print('PaddleOCR initialized with use_textline_orientation=True')
except TypeError:
    try:
        ocr = PaddleOCR(use_angle_cls=True, lang='ch')
        print('PaddleOCR initialized with use_angle_cls=True (fallback)')
    except Exception as e:
        # Let any other exceptions bubble up so the earlier import/runtime error is visible
        raise

try:
    import paddleocr as _paddleocr_mod
    paddleocr_ver = getattr(_paddleocr_mod, '__version__', None)
    if paddleocr_ver:
        print(f'paddleocr version: {paddleocr_ver}')
except Exception:
    # not critical; keep going
    pass

@app.route('/ocr', methods=['POST'])
def ocr_endpoint():
    data = request.get_json() or {}
    data_url = data.get('dataUrl')
    if not data_url:
        return jsonify({'error': 'missing dataUrl'}), 400

    # strip data URL prefix if present
    if data_url.startswith('data:'):
        try:
            header, b64 = data_url.split(',', 1)
        except ValueError:
            return jsonify({'error': 'invalid dataUrl'}), 400
        try:
            img_bytes = base64.b64decode(b64)
        except Exception as e:
            return jsonify({'error': 'invalid base64'}), 400
    else:
        # assume raw base64
        try:
            img_bytes = base64.b64decode(data_url)
        except Exception as e:
            return jsonify({'error': 'invalid base64 or dataUrl'}), 400

    # 3️⃣ 转为 numpy 数组（OpenCV 格式）
    img = None
    try:
        image_array = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    except Exception:
        img = None

    # If cv2 failed to decode, try PIL as a fallback (safer for some image types)
    if img is None:
        try:
            pil_img = Image.open(BytesIO(img_bytes)).convert('RGB')
            # Convert PIL RGB to OpenCV BGR
            img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
        except Exception as e:
            return jsonify({'error': 'could not decode image', 'details': str(e)}), 400

    # Validate img
    if img is None or not hasattr(img, 'shape') or img.size == 0:
        return jsonify({'error': 'decoded image empty or invalid'}), 400

    # Run OCR and return both combined text and a JSON-serializable summary to aid debugging
    try:
        # Prefer predict() on newer paddleocr, fall back to ocr()
        # Call OCR with defensive fallbacks. Some native crashes can still cause the
        # process to terminate; protecting against invalid inputs reduces that risk.
        # Serialize access to the underlying PaddleOCR native runtime since some
        # compiled backends are not thread-safe when called concurrently from
        # multiple Python threads (observed as native crashes on Windows).
        # Use the module-level lock declared near the top of this file.
        try:
            with paddleocr_call_lock:
                try:
                    result = ocr.predict(img)
                except Exception:
                    # older paddleocr or fallback
                    result = ocr.ocr(img)
        except Exception as e:
            # If PaddleOCR raised an exception, return a JSON error rather than letting
            # the server crash (some native errors might still abort the process).
            return jsonify({'error': 'paddleocr failed', 'details': str(e)}), 500

        # Build a normalized, JSON-serializable summary
        summary = []
        combined_texts = []

        # Some paddleocr versions return a list containing a single dict with keys like
        # 'rec_texts', 'rec_scores', etc. Normalize that case first: if result is
        # [ { ... } ] then treat result as the inner dict.
        if isinstance(result, list) and len(result) == 1 and isinstance(result[0], dict):
            result = result[0]

        # If result is a dict-like object with rec_texts, use that
        if isinstance(result, dict):
            # small helper to coerce numpy arrays to lists for JSON serialization
            def to_py(o):
                try:
                    return o.tolist()
                except Exception:
                    return o

            rec_texts = result.get('rec_texts') or result.get('rec_text')
            rec_scores = result.get('rec_scores')
            rec_polys = result.get('rec_polys') or result.get('rec_boxes')
            if rec_texts:
                for i, t in enumerate(rec_texts):
                    box = (rec_polys[i] if rec_polys and i < len(rec_polys) else None)
                    summary.append({'text': t, 'conf': (rec_scores[i] if rec_scores and i < len(rec_scores) else None), 'box': (to_py(box) if box is not None else None)})
                    if t and str(t).strip():
                        combined_texts.append(str(t))
            else:
                # fallback: list keys/types (coerce small items safely)
                for k, v in result.items():
                    # Safely convert common array/list types to plain Python lists.
                    if isinstance(v, (str, int, float)) or v is None:
                        val = v
                    elif hasattr(v, 'tolist'):
                        try:
                            val = v.tolist()
                        except Exception:
                            val = str(type(v).__name__)
                    elif isinstance(v, (list, tuple)):
                        coerced = []
                        for x in v:
                            if hasattr(x, 'tolist'):
                                try:
                                    coerced.append(x.tolist())
                                except Exception:
                                    coerced.append(str(type(x).__name__))
                            else:
                                coerced.append(x if isinstance(x, (str, int, float)) else str(type(x).__name__))
                        val = coerced
                    else:
                        # Unknown/complex object — don't attempt to serialize internals
                        val = str(type(v).__name__)
                    summary.append({'key': k, 'value_type': type(v).__name__, 'value': val})
        else:
            # older list-of-lines format
            for line in result:
                for item in line:
                    if isinstance(item, tuple) and len(item) >= 2:
                        box = item[0]
                        text = item[1][0] if isinstance(item[1], (list, tuple)) else item[1]
                        conf = item[1][1] if isinstance(item[1], (list, tuple)) and len(item[1]) > 1 else None
                        summary.append({'box': [[int(p[0]), int(p[1])] for p in box], 'text': text, 'conf': conf})
                        if text and str(text).strip():
                            combined_texts.append(str(text))
                    elif isinstance(item, dict):
                        box = item.get('box') or item.get('bbox')
                        txt = item.get('text') or item.get('data', {}).get('text')
                        conf = item.get('confidence') or item.get('score')
                        summary.append({'box': box, 'text': txt, 'conf': conf})
                        if txt and str(txt).strip():
                            combined_texts.append(str(txt))
                    else:
                        try:
                            txt = str(item)
                        except Exception:
                            txt = None
                        summary.append({'raw': txt})

        combined = '\n'.join(combined_texts)

        # Make sure the payload is JSON-serializable by recursively converting
        # numpy arrays and complex objects into plain lists/strings.
        def make_serializable(o):
            try:
                import numpy as _np
            except Exception:
                _np = None
            if o is None or isinstance(o, (str, int, float, bool)):
                return o
            if isinstance(o, dict):
                return {k: make_serializable(v) for k, v in o.items()}
            if isinstance(o, (list, tuple)):
                return [make_serializable(x) for x in o]
            if _np is not None and isinstance(o, _np.ndarray):
                return o.tolist()
            # fallback to string representation for unknown/complex types
            try:
                return str(o)
            except Exception:
                return repr(o)

        payload = {'text': combined, 'summary': summary}
        safe_payload = make_serializable(payload)
        return Response(json.dumps(safe_payload, ensure_ascii=False), mimetype='application/json')
    except Exception as e:
        msg = str(e or '')
        return jsonify({'error': 'ocr failed', 'details': msg}), 500

if __name__ == '__main__':
    # Run with debug output enabled but disable the reloader to avoid double-initializing
    # heavy resources like PaddleOCR models during development.
    # Allow overriding HOST/PORT via environment variables so multiple server
    # processes can be started on different ports for concurrent handling.
    debug_mode = True
    use_reloader = False

    host = os.environ.get('OCR_HOST', os.environ.get('HOST', '127.0.0.1'))
    try:
        port = int(os.environ.get('OCR_PORT', os.environ.get('PORT', '5000')))
    except Exception:
        port = 5000

    # Enable threaded request handling so the Flask dev server can accept a new
    # connection while another is waiting on OCR. Note: OCR calls are still
    # serialized by paddleocr_call_lock for stability on Windows.
    app.run(host=host, port=port, debug=debug_mode, use_reloader=use_reloader, threaded=True)
