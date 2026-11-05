// Tipos y utilidades del módulo de Gerencia. Los datos vienen de la API (ver mapping.ts / store.ts).
// Los nombres siguen el modelo de datos (USUARIO, PAGO, BITACORA, ORDEN, PACIENTE).

export type UserRole = "Recepcionista" | "Químico" | "Gerencia";
export type LogModule = "Gerencia" | "Laboratorio" | "Recepción";
export type PayMethod = "Efectivo" | "Tarjeta" | "Transferencia";
export type PayType = "Anticipo" | "Abono" | "Liquidación";

export const OPENING_HOUR = 7; // Hora de apertura de caja (07:00)

import { dayKey, pad, parseDayKey } from "../../utils/format";
export * from "../../utils/format";

/* -------------------------------- Usuarios ------------------------------- */
export interface StaffUser {
  id: string; // id_usuario
  username: string;
  name: string;
  role: UserRole;
  area: string;
  active: boolean; // estado = 'Activo'
  lastLogin: Date | null; // último INICIO_SESION en la bitácora
}

export const AREA_BY_ROLE: Record<UserRole, string> = {
  Recepcionista: "Admisión y recepción",
  Químico: "Laboratorio clínico",
  Gerencia: "Dirección administrativa",
};

/* --------------------------------- Pagos --------------------------------- */
export interface Payment {
  id: string;
  folio: string;
  patientId: string;
  patientName: string;
  amount: number;
  method: PayMethod;
  type: PayType;
  at: Date;
  /** Los pagos de la BD son inmutables y definitivos: todos cuentan como "Conciliado". */
  status: "Conciliado" | "Pendiente";
  cashier: string;
}

export interface Totals {
  total: number;
  count: number;
  reconciled: number;
  reconciledCount: number;
  pending: number;
  pendingCount: number;
  byMethod: Record<PayMethod, number>;
  countByMethod: Record<PayMethod, number>;
  byType: Record<PayType, number>;
}

export function summarize(payments: Payment[]): Totals {
  const t: Totals = {
    total: 0, count: payments.length, reconciled: 0, reconciledCount: 0, pending: 0, pendingCount: 0,
    byMethod: { Efectivo: 0, Tarjeta: 0, Transferencia: 0 },
    countByMethod: { Efectivo: 0, Tarjeta: 0, Transferencia: 0 },
    byType: { Anticipo: 0, Abono: 0, Liquidación: 0 },
  };
  for (const p of payments) {
    t.total += p.amount;
    t.byMethod[p.method] += p.amount;
    t.countByMethod[p.method] += 1;
    t.byType[p.type] += p.amount;
    if (p.status === "Conciliado") { t.reconciled += p.amount; t.reconciledCount += 1; }
    else { t.pending += p.amount; t.pendingCount += 1; }
  }
  return t;
}

/* ----------------------------- Cortes de caja --------------------------- */
// No existe tabla de cierres: cada "corte" es el resumen calculado de los pagos de un día.
export interface CashCut {
  id: string; // C-DDMMAA
  date: string; // AAAA-MM-DD
  openedAt: Date; // primer cobro del día
  closedAt: Date; // último cobro del día
  totals: Totals;
}

export const cutId = (date: Date) => `C-${pad(date.getDate())}${pad(date.getMonth() + 1)}${String(date.getFullYear()).slice(2)}`;

export function dailyCut(key: string, list: Payment[]): CashCut {
  const day = parseDayKey(key);
  const times = list.map((p) => p.at.getTime());
  return {
    id: cutId(day), date: key,
    openedAt: new Date(times.length ? Math.min(...times) : day.getTime()),
    closedAt: new Date(times.length ? Math.max(...times) : day.getTime()),
    totals: summarize(list),
  };
}

/** Resumen por día de los días anteriores a hoy. */
export function buildCuts(payments: Payment[], now = new Date()): CashCut[] {
  const today = dayKey(now);
  const byDay = new Map<string, Payment[]>();
  for (const p of payments) {
    const k = dayKey(p.at);
    if (k >= today) continue;
    byDay.set(k, [...(byDay.get(k) ?? []), p]);
  }
  return [...byDay].map(([k, list]) => dailyCut(k, list)).sort((a, b) => b.date.localeCompare(a.date));
}

/* -------------------------------- Bitácora ------------------------------ */
export type LogKind = "Sesión" | "Pago" | "Orden" | "Muestra" | "Resultado" | "Usuarios" | "Caja";

export interface LogEntry {
  id: number;
  at: Date;
  user: string;
  module: LogModule;
  kind: LogKind;
  action: string;
  folio?: string;
  patientId?: string;
  patientName?: string;
}

export const LOG_KINDS: LogKind[] = ["Sesión", "Orden", "Pago", "Muestra", "Resultado", "Usuarios"];

/* ------------------------------ Estadísticas ----------------------------- */
export interface StudyCount { day: string; study: string; external: boolean; count: number }

export type Periodicidad = "Semanal" | "Quincenal" | "Mensual";
export const PERIODICIDADES: Periodicidad[] = ["Semanal", "Quincenal", "Mensual"];
export type PayrollMethod = "Efectivo" | "Transferencia" | "Cheque";
export interface PayrollPayment { id: number; period: string; amount: number; method: string; note: string | null; at: Date; by: string }
/** Fechas en formato AAAA-MM-DD (sin zona horaria), tal como las entrega la API. */
export interface Payroll { userId: string; salary: number; periodicity: Periodicidad; startDate: string; pending: string[]; owed: number; nextPay: string; lastPay: string | null; payments: PayrollPayment[] }
/** "2026-11-15" -> "15 nov 2026" sin pasar por Date/zonas horarias. */
export const isoDayLabel = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${d} ${meses[(m ?? 1) - 1]} ${y}`;
};
