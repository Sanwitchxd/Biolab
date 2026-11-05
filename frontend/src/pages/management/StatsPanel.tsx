import { useMemo, useState } from "react";
import { Field, Select, Workspace } from "../../components/ui/FormControls";
import { BarChart, ChartCard, DonutChart } from "./charts";
import CashCharts, { filterRange } from "./CashCharts";
import { dateLabel, dayKey, money, summarize, type Payment, type StudyCount } from "./data";

interface Props { payments: Payment[]; studies: StudyCount[]; now: Date; onClose: () => void }

const COLORS = ["#3B82F6", "#EF4444", "#F59E0B", "#8B5CF6", "#06B6D4", "#94A3B8"];

export default function StatsPanel({ payments, studies, now, onClose }: Props) {
  const [days, setDays] = useState("30");
  const from = useMemo(() => new Date(now.getFullYear(), now.getMonth(), now.getDate() - (Number(days) - 1)), [days, now]);
  const prevFrom = useMemo(() => new Date(from.getFullYear(), from.getMonth(), from.getDate() - Number(days)), [from, days]);
  const prevTo = useMemo(() => new Date(from.getFullYear(), from.getMonth(), from.getDate() - 1), [from]);

  const current = useMemo(() => filterRange(payments, from, now, now), [payments, from, now]);
  const previous = useMemo(() => filterRange(payments, prevFrom, prevTo, now), [payments, prevFrom, prevTo, now]);
  const t = useMemo(() => summarize(current), [current]);
  const p = useMemo(() => summarize(previous), [previous]);

  const delta = (a: number, b: number) => (b === 0 ? null : ((a - b) / b) * 100);
  const inPeriod = (list: StudyCount[], a: Date, b: Date) => list.filter((s) => s.day >= dayKey(a) && s.day <= dayKey(b));
  const curStudies = inPeriod(studies, from, now);
  const prevStudies = inPeriod(studies, prevFrom, prevTo);
  const studyTotal = curStudies.reduce((n, s) => n + s.count, 0);
  const prevStudyTotal = prevStudies.reduce((n, s) => n + s.count, 0);
  const kpis = [
    { label: "Ingresos del periodo", value: money(t.total), d: delta(t.total, p.total) },
    { label: "Estudios solicitados", value: studyTotal.toLocaleString("es-MX"), d: delta(studyTotal, prevStudyTotal) },
    { label: "Ticket promedio", value: money(t.count ? t.total / t.count : 0), d: delta(t.count ? t.total / t.count : 0, p.count ? p.total / p.count : 0) },
    { label: "Pagos registrados", value: t.count.toLocaleString("es-MX"), d: delta(t.count, p.count) },
  ];

  const byStudy = new Map<string, number>();
  curStudies.forEach((s) => byStudy.set(s.study, (byStudy.get(s.study) ?? 0) + s.count));
  const ranked = [...byStudy].sort((x, y) => y[1] - x[1]);
  const top = ranked.slice(0, 5).map(([label, value], i) => ({ label, value, color: COLORS[i] }));
  const rest = ranked.slice(5).reduce((n, [, v]) => n + v, 0);
  const areaData = rest > 0 ? [...top, { label: "Otros", value: rest, color: COLORS[5] }] : top;
  const weekday = ["D", "L", "M", "X", "J", "V", "S"].map((label, i) => ({ label, value: current.filter((x) => x.at.getDay() === i).length }));

  return (
    <Workspace title="Estadísticas globales" subtitle={`Rendimiento consolidado · ${dateLabel(from)} → ${dateLabel(now)} · vinculado al corte de caja`} onClose={onClose}>
      <div className="mb-5"><Field label="Periodo"><Select value={days} onChange={(e) => setDays(e.target.value)} className="w-56"><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option><option value="365">Últimos 12 meses</option></Select></Field></div>

      <div className="grid gap-4 sm:grid-cols-4">
        {kpis.map(({ label, value, d }) => (
          <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-2xl font-bold text-slate-800">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{label}</p>
            <p className={`mt-3 text-xs font-semibold ${d === null ? "text-slate-400" : d >= 0 ? "text-emerald-600" : "text-red-500"}`}>{d === null ? "Sin periodo previo" : `${d >= 0 ? "+" : ""}${d.toFixed(1)}% vs. periodo anterior`}</p>
          </div>
        ))}
      </div>

      <h3 className="mb-3 mt-7 text-xs font-bold uppercase tracking-wide text-slate-500">Ingresos y caja</h3>
      <CashCharts payments={current} from={from} to={now} />

      <h3 className="mb-3 mt-7 text-xs font-bold uppercase tracking-wide text-slate-500">Operación del laboratorio</h3>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Estudios más solicitados" subtitle="Distribución de estudios en órdenes no canceladas"><DonutChart data={areaData} centerLabel="Estudios" formatValue={(v) => v.toLocaleString("es-MX")} /></ChartCard>
        <ChartCard title="Afluencia por día de la semana" subtitle="Pagos registrados en el periodo"><BarChart data={weekday} formatValue={(v) => `${v} pagos`} color="#818CF8" /></ChartCard>
      </div>
    </Workspace>
  );
}
