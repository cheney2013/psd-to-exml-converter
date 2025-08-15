# psd-to-exml-converter (OCR-first)

This app converts PSDs to EXML and uses OCR to detect text in exported images. The frontend now relies solely on a local PaddleOCR Python server (no in-browser tesseract fallback).

## Run the web app

Prerequisites: Node.js 18+

1) Install dependencies

```bash
npm install
```

2) Set API keys (optional)

Set `GEMINI_API_KEY` in `.env.local` if you plan to use Gemini features.

3) Start the dev server

```bash
npm run dev
```

## Start the OCR backend (recommended)

The repository bundles a ready-to-use PaddleOCR server script and virtual environment.

PowerShell (Windows):

```powershell
# default: port 5000, safe mode (serialized OCR calls)
./tools/paddle_ocr_venv/Scripts/python.exe tools/paddle_ocr_server.py

# enable single-process multithreaded OCR (test performance/stability)
$env:OCR_DISABLE_LOCK=1; ./tools/paddle_ocr_venv/Scripts/python.exe tools/paddle_ocr_server.py

# choose a different port/host if needed
$env:OCR_PORT=5001; $env:OCR_HOST='127.0.0.1'; ./tools/paddle_ocr_venv/Scripts/python.exe tools/paddle_ocr_server.py
```

### Start multiple OCR processes at once

Use the helper script to launch a pool on different ports:

```powershell
# start three servers on 5000,5001,5002 with lock disabled (multi-threaded)
./tools/start_ocr_pool.ps1 -Ports 5000,5001,5002 -DisableLock

# start two servers on 5000,5001 in safe (serialized) mode
./tools/start_ocr_pool.ps1 -Ports 5000,5001

# show console windows (useful for debugging); by default windows are hidden
./tools/start_ocr_pool.ps1 -Ports 5000,5001 -ShowWindows
```

Frontend port pool
- In the browser console, set:

```js
localStorage.setItem('OCR_PORTS', '5000,5001,5002');
// optional host override (default 127.0.0.1)
localStorage.setItem('OCR_HOST', '127.0.0.1');
```

The frontend will round-robin across the configured ports and retry another port if a request fails.

Notes
- Endpoint: `POST http://127.0.0.1:5000/ocr` with JSON `{ dataUrl, langs }`
- Env vars:
  - `OCR_DISABLE_LOCK=1` to disable internal lock and allow multi-threaded OCR calls.
  - `OCR_PORT`/`PORT` to set the port, `OCR_HOST`/`HOST` to set the host.
  - For higher throughput and stability, start multiple processes on different ports and load-balance on the client.
 - Logs: when using `start_ocr_pool.ps1`, per-port logs are written to `tools/logs/ocr_<port>.out` and `tools/logs/ocr_<port>.err`.

## Frontend OCR usage

Use the OCR helpers from `services/textDetector.ts`.

```ts
import { ocrContainsText, ocrGetText } from './services/textDetector';

// boolean-style detection
const { result, text, summary } = await ocrContainsText(dataUrl, 2, ['chi_sim','chi_tra']);

// get recognized text directly
const textOnly = await ocrGetText(dataUrl); // '' if nothing recognized
```

Behavior
- The frontend sends OCR requests to the local PaddleOCR server. If the server is not running or returns an error, OCR-based features will return empty results.

## Quick concurrency test (optional)

With the server running, you can simulate concurrent requests:

```powershell
./tools/paddle_ocr_venv/Scripts/python.exe tools/send_concurrent_requests.py
```

This sends multiple `POST /ocr` requests in parallel and prints their status.

## Stop the OCR backend

Use the helper to stop by ports or stop all server processes:

```powershell
# stop by ports
./tools/stop_ocr_pool.ps1 -Ports 5000,5001,5002

# stop all python processes running paddle_ocr_server.py
./tools/stop_ocr_pool.ps1 -All
```

You can also verify listening ports:

```powershell
Test-NetConnection 127.0.0.1 -Port 5000
netstat -ano | findstr :5000
```
