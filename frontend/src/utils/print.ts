import { escapeHtml } from "./escape";

/** Imprime un fragmento HTML en un iframe oculto (sin ventanas emergentes). */
export function printHtml(title: string, body: string) {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc || !frame.contentWindow) { frame.remove(); return; }
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    body{font-family:'Courier New',monospace;font-size:12px;color:#111;margin:0;padding:12px;max-width:320px}
    h1{font-size:15px;text-align:center;margin:0}.c{text-align:center}.muted{color:#555}
    hr{border:0;border-top:1px dashed #666;margin:8px 0}.row{display:flex;justify-content:space-between;gap:8px}
    table{width:100%;border-collapse:collapse;font-family:Arial,sans-serif}th,td{text-align:left;padding:4px 2px;border-bottom:1px solid #ddd}
  </style></head><body>${body}</body></html>`);
  doc.close();
  frame.contentWindow.focus();
  setTimeout(() => { frame.contentWindow?.print(); setTimeout(() => frame.remove(), 1500); }, 150);
}
