import { errorMessage } from '../services/api.js';

/** File-name friendly: keeps letters, digits and accents (incl. Amharic), turns everything else into "-". */
export const slug = (v) => String(v || '').normalize('NFC').replace(/[^\p{L}\p{N}\p{M}]+/gu, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'report-format';

/** Hand a Blob to the browser as a file download. */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A failed download comes back as a Blob (we asked for one) — read the server's JSON message out of it. */
export async function blobErrorMessage(e) {
  const data = e?.response?.data;
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    try {
      const text = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsText(data); });
      const json = JSON.parse(text);
      if (json.message) return json.message;
    } catch { /* not JSON — fall through */ }
  }
  return errorMessage(e);
}
