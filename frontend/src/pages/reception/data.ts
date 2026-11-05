// Modelo de datos de Recepción. Entidades alineadas con la base de datos:
// PACIENTE, ORDEN, DETALLE_ORDEN (precio_aplicado), PAGO, ESTUDIO (catálogo) y vw_informe_resultado.
// Los datos reales llegan por la API (ver store.ts); aquí solo hay tipos, constantes y cálculos.
import { dayKey } from "../../utils/format";
import type { Flag } from "../../utils/reference";

export type PayMethod = "Efectivo" | "Tarjeta" | "Transferencia";
export type PayType = "Anticipo" | "Abono" | "Liquidación";
export type OrderStatus = "Registrada" | "En proceso" | "Validada" | "Liberada" | "Entregada" | "Cancelada";
export type ResultStatus = "Pendiente" | "Capturado" | "Validado" | "Liberado";
export type SampleState = "Pendiente" | "Recibida" | "Con incidencia" | "Procesada";
export type Category = "Análisis clínico";

export const OPEN_HOUR = 7;
export const CLOSE_HOUR = 20;
/** Citas máximas por hora en todo el laboratorio (la base no guarda "destino" por cita). */
export const MAX_POR_HORA = 10;

/* ------------------- Catálogo (precios fijos: los define Gerencia) ------------------- */

export interface Service {
  id: string; clave: string; name: string; category: Category; price: number; external: boolean;
}

/* --------------------------------- Entidades --------------------------------- */

export interface Patient { id: string; name: string; phone: string; whatsapp: boolean; registeredAt: Date }

/** flag "n/d": la base no guarda rangos de referencia, así que no se puede marcar alto/bajo. */
export interface ResultValue { name: string; value: string; unit: string; ref: string; flag: Flag }
export interface OrderItem {
  serviceId: string; name: string; price: number; // precio_aplicado: se congela al crear la orden
  result: {
    status: ResultStatus; validatedBy?: string; validatedAt?: Date; releasedAt?: Date; capturedBy?: string; capturedAt?: Date; observations?: string;
    values: ResultValue[];
    /** Reporte externo (PDF de otra clínica/hospital/laboratorio de referencia) ligado a este resultado. */
    externalPdf?: string; externalInstitution?: string; externalUrl?: string;
  };
}
export interface Payment { id: string; ticketNo: string; orderId: string; amount: number; method: PayMethod; type: PayType; at: Date; cashier: string }
export interface Order {
  id: string; folio: string; patientId: string; createdAt: Date; appointmentAt: Date | null;
  items: OrderItem[]; status: OrderStatus; cancelReason?: string; deliveredAt?: Date; deliveredBy?: string; notify: "WhatsApp" | "Físico";
  /** Estado de la muestra de la orden (MUESTRA.estado). */
  sample: SampleState | null;
  /** Indicaciones de preparación y preferencias de WhatsApp de esta orden. */
  prep: string; remind: boolean; resultsNotice: boolean; remindAt: Date | null;
}

/* --------------------------------- Derivados --------------------------------- */
// El total y el saldo no se almacenan (3FN): se calculan de DETALLE_ORDEN y PAGO.
// (La base valida el saldo real; esto solo alimenta lo que se muestra en pantalla.)

export const orderTotal = (o: Order) => o.items.reduce((s, i) => s + i.price, 0);
export const orderPaid = (o: Order, payments: Payment[]) => payments.filter((p) => p.orderId === o.id).reduce((s, p) => s + p.amount, 0);
export const orderBalance = (o: Order, payments: Payment[]) => (o.status === "Cancelada" ? 0 : Math.max(0, Math.round((orderTotal(o) - orderPaid(o, payments)) * 100) / 100));

export type FinanceState = "Liquidado" | "Con adeudo" | "Abonado" | "Cancelada";
export function financeState(o: Order, payments: Payment[]): FinanceState {
  if (o.status === "Cancelada") return "Cancelada";
  const bal = orderBalance(o, payments);
  if (bal === 0) return "Liquidado";
  return orderPaid(o, payments) > 0 ? "Abonado" : "Con adeudo";
}
export const isValidated = (i: OrderItem) => i.result.status === "Validado" || i.result.status === "Liberado";
/** La base marca la orden como "Liberada" cuando todos sus estudios están liberados. */
export const allValidated = (o: Order) => o.items.length > 0 && (o.status === "Liberada" || o.status === "Entregada");

