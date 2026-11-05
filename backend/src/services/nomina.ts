/**
 * Cálculo de fechas de pago de nómina. Todo trabaja con fechas "AAAA-MM-DD" (sin hora ni zona horaria),
 * por eso no hay desfases: "hoy" lo informa MySQL (CURDATE() en la zona -06:00).
 *   Semanal   : cada 7 días a partir de fecha_inicio
 *   Quincenal : días 15 y último de cada mes (desde fecha_inicio)
 *   Mensual   : último día de cada mes (desde fecha_inicio)
 */
export type Periodicidad = "Semanal" | "Quincenal" | "Mensual";
export const PERIODICIDADES: readonly Periodicidad[] = ["Semanal", "Quincenal", "Mensual"];

const DIA = 86_400_000;
const aMs = (f: string): number => {
  const [y, m, d] = f.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!);
};
const aFecha = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const ultimoDiaDelMes = (y: number, m0: number): number => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();

/** Genera, en orden, las fechas de pago a partir de `inicio` (generador infinito: quien lo usa decide dónde parar). */
export function* fechasDePago(periodicidad: Periodicidad, inicio: string): Generator<string> {
  const ini = aMs(inicio);
  if (periodicidad === "Semanal") {
    for (let ms = ini; ; ms += 7 * DIA) yield aFecha(ms);
  }
  const d0 = new Date(ini);
  let y = d0.getUTCFullYear();
  let m = d0.getUTCMonth();
  for (;;) {
    const dias = periodicidad === "Quincenal" ? [15, ultimoDiaDelMes(y, m)] : [ultimoDiaDelMes(y, m)];
    for (const d of dias) {
      const ms = Date.UTC(y, m, d);
      if (ms >= ini) yield aFecha(ms);
    }
    m += 1;
    if (m > 11) { m = 0; y += 1; }
  }
}

export interface ResumenNomina {
  /** Fechas de pago ya vencidas (hasta hoy) que siguen sin pagarse. */
  pendientes: string[];
  /** Lo que se le debe: pendientes × salario. */
  adeudo: number;
  /** Primera fecha de pago posterior a hoy. */
  proximoPago: string;
  /** Última fecha de pago liquidada. */
  ultimoPago: string | null;
}

export function resumenNomina(
  sueldo: { salario: number; periodicidad: Periodicidad; fechaInicio: string },
  pagadas: ReadonlySet<string>,
  hoy: string,
): ResumenNomina {
  const pendientes: string[] = [];
  let proximoPago = "";
  let n = 0;
  for (const f of fechasDePago(sueldo.periodicidad, sueldo.fechaInicio)) {
    if (f > hoy) { proximoPago = f; break; }
    if (!pagadas.has(f)) pendientes.push(f);
    if (++n > 5000) throw new Error("Demasiados periodos: revisa la fecha de inicio del sueldo.");
  }
  const pagadasOrdenadas = [...pagadas].sort();
  return {
    pendientes,
    adeudo: Math.round(pendientes.length * sueldo.salario * 100) / 100,
    proximoPago,
    ultimoPago: pagadasOrdenadas.length ? pagadasOrdenadas[pagadasOrdenadas.length - 1]! : null,
  };
}

/** ¿Es `fecha` una fecha de pago válida (vencida o la próxima)? Se puede pagar la próxima por adelantado. */
export function fechaPagable(sueldo: { periodicidad: Periodicidad; fechaInicio: string }, fecha: string, proximoPago: string): boolean {
  if (fecha > proximoPago) return false;
  for (const f of fechasDePago(sueldo.periodicidad, sueldo.fechaInicio)) {
    if (f === fecha) return true;
    if (f > fecha) return false;
  }
  return false;
}

export const esFecha = (v: unknown): v is string => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  return aFecha(aMs(v)) === v;
};
