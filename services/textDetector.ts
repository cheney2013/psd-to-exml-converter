export interface OcrResult {
  result: boolean;
  text?: string;
  // Optional structured summary returned by the PaddleOCR server (array of {text, conf, box} etc.)
  summary?: any;
}

// Port pool round-robin with optional localStorage override.
// - Default host: 127.0.0.1
// - Default ports: [5000]
// - Override ports via localStorage['OCR_PORTS'] = '5000,5001,5002'
// - Override host via localStorage['OCR_HOST'] = '127.0.0.1'
const DEFAULT_HOST = '127.0.0.1';
function readPortPool(): number[] {
  try {
    const raw = window.localStorage?.getItem('OCR_PORTS');
    if (!raw) return [5000, 5001, 5002];
    const arr = raw.split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isFinite(n) && n > 0);
    return arr.length > 0 ? arr : [5000, 5001, 5002];
  } catch {
    return [5000, 5001, 5002];
  }
}
function readHost(): string {
  try {
    const h = window.localStorage?.getItem('OCR_HOST');
    if (h && h.trim()) return h.trim();
  } catch {}
  return DEFAULT_HOST;
}
let __rr = 0;
function nextOcrUrl(): string {
  const ports = readPortPool();
  const host = readHost();
  const port = ports[(__rr++ % ports.length + ports.length) % ports.length];
  return `http://${host}:${port}/ocr`;
}

export async function ocrContainsText(dataUrl: string, minChars = 1, langOrLangs: string | string[] = ['chi_sim', 'chi_tra']): Promise<OcrResult> {
  try {
    const langs = Array.isArray(langOrLangs) ? langOrLangs : [langOrLangs];
    // Round-robin across port pool; on failure, retry other ports once.
    const tried = new Set<string>();
    for (let i = 0; i < Math.max(1, readPortPool().length); i++) {
      const url = nextOcrUrl();
      if (tried.has(url)) continue;
      tried.add(url);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 116000);
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl, langs }),
          signal: controller.signal,
        } as any);
        clearTimeout(timeout);
        if (resp.ok) {
          const json = await resp.json();
          const text = (json && (typeof json.text === 'string' ? json.text : '')) || '';
          const nonWhitespace = text.replace(/\s+/g, '');
          const summary = json && json.summary;
          return { result: nonWhitespace.length >= minChars, text, summary };
        }
      } catch {
        // try next
      } finally {
        try { clearTimeout(timeout); } catch {}
      }
    }
    return { result: false };
  } catch (err) {
    return { result: false };
  }
}