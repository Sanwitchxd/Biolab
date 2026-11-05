import { useMemo, useState } from "react";
import { Button, Field, Input, Notice, Select, Workspace } from "../../components/ui/FormControls";
import { BarChart, ChartCard } from "./charts";
import CashCharts, { bucketIncome, filterRange } from "./CashCharts";
import {
  dailyCut, dateLabel, dayKey, longDateLabel, money, moneyExact, monthKey, OPENING_HOUR, parseDayKey,
  relativeDay, summarize, timeLabel, type CashCut, type Payment, type Totals,
} from "./data";

type Tab = "today" | "range" | "history" | "charts";
const TABS: { id: Tab; label: string }[] = [
  { id: "today", label: "Hoy en tiempo real" }, { id: "range", label: "Por rango de fechas" },
  { id: "history", label: "Historial de cortes" }, { id: "charts", label: "Gráficas" },
];

function Kpi({ tone, label, value, hint }: { tone: "blue" | "emerald" | "amber" | "violet"; label: string; value: string; hint: string }) {
  const tones = { blue: "bg-blue-50 text-blue-600", emerald: "bg-emerald-50 text-emerald-600", amber: "bg-amber-50 text-amber-600", violet: "bg-violet-50 text-violet-600" };
  return (
    <div className={`rounded-xl p-5 ${tones[tone].split(" ")[0]}`}>
      <p className={`text-xs font-medium ${tones[tone].split(" ")[1]}`}>{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-800">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function MethodRow({ totals }: { totals: Totals }) {
  return (
    <div className="my-5 grid gap-3 border-y border-slate-100 py-4 text-sm sm:grid-cols-3">
      {(["Efectivo", "Tarjeta", "Transferencia"] as const).map((m) => (
        <div key={m} className="flex justify-between sm:block"><span className="text-slate-500">{m}</span><p className="font-semibold text-slate-800">{money(totals.byMethod[m])}<span className="ml-2 text-xs font-normal text-slate-400">{totals.countByMethod[m]} pagos</span></p></div>
      ))}
    </div>
  );
}

function downloadReport(cut: CashCut, payments: Payment[]) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const day = payments.filter((p) => dayKey(p.at) === cut.date && p.at.getTime() <= cut.closedAt.getTime());
  const header = [
    `Corte de caja ${cut.id}`, `Fecha,${cut.date}`, `Primer cobro,${timeLabel(cut.openedAt)}`, `Último cobro,${timeLabel(cut.closedAt)}`,
    `Ingresos totales,${cut.totals.total}`, `Pagos,${cut.totals.count}`,
    `Efectivo,${cut.totals.byMethod.Efectivo}`, `Tarjeta,${cut.totals.byMethod.Tarjeta}`, `Transferencia,${cut.totals.byMethod.Transferencia}`,
    "",
    "Hora,Folio,ID paciente,Paciente,Método,Tipo,Monto,Cajero",
  ];
  const rows = day.map((p) => [timeLabel(p.at), p.folio, p.patientId, p.patientName, p.method, p.type, p.amount, p.cashier].map((v) => esc(String(v))).join(","));
  const blob = new Blob(["\uFEFF" + [...header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${cut.id}.csv`; a.click();
  URL.revokeObjectURL(url);
}

/* -------------------------------- Panel -------------------------------- */

interface Props {
  payments: Payment[];
  cuts: CashCut[];
  now: Date;
  onClose: () => void;
}

export default function CashPanel({ payments, cuts, now, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("today");
  const [notice, setNotice] = useState("");

  const todayKey = dayKey(now);

  // Hoy: desde la apertura hasta el momento de consulta (o hasta el cierre, si ya se cerró)
  const todayPayments = useMemo(() => {
    return payments.filter((p) => dayKey(p.at) === todayKey && p.at.getTime() <= now.getTime());
  }, [payments, todayKey, now]);
  const todayTotals = useMemo(() => summarize(todayPayments), [todayPayments]);

  /* Rango */
  const [rangeMode, setRangeMode] = useState<"months" | "days">("months");
  const [fromMonth, setFromMonth] = useState(monthKey(new Date(now.getFullYear(), now.getMonth() - 2, 1)));
  const [toMonth, setToMonth] = useState(monthKey(now));
  const [fromDay, setFromDay] = useState(dayKey(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [toDay, setToDay] = useState(todayKey);

  const range = useMemo(() => {
    let from: Date, to: Date;
    if (rangeMode === "months") {
      const [fy, fm] = fromMonth.split("-").map(Number); const [ty, tm] = toMonth.split("-").map(Number);
      from = new Date(fy, fm - 1, 1); to = new Date(ty, tm, 0);
    } else { from = parseDayKey(fromDay); to = parseDayKey(toDay); }
    return { from, to, valid: from.getTime() <= to.getTime() };
  }, [rangeMode, fromMonth, toMonth, fromDay, toDay]);
  const rangePayments = useMemo(() => (range.valid ? filterRange(payments, range.from, range.to, now) : []), [payments, range, now]);
  const rangeTotals = useMemo(() => summarize(rangePayments), [rangePayments]);
  const rangeDays = range.valid ? Math.max(1, Math.round((Math.min(range.to.getTime(), now.getTime()) - range.from.getTime()) / 86400000) + 1) : 1;
  const monthlyRows = useMemo(() => {
    const rows = new Map<string, Payment[]>();
    rangePayments.forEach((p) => rows.set(monthKey(p.at), [...(rows.get(monthKey(p.at)) ?? []), p]));
    return [...rows].sort(([a], [b]) => a.localeCompare(b)).map(([k, list]) => ({ key: k, totals: summarize(list) }));
  }, [rangePayments]);
  const setPreset = (preset: "month" | "prev" | "q" | "year") => {
    setRangeMode("months");
    const y = now.getFullYear(), m = now.getMonth();
    if (preset === "month") { setFromMonth(monthKey(now)); setToMonth(monthKey(now)); }
    if (preset === "prev") { const d = new Date(y, m - 1, 1); setFromMonth(monthKey(d)); setToMonth(monthKey(d)); }
    if (preset === "q") { setFromMonth(monthKey(new Date(y, m - 2, 1))); setToMonth(monthKey(now)); }
    if (preset === "year") { setFromMonth(`${y}-01`); setToMonth(monthKey(now)); }
  };

  /* Historial */
  const [histMonth, setHistMonth] = useState("");
  const [histDay, setHistDay] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [histPage, setHistPage] = useState(1);
  const sortedCuts = useMemo(() => [...cuts].sort((a, b) => b.date.localeCompare(a.date)), [cuts]);
  const histFiltered = sortedCuts.filter((c) => (!histMonth || c.date.startsWith(histMonth)) && (!histDay || c.date === histDay));
  const histPages = Math.max(1, Math.ceil(histFiltered.length / 10));
  const histCurrent = Math.min(histPage, histPages);
  const histRows = histFiltered.slice((histCurrent - 1) * 10, histCurrent * 10);

  /* Gráficas */
  const [chartPreset, setChartPreset] = useState("30");
  const chartRange = useMemo(() => {
    const days = Number(chartPreset);
    return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1)), to: now };
  }, [chartPreset, now]);
  const chartPayments = useMemo(() => filterRange(payments, chartRange.from, chartRange.to, now), [payments, chartRange, now]);

  const hourly = useMemo(() => bucketIncome(todayPayments, now, now).data, [todayPayments, now]);
  const lastTx = [...todayPayments].reverse().slice(0, 5);

  return (
    <Workspace title="Corte de caja" subtitle={`${longDateLabel(now)} · Caja abierta`} onClose={onClose}>
      {notice && <Notice>{notice}</Notice>}

      <div className="mb-6 flex flex-wrap gap-1.5 rounded-xl bg-slate-100 p-1">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition ${tab === t.id ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{t.label}</button>
        ))}
      </div>

      {tab === "today" && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-700">● Caja abierta</span>
            <span>Apertura: {String(OPENING_HOUR).padStart(2, "0")}:00 h</span>
            <span>{`Acumulado hasta ${timeLabel(now)} h`}</span>
            <span className="text-slate-400">· se actualiza automáticamente</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Kpi tone="blue" label="Ingresos del día" value={money(todayTotals.total)} hint={`${todayTotals.count} transacciones`} />
            <Kpi tone="emerald" label="Pagos conciliados" value={money(todayTotals.reconciled)} hint={`${todayTotals.reconciledCount} confirmados`} />
            <Kpi tone="amber" label="Pendiente" value={money(todayTotals.pending)} hint={`${todayTotals.pendingCount} orden(es) por cobrar`} />
          </div>
          <MethodRow totals={todayTotals} />

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <ChartCard title="Acumulado del día por hora" subtitle="Ingresos desde la apertura hasta el momento de consulta"><BarChart data={hourly} height={150} /></ChartCard>
            <div className="rounded-xl border border-slate-100 p-5">
              <p className="mb-3 text-sm font-semibold text-slate-800">Últimos movimientos</p>
              {lastTx.length === 0 ? <p className="text-xs text-slate-400">Aún no hay cobros hoy.</p> : (
                <ul className="space-y-2.5">{lastTx.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-xs"><span className="min-w-0"><span className="block truncate font-medium text-slate-700">{p.patientName}</span><span className="text-slate-400">{timeLabel(p.at)} · {p.method} · {p.type}</span></span><span className={`font-semibold ${p.status === "Pendiente" ? "text-amber-600" : "text-slate-800"}`}>{money(p.amount)}</span></li>
                ))}</ul>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 p-5">
            <p className="text-sm font-semibold text-slate-800">Reporte del día</p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-lg text-xs text-slate-500">Los importes se calculan en vivo con los pagos registrados en la base de datos (los pagos son inmutables). Puedes descargar el reporte del día en CSV.</p>
              <Button type="button" variant="secondary" disabled={todayPayments.length === 0} onClick={() => downloadReport(dailyCut(todayKey, todayPayments), payments)}>Descargar reporte</Button>
            </div>
          </div>
          </>
      )}

      {tab === "range" && (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            {([["month", "Este mes"], ["prev", "Mes anterior"], ["q", "Últimos 3 meses"], ["year", "Año en curso"]] as const).map(([id, label]) => <Button key={id} type="button" variant="secondary" className="!px-3 !py-1.5 !text-xs" onClick={() => setPreset(id)}>{label}</Button>)}
          </div>
          <div className="mb-5 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-3">
            <Field label="Tipo de rango"><Select value={rangeMode} onChange={(e) => setRangeMode(e.target.value as "months" | "days")}><option value="months">De mes a mes</option><option value="days">De fecha a fecha</option></Select></Field>
            {rangeMode === "months" ? (
              <><Field label="Desde (mes)"><Input type="month" value={fromMonth} max={toMonth} onChange={(e) => setFromMonth(e.target.value)} /></Field><Field label="Hasta (mes)"><Input type="month" value={toMonth} min={fromMonth} max={monthKey(now)} onChange={(e) => setToMonth(e.target.value)} /></Field></>
            ) : (
              <><Field label="Desde"><Input type="date" value={fromDay} max={toDay} onChange={(e) => setFromDay(e.target.value)} /></Field><Field label="Hasta"><Input type="date" value={toDay} min={fromDay} max={todayKey} onChange={(e) => setToDay(e.target.value)} /></Field></>
            )}
          </div>
          {!range.valid ? <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">La fecha inicial debe ser anterior a la final.</p> : (
            <>
              <div className="grid gap-4 sm:grid-cols-4">
                <Kpi tone="blue" label="Ingresos totales" value={money(rangeTotals.total)} hint={`${rangeTotals.count.toLocaleString("es-MX")} transacciones`} />
                <Kpi tone="emerald" label="Conciliado" value={money(rangeTotals.reconciled)} hint={`${rangeTotals.reconciledCount.toLocaleString("es-MX")} pagos`} />
                <Kpi tone="amber" label="Pendiente" value={money(rangeTotals.pending)} hint={`${rangeTotals.pendingCount} por cobrar`} />
                <Kpi tone="violet" label="Promedio diario" value={money(rangeTotals.total / rangeDays)} hint={`${rangeDays} día(s) en el rango`} />
              </div>
              <MethodRow totals={rangeTotals} />
              <p className="mb-2 text-sm font-semibold text-slate-800">Detalle por mes</p>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Mes</th><th className="px-4 py-3 text-right">Transacciones</th><th className="px-4 py-3 text-right">Efectivo</th><th className="px-4 py-3 text-right">Tarjeta</th><th className="px-4 py-3 text-right">Transferencia</th><th className="px-4 py-3 text-right">Total</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {monthlyRows.map(({ key, totals }) => <tr key={key}><td className="px-4 py-3 font-medium capitalize text-slate-700">{parseDayKey(`${key}-01`).toLocaleDateString("es-MX", { month: "long", year: "numeric" })}</td><td className="px-4 py-3 text-right text-slate-500">{totals.count}</td><td className="px-4 py-3 text-right text-slate-600">{money(totals.byMethod.Efectivo)}</td><td className="px-4 py-3 text-right text-slate-600">{money(totals.byMethod.Tarjeta)}</td><td className="px-4 py-3 text-right text-slate-600">{money(totals.byMethod.Transferencia)}</td><td className="px-4 py-3 text-right font-semibold text-slate-800">{money(totals.total)}</td></tr>)}
                    {monthlyRows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Sin movimientos en este rango.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {tab === "history" && (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <Field label="Mes"><Input type="month" value={histMonth} max={monthKey(now)} onChange={(e) => { setHistMonth(e.target.value); setHistDay(""); setHistPage(1); }} /></Field>
            <Field label="Día específico"><Input type="date" value={histDay} max={todayKey} onChange={(e) => { setHistDay(e.target.value); setHistMonth(""); setHistPage(1); }} /></Field>
            <Button type="button" variant="secondary" onClick={() => { setHistMonth(""); setHistDay(""); setHistPage(1); }}>Ver todos</Button>
            <span className="ml-auto text-xs text-slate-500">{histFiltered.length} corte(s)</span>
          </div>
          <div className="space-y-2">
            {histRows.map((cut) => {
              const open = expanded === cut.id;
              const date = parseDayKey(cut.date);
              return (
                <div key={cut.id} className="rounded-xl border border-slate-100">
                  <button type="button" onClick={() => setExpanded(open ? null : cut.id)} className="flex w-full flex-wrap items-center gap-3 p-4 text-left transition hover:bg-slate-50">
                    <div className="w-28"><p className="text-sm font-semibold text-slate-800">{relativeDay(date, now)}</p><p className="text-xs text-slate-400">{dateLabel(date)}</p></div>
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600">{cut.id}</span>
                    <span className="ml-auto text-sm font-bold text-slate-800">{money(cut.totals.total)}</span>
                    <span className="hidden text-xs text-slate-500 sm:inline">{cut.totals.count} transacciones</span>
                    <svg className={`transition ${open ? "rotate-180" : ""}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
                  </button>
                  {open && (
                    <div className="border-t border-slate-100 bg-slate-50/60 p-4 text-sm">
                      <div className="grid gap-3 sm:grid-cols-4">
                        <div><p className="text-xs text-slate-500">Conciliado</p><p className="font-semibold text-emerald-700">{money(cut.totals.reconciled)}</p></div>
                        <div><p className="text-xs text-slate-500">Pendiente</p><p className="font-semibold text-amber-700">{money(cut.totals.pending)}</p></div>
                        <div><p className="text-xs text-slate-500">Primer → último cobro</p><p className="font-semibold text-slate-700">{timeLabel(cut.openedAt)} → {timeLabel(cut.closedAt)}</p></div>
                        <div><p className="text-xs text-slate-500">Transacciones</p><p className="font-semibold text-slate-700">{cut.totals.count}</p></div>
                      </div>
                      <MethodRow totals={cut.totals} />
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                        <span>Efectivo cobrado: {moneyExact(cut.totals.byMethod.Efectivo)}</span>
                        <Button type="button" variant="secondary" className="!px-3 !py-1.5 !text-xs" onClick={() => downloadReport(cut, payments)}>Descargar reporte</Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {histRows.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">No hay cortes para este filtro.</p>}
          </div>
          {histPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500"><span>Página {histCurrent} de {histPages}</span><div className="flex gap-2"><Button type="button" variant="secondary" disabled={histCurrent === 1} onClick={() => setHistPage(histCurrent - 1)}>Anterior</Button><Button type="button" variant="secondary" disabled={histCurrent === histPages} onClick={() => setHistPage(histCurrent + 1)}>Siguiente</Button></div></div>
          )}
        </>
      )}

      {tab === "charts" && (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <Field label="Periodo a graficar"><Select value={chartPreset} onChange={(e) => setChartPreset(e.target.value)}><option value="1">Hoy (por hora)</option><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option><option value="365">Últimos 12 meses</option></Select></Field>
            <p className="pb-2 text-xs text-slate-400">{dateLabel(chartRange.from)} → {dateLabel(chartRange.to)} · {money(summarize(chartPayments).total)} en {chartPayments.length.toLocaleString("es-MX")} pagos</p>
          </div>
          <CashCharts payments={chartPayments} from={chartRange.from} to={chartRange.to} />
        </>
      )}

          </Workspace>
  );
}
