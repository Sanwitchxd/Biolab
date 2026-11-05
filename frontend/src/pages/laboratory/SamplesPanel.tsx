import { useMemo, useState } from "react";
import { Button, Field, Input, Notice, Workspace } from "../../components/ui/FormControls";
import { dateTimeLabel, dayKey, timeLabel } from "../../utils/format";
import { norm, SAMPLE_VIEWS, VIEW_STYLE, viewStatus, type Order, type Patient, type Sample, type SampleView } from "./data";
import type { LabStore } from "./store";
import { ALERT_STYLE, Pill } from "./ui";

interface Row { sample: Sample; order: Order; patient: Patient; view: SampleView }

const MAX_ROWS = 40;

export default function SamplesPanel({ lab, onReport, onClose }: { lab: LabStore; onReport: (sampleId: string) => void; onClose: () => void }) {
  const { samples, alerts } = lab;
  const { orders, patients } = lab;
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<SampleView | "Todas">("Todas");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const run = async (action: () => Promise<void>, done: string) => {
    setError(""); setNotice("");
    try { await action(); setNotice(done); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo completar la operación."); }
  };

  // Historial reciente: más nuevas primero.
  const rows = useMemo(() => {
    const list: Row[] = [];
    samples.forEach((sample) => {
      const order = orders.find((o) => o.id === sample.orderId);
      const patient = order ? patients.find((p) => p.id === order.patientId) : undefined;
      if (order && patient) list.push({ sample, order, patient, view: viewStatus(sample, order) });
    });
    return list.sort((a, b) => b.order.createdAt.getTime() - a.order.createdAt.getTime() || b.sample.id.localeCompare(a.sample.id));
  }, [samples, orders, patients]);

  // Filtros dinámicos: se aplican mientras se escribe, sin botón de "buscar".
  const byText = rows.filter((r) => {
    const q = norm(query);
    const day = dayKey(r.order.createdAt);
    return (!q || norm(r.patient.name).includes(q) || norm(r.sample.id).includes(q) || norm(r.order.folio).includes(q)) && (!from || day >= from) && (!to || day <= to);
  });
  const visible = byText.filter((r) => status === "Todas" || r.view === status);
  const count = (view: SampleView) => byText.filter((r) => r.view === view).length;
  const filtering = query || from || to || status !== "Todas";
  const clear = () => { setQuery(""); setFrom(""); setTo(""); setStatus("Todas"); };

  return (
    <Workspace title="Recepción de muestras" subtitle="Historial reciente, avisos y trazabilidad de muestras por paciente, fecha y estatus" onClose={onClose}>
      {notice && <Notice>{notice}</Notice>}
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</p>}

      {alerts.length > 0 && (
        <div className="mb-5 grid gap-2 md:grid-cols-2">
          {alerts.map((a) => (
            <div key={a.id} className={`rounded-xl border px-4 py-3 ${ALERT_STYLE[a.tone]}`}>
              <p className="text-sm font-semibold">{a.title}</p>
              <p className="mt-0.5 text-xs opacity-80">{a.body}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-3 grid gap-3 md:grid-cols-[1fr_160px_160px]">
        <Field label="Paciente, folio de muestra u orden"><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ana Martínez, M-8831 o LMT-…" autoFocus /></Field>
        <Field label="Registrada desde"><Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Hasta"><Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por estatus">
        {(["Todas", ...SAMPLE_VIEWS] as const).map((view) => {
          const n = view === "Todas" ? byText.length : count(view);
          const active = status === view;
          return (
            <button key={view} type="button" aria-pressed={active} onClick={() => setStatus(view)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${active ? "border-blue-500 bg-blue-500 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
              {view} <span className={active ? "text-blue-100" : "text-slate-400"}>{n}</span>
            </button>
          );
        })}
        {filtering && <button type="button" onClick={clear} className="ml-auto text-xs font-semibold text-blue-600 hover:underline">Limpiar filtros</button>}
      </div>

      <div className="grid gap-3">
        {visible.slice(0, MAX_ROWS).map(({ sample, order, patient, view }) => (
          <div key={sample.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="min-w-0">
              <p className="font-semibold text-slate-800">{patient.name}</p>
              <p className="text-xs text-slate-500">
                {sample.id} · {order.folio} · Registrada {dateTimeLabel(order.createdAt)}
                {sample.receivedAt && ` · Recibida ${timeLabel(sample.receivedAt)}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Pill className={VIEW_STYLE[view]}>{view}</Pill>
              {view === "Pendiente" && <Button type="button" className="!px-3 !py-1.5 !text-xs" onClick={() => run(() => lab.receiveSample(sample.id), `Muestra ${sample.id} de ${patient.name} recibida en laboratorio.`)}>Recibir muestra</Button>}
              {view === "Con incidencia" && <Button type="button" variant="secondary" className="!px-3 !py-1.5 !text-xs" onClick={() => run(() => lab.markRetaken(sample.id), `Muestra ${sample.id}: nueva toma registrada, queda pendiente de recepción.`)}>Nueva toma lista</Button>}
              {(view === "Pendiente" || view === "Recibida" || view === "En proceso") && <Button type="button" variant="danger" className="!px-3 !py-1.5 !text-xs" onClick={() => onReport(sample.id)}>Reportar incidencia</Button>}
            </div>
          </div>
        ))}
        {visible.length === 0 && <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">No hay muestras con esos filtros.</p>}
      </div>
      {visible.length > MAX_ROWS && <p className="mt-3 text-center text-xs text-slate-400">Mostrando las {MAX_ROWS} más recientes de {visible.length}. Afina los filtros para ver el resto.</p>}
    </Workspace>
  );
}
