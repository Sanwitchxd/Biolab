// Modelo de datos y reglas puras del módulo Químico / Laboratorista.
// Entidades alineadas con la base: MUESTRA, INCIDENCIA_MUESTRA, RESULTADO / VALOR_RESULTADO, PARAMETRO_ESTUDIO.

import type { Flag } from "../../utils/reference";
import { isOutOfRange } from "../../utils/reference";

export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/* --------------------------- Estudios y parámetros --------------------------- */

/** PARAMETRO_ESTUDIO: nombre, unidad, valor de referencia y (si es cualitativo) la lista de opciones. */
export interface ParamDef { id: number; name: string; unit: string; ref: string; options: string[] }
export interface LabService { id: string; clave: string; name: string; external: boolean; params: ParamDef[] }

export type ResultStatus = "Pendiente" | "Capturado" | "Validado" | "Liberado";
export type OrderStatus = "Registrada" | "En proceso" | "Validada" | "Liberada" | "Entregada" | "Cancelada";

/** flag "n/d": el parámetro no tiene referencia en el catálogo, así que no se puede marcar alto/bajo. */
export interface ResultValue { paramId: number; name: string; value: string; unit: string; ref: string; flag: Flag }

export interface OrderItem {
  detailId: number; serviceId: string; name: string;
  result: {
    id: number | null; status: ResultStatus; capturedBy?: string; capturedAt?: Date; validatedBy?: string; validatedAt?: Date; releasedAt?: Date;
    values: ResultValue[]; hasPdf: boolean;
  };
}
export interface Order { id: string; folio: string; patientId: string; createdAt: Date; status: OrderStatus; items: OrderItem[] }
export interface Patient { id: string; name: string }

export const isValidated = (i: OrderItem) => i.result.status === "Validado" || i.result.status === "Liberado";
export const isOpenOrder = (o: Order) => o.status !== "Cancelada" && o.status !== "Entregada";

/* --------------------------------- Muestras --------------------------------- */

/** MUESTRA.estado (almacenado). "En proceso", "Procesada" y "Entregada" se derivan de RESULTADO y ORDEN. */
export type SampleState = "Pendiente" | "Recibida" | "Con incidencia";
export type SampleView = "Pendiente" | "Recibida" | "En proceso" | "Procesada" | "Con incidencia" | "Entregada" | "Cancelada";

export const SAMPLE_VIEWS: SampleView[] = ["Pendiente", "Recibida", "En proceso", "Procesada", "Con incidencia", "Entregada", "Cancelada"];

export interface Sample {
  id: string; // M-<id_muestra>
  dbId: number;
  orderId: string;
  state: SampleState;
  receivedAt: Date | null;
}

/** Estatus que ve el químico: combina MUESTRA.estado con el avance de RESULTADO y ORDEN. */
export function viewStatus(sample: Sample, order: Order): SampleView {
  if (order.status === "Cancelada") return "Cancelada";
  if (order.status === "Entregada") return "Entregada";
  if (sample.state === "Con incidencia") return "Con incidencia";
  if (sample.state === "Pendiente") return "Pendiente";
  const items = order.items;
  if (items.length > 0 && items.every(isValidated)) return "Procesada";
  if (items.some((i) => i.result.status !== "Pendiente")) return "En proceso";
  return "Recibida";
}

export const VIEW_STYLE: Record<SampleView, string> = {
  Pendiente: "bg-slate-100 text-slate-600",
  Recibida: "bg-sky-100 text-sky-700",
  "En proceso": "bg-amber-100 text-amber-700",
  Procesada: "bg-emerald-100 text-emerald-700",
  "Con incidencia": "bg-red-100 text-red-700",
  Entregada: "bg-violet-100 text-violet-700",
  Cancelada: "bg-slate-100 text-slate-400",
};

/* -------------------------------- Incidencias -------------------------------- */

/** Los tipos que admite la base (CHECK de INCIDENCIA_MUESTRA). */
export const INCIDENT_TYPES = ["Hemolizada", "Dañada", "Otra"] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];

export interface Incident {
  id: string; // INC-<id_incidencia>
  sampleId: string;
  type: IncidentType;
  description: string;
  reportedBy: string;
  at: Date;
}

/* ------------------------ Parámetros dinámicos de captura ------------------------ */

export type ParamKind = "number" | "select" | "text";

/** Opciones cerradas para parámetros cualitativos conocidos (si el catálogo los trae con ese nombre). */
export const TEXT_OPTIONS: Record<string, { value: string }[]> = {
  Color: [{ value: "Amarillo claro" }, { value: "Amarillo" }, { value: "Ámbar" }],
  Proteínas: [{ value: "Negativo" }, { value: "Trazas" }, { value: "+" }, { value: "++" }, { value: "+++" }],
};

/** Con lista de opciones (catálogo) se elige; con unidad de medida se captura un número; lo demás es texto libre. */
export const paramKind = (p: ParamDef): ParamKind => (p.options.length > 0 || TEXT_OPTIONS[p.name] ? "select" : p.unit ? "number" : "text");
export const paramOptions = (p: ParamDef): string[] => (p.options.length > 0 ? p.options : (TEXT_OPTIONS[p.name] ?? []).map((o) => o.value));
export const paramRef = (p: ParamDef) => p.ref || "—";
export const paramLabel = (p: ParamDef) => (p.unit ? `${p.name} (${p.unit})` : p.name);

export function parseNumber(raw: string): number | null {
  const text = raw.trim().replace(",", ".");
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Errores por parámetro; vacío = captura válida. Los campos salen del catálogo del estudio. */
export function validateInputs(service: LabService, inputs: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {};
  service.params.forEach((p) => {
    const raw = (inputs[p.name] ?? "").trim();
    if (!raw) errors[p.name] = "Campo obligatorio.";
    else if (raw.length > 50) errors[p.name] = "Máximo 50 caracteres.";
    else if (paramKind(p) === "number" && parseNumber(raw) === null) errors[p.name] = "Ingresa un número válido (≥ 0).";
  });
  return errors;
}

/** Valores listos para enviar a la API: [{ idParametro, valor }]. */
export function buildPayloadValues(service: LabService, inputs: Record<string, string>) {
  return service.params.map((p) => {
    const raw = (inputs[p.name] ?? "").trim();
    return { idParametro: p.id, valor: paramKind(p) === "number" ? String(parseNumber(raw)) : raw };
  });
}

export const outOfRange = (values: ResultValue[]) => values.filter((v) => isOutOfRange(v.flag)).length;
export const isEditable = (item: OrderItem) => item.result.status === "Pendiente" || item.result.status === "Capturado";

/* ------------------------------ Reporte externo ------------------------------ */

export const MAX_PDF_MB = 10;

export function validatePdf(file: { name: string; type: string; size: number }): string | null {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return "Solo se permiten archivos PDF.";
  if (file.size === 0) return "El archivo está vacío.";
  if (file.size > MAX_PDF_MB * 1024 * 1024) return `El archivo supera ${MAX_PDF_MB} MB.`;
  return null;
}