/* ------------------------------ Códigos y formatos ------------------------------ */
export const ymd = (d: Date) => dayKey(d).replace(/-/g, "");
export const patientCode = (idPaciente: number) => `P-${String(idPaciente).padStart(4, "0")}`;
export const digits = (s: string) => s.replace(/\D/g, "");
export const formatPhone = (s: string) => { const d = digits(s); return d.length === 10 ? `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}` : s; };


/* ------------------------- Estado del paciente (columna "Estado") ------------------------- */

export type AttentionTone = "gray" | "blue" | "amber" | "green" | "red" | "violet";
export interface Attention { label: string; detail: string; tone: AttentionTone }

/**
 * En qué punto está la última orden activa del paciente, en lenguaje de mostrador:
 *   cita programada -> en espera de atención -> en análisis -> resultados listos -> entregado.
 * Sale de ORDEN.estado y MUESTRA.estado; el químico y recepción trabajan sobre los mismos datos.
 */
export function attentionOf(order: Order | undefined, now = new Date()): Attention {
  if (!order) return { label: "Sin visitas", detail: "Aún no tiene órdenes", tone: "gray" };
  const at = (d: Date | null) => (d ? d.toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).replace(/\./g, "") : "");
  switch (order.status) {
    case "Cancelada": return { label: "Cancelada", detail: "La orden fue cancelada", tone: "gray" };
    case "Entregada": return { label: "Entregado", detail: `Resultados entregados${order.deliveredAt ? ` el ${at(order.deliveredAt)}` : ""}`, tone: "violet" };
    case "Liberada": case "Validada": return { label: "Resultados listos", detail: "Validados por el químico: pendientes de entrega", tone: "green" };
    default: break;
  }
  if (order.sample === "Con incidencia") return { label: "Nueva toma requerida", detail: "La muestra tuvo una incidencia: contactar al paciente", tone: "red" };
  if (order.sample === "Pendiente" || order.sample === null) {
    return order.appointmentAt && order.appointmentAt.getTime() > now.getTime()
      ? { label: "Cita programada", detail: `Cita el ${at(order.appointmentAt)}`, tone: "blue" }
      : { label: "En espera de atención", detail: "Aún no se recibe su muestra", tone: "amber" };
  }
  const captured = order.items.some((i) => i.result.status !== "Pendiente");
  return captured
    ? { label: "En espera de validación", detail: "Atendido: el químico ya capturó resultados", tone: "amber" }
    : { label: "En análisis", detail: "Atendido: su muestra está en el laboratorio", tone: "blue" };
}

export const ATTENTION_STYLE: Record<AttentionTone, string> = {
  gray: "bg-slate-100 text-slate-600", blue: "bg-sky-100 text-sky-700", amber: "bg-amber-100 text-amber-700",
  green: "bg-emerald-100 text-emerald-700", red: "bg-red-100 text-red-700", violet: "bg-violet-100 text-violet-700",
};

/** Última orden que no está cancelada (la "visita en curso" del paciente); si todas se cancelaron, la más reciente. */
export function latestOrder(orders: Order[]): Order | undefined {
  const sorted = [...orders].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return sorted.find((o) => o.status !== "Cancelada") ?? sorted[0];
}

/** Los datos del paciente se congelan cuando su última visita ya tiene resultados validados (RN-03). */
export function patientLocked(orders: Order[]): { locked: boolean; reason: string } {
  const latest = [...orders].filter((o) => o.status !== "Cancelada").sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (!latest) return { locked: false, reason: "" };
  if (latest.status === "Entregada") return { locked: true, reason: "Resultados ya entregados: los datos quedan cerrados hasta su próxima visita." };
  if (latest.status === "Liberada" || latest.status === "Validada" || latest.items.some((i) => i.result.status === "Validado" || i.result.status === "Liberado")) {
    return { locked: true, reason: "El químico ya validó resultados: los datos del paciente no pueden editarse." };
  }
  return { locked: false, reason: "" };
}
