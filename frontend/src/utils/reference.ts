// Evalúa un resultado contra el valor de referencia que guarda la base (PARAMETRO_ESTUDIO.rango_referencia).
//   "70 - 100"  rango numérico      "< 200" / "> 40" / "<= 5" / ">= 3"  límite
//   "Negativo"  o "Amarillo claro,Amarillo"  valores cualitativos esperados (cualquiera de la lista)
export type Flag = "normal" | "alto" | "bajo" | "anormal" | "n/d";

const num = (s: string): number | null => {
  const n = Number(s.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export function evaluarReferencia(valor: string, ref: string | null | undefined): Flag {
  const r = (ref ?? "").trim();
  const v = valor.trim();
  if (!r || !v) return "n/d";

  const rango = r.match(/^(-?[\d.,]+)\s*-\s*(-?[\d.,]+)$/);
  if (rango) {
    const n = num(v), lo = num(rango[1]!), hi = num(rango[2]!);
    if (n === null || lo === null || hi === null) return "n/d";
    return n < lo ? "bajo" : n > hi ? "alto" : "normal";
  }
  const limite = r.match(/^(<=|>=|<|>)\s*(-?[\d.,]+)$/);
  if (limite) {
    const n = num(v), lim = num(limite[2]!);
    if (n === null || lim === null) return "n/d";
    const ok = limite[1] === "<" ? n < lim : limite[1] === "<=" ? n <= lim : limite[1] === ">" ? n > lim : n >= lim;
    if (ok) return "normal";
    return limite[1]!.startsWith("<") ? "alto" : "bajo";
  }
  const esperados = r.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  return esperados.includes(v.toLowerCase()) ? "normal" : "anormal";
}

export const FLAG_TEXT: Record<Flag, string> = { normal: "Normal", alto: "Alto", bajo: "Bajo", anormal: "Fuera de lo esperado", "n/d": "—" };
export const FLAG_STYLE: Record<Flag, string> = {
  normal: "bg-emerald-100 text-emerald-700", alto: "bg-red-100 text-red-700", bajo: "bg-red-100 text-red-700",
  anormal: "bg-red-100 text-red-700", "n/d": "bg-slate-100 text-slate-500",
};
export const isOutOfRange = (f: Flag) => f === "alto" || f === "bajo" || f === "anormal";
