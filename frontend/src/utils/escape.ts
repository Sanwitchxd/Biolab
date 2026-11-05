/** Escapa texto para insertarlo en HTML (impresión de tickets e informes): evita que un nombre o un valor ejecute código. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
