import { useMemo } from "react";
import { BarChart, ChartCard, DonutChart, HBars, type Datum } from "./charts";
import { dayKey, money, OPENING_HOUR, pad, summarize, type Payment } from "./data";

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** Pagos dentro de [from, to] (días inclusivos) sin considerar movimientos posteriores a `now`. */
export function filterRange(payments: Payment[], from: Date, to: Date, now: Date) {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0).getTime();
  const end = Math.min(new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59).getTime(), now.getTime());
  return payments.filter((p) => p.at.getTime() >= start && p.at.getTime() <= end);
}

/** Agrupa ingresos en barras según la longitud del rango. */
export function bucketIncome(payments: Payment[], from: Date, to: Date): { data: Datum[]; unit: string } {
  const days = Math.round((new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime() - new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()) / 86400000) + 1;
  if (days <= 1) {
    const hours = Array.from({ length: 14 }, (_, i) => OPENING_HOUR + i);
    return { unit: "hora", data: hours.map((h) => ({ label: `${pad(h)}h`, value: payments.filter((p) => p.at.getHours() === h).reduce((s, p) => s + p.amount, 0) })) };
  }
  if (days <= 45) {
    const map = new Map<string, number>();
    for (let i = 0; i < days; i++) map.set(dayKey(new Date(from.getFullYear(), from.getMonth(), from.getDate() + i)), 0);
    payments.forEach((p) => { const k = dayKey(p.at); if (map.has(k)) map.set(k, (map.get(k) ?? 0) + p.amount); });
    return { unit: "día", data: [...map].map(([k, v]) => ({ label: `${Number(k.slice(8))}/${Number(k.slice(5, 7))}`, value: v })) };
  }
  if (days <= 120) {
    const weeks = new Map<string, number>();
    for (let i = 0; i < days; i += 7) weeks.set(dayKey(new Date(from.getFullYear(), from.getMonth(), from.getDate() + i)), 0);
    const starts = [...weeks.keys()];
    payments.forEach((p) => {
      const idx = Math.min(starts.length - 1, Math.floor((new Date(p.at.getFullYear(), p.at.getMonth(), p.at.getDate()).getTime() - new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()) / (7 * 86400000)));
      weeks.set(starts[Math.max(0, idx)], (weeks.get(starts[Math.max(0, idx)]) ?? 0) + p.amount);
    });
    return { unit: "semana", data: [...weeks].map(([k, v]) => ({ label: `${Number(k.slice(8))}/${Number(k.slice(5, 7))}`, value: v })) };
  }
  const months = new Map<string, number>();
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  while (cursor <= to) { months.set(`${cursor.getFullYear()}-${cursor.getMonth()}`, 0); cursor.setMonth(cursor.getMonth() + 1); }
  payments.forEach((p) => { const k = `${p.at.getFullYear()}-${p.at.getMonth()}`; if (months.has(k)) months.set(k, (months.get(k) ?? 0) + p.amount); });
  return { unit: "mes", data: [...months].map(([k, v]) => ({ label: MONTHS[Number(k.split("-")[1])], value: v })) };
}

interface Props { payments: Payment[]; from: Date; to: Date; title?: string }

export default function CashCharts({ payments, from, to, title = "ingresos" }: Props) {
  const totals = useMemo(() => summarize(payments), [payments]);
  const income = useMemo(() => bucketIncome(payments, from, to), [payments, from, to]);

  if (payments.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">No hay movimientos en este periodo para graficar.</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <ChartCard title={`Ingresos por ${income.unit}`} subtitle={`Barras de ${title} · pasa el cursor para ver el monto`}>
          <BarChart data={income.data} />
        </ChartCard>
      </div>
      <ChartCard title="Desglose por método de pago" subtitle="Efectivo, tarjeta y transferencia">
        <DonutChart centerLabel="Ingresos" data={[
          { label: "Efectivo", value: totals.byMethod.Efectivo, color: "#10B981" },
          { label: "Tarjeta", value: totals.byMethod.Tarjeta, color: "#3B82F6" },
          { label: "Transferencia", value: totals.byMethod.Transferencia, color: "#8B5CF6" },
        ]} />
      </ChartCard>
      <ChartCard title="Estado de conciliación" subtitle="Pagos confirmados vs. pendientes por cobrar">
        <DonutChart centerLabel="Registrado" data={[
          { label: "Conciliado", value: totals.reconciled, color: "#10B981" },
          { label: "Pendiente", value: totals.pending, color: "#F59E0B" },
        ]} />
      </ChartCard>
      <ChartCard title="Ingresos por tipo de pago" subtitle="Anticipos, abonos y liquidaciones">
        <HBars data={[
          { label: "Liquidación", value: totals.byType.Liquidación, color: "#3B82F6" },
          { label: "Anticipo", value: totals.byType.Anticipo, color: "#06B6D4" },
          { label: "Abono", value: totals.byType.Abono, color: "#F59E0B" },
        ]} />
      </ChartCard>
      <ChartCard title="Transacciones por método" subtitle="Número de pagos registrados">
        <HBars formatValue={(v) => `${v} pagos`} data={[
          { label: "Tarjeta", value: totals.countByMethod.Tarjeta, color: "#3B82F6" },
          { label: "Efectivo", value: totals.countByMethod.Efectivo, color: "#10B981" },
          { label: "Transferencia", value: totals.countByMethod.Transferencia, color: "#8B5CF6" },
        ]} />
      </ChartCard>
    </div>
  );
}
