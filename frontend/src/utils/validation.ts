// Validaciones y ayudas de captura compartidas por Recepción y Gerencia.
// Las mismas reglas se vuelven a comprobar en el backend (la seguridad real está allá).

export const NAME_RE = /^[\p{L}][\p{L} .'’-]*$/u;
export const USERNAME_RE = /^[A-Za-z0-9_.-]+$/;

/** Solo números, hasta `max` dígitos (para teléfonos, importes enteros, etc.). */
export const onlyDigits = (value: string, max = 10) => value.replace(/\D/g, "").slice(0, max);

/** Quita espacios repetidos y de los extremos. */
export const squash = (value: string) => value.replace(/\s+/g, " ").trim();

/** Mensaje de error del nombre de una persona, o "" si es válido. */
export function nameError(value: string, que = "El nombre"): string {
  const v = squash(value);
  if (v.length < 3) return `${que} debe tener al menos 3 caracteres.`;
  if (v.length > 100) return `${que} es demasiado largo (máximo 100 caracteres).`;
  if (!NAME_RE.test(v)) return `${que} solo puede llevar letras, espacios, punto, apóstrofo y guion.`;
  return "";
}

/** Mensaje de error del teléfono (opcional), o "" si está vacío o completo. */
export function phoneError(digitsOnly: string): string {
  if (digitsOnly.length === 0 || digitsOnly.length === 10) return "";
  return `Faltan ${10 - digitsOnly.length} dígito${10 - digitsOnly.length === 1 ? "" : "s"}: el teléfono debe tener 10 (o déjalo vacío si no tiene).`;
}

export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/* ------------------------- Tipo de estudio (para filtrar) ------------------------- */
// La base no guarda el tipo de muestra; se deduce del estudio: externo, orina, heces, otros o sangre (lo más común).

export type StudyType = "Sangre" | "Orina" | "Heces" | "Otros" | "Externo";
export const STUDY_TYPES: StudyType[] = ["Sangre", "Orina", "Heces", "Otros", "Externo"];

export function studyType(clave: string, nombre: string, external: boolean): StudyType {
  if (external) return "Externo";
  const t = norm(`${clave} ${nombre}`);
  if (/orina|urocultivo|embarazo|\bego\b|\buroc\b|\bpemb\b/.test(t)) return "Orina";
  if (/heces|copro|parasit|\bcopro\b/.test(t)) return "Heces";
  if (/exudado|semen|esperma|biopsi|citolog|frotis|cultivo(?! de orina)/.test(t)) return "Otros";
  return "Sangre";
}

export const STUDY_TYPE_STYLE: Record<StudyType, string> = {
  Sangre: "bg-red-50 text-red-600", Orina: "bg-amber-50 text-amber-700", Heces: "bg-orange-50 text-orange-700",
  Otros: "bg-slate-100 text-slate-600", Externo: "bg-violet-50 text-violet-700",
};
