// Formateadores compartidos entre módulos (es-MX).

export const money = (value: number) =>
  value.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

export const moneyExact = (value: number) =>
  value.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });

export const pad = (n: number) => String(n).padStart(2, "0");

/** Clave de día local AAAA-MM-DD (evita desfases de zona horaria de toISOString). */
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

export const parseDayKey = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const timeLabel = (d: Date, seconds = false) =>
  d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", ...(seconds ? { second: "2-digit" } : {}), hour12: false });

export const dateLabel = (d: Date) =>
  d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }).replace(/\./g, "");

export const longDateLabel = (d: Date) =>
  d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export const dateTimeLabel = (d: Date) => `${dateLabel(d)} · ${timeLabel(d)}`;

export const relativeDay = (d: Date, now: Date) => {
  const diff = Math.round((parseDayKey(dayKey(now)).getTime() - parseDayKey(dayKey(d)).getTime()) / 86400000);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  if (diff === 2) return "Antier";
  return `Hace ${diff} días`;
};

