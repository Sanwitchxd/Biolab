import { useMemo, useState, type FormEvent } from "react";
import { Button, Field, Input, Notice, Select, Textarea, Workspace } from "../../components/ui/FormControls";
import { dateTimeLabel } from "../../utils/format";
import type { Session } from "../../services/session";
import { INCIDENT_TYPES, isOpenOrder, norm, viewStatus, VIEW_STYLE, type IncidentType } from "./data";
import type { LabStore } from "./store";
import { ErrorNote, Pill } from "./ui";

export default function IncidentsPanel({ lab, session, prefillSampleId, onClose }: {
  lab: LabStore; session: Session; prefillSampleId?: string | null; onClose: () => void;
}) {
  const { samples, incidents } = lab;
  const { orders, patients } = lab;
  const [sampleId, setSampleId] = useState(prefillSampleId ?? "");
  const [type, setType] = useState<IncidentType>("Dañada");
  const [busy, setBusy] = useState(false);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const patientOf = (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    return { order, patient: order ? patients.find((p) => p.id === order.patientId) : undefined };
  };
  const matched = samples.find((s) => s.id.toLowerCase() === sampleId.trim().toLowerCase());
  const matchedInfo = matched ? patientOf(matched.orderId) : null;
  // Lista corta: solo muestras de órdenes abiertas (no entregadas ni canceladas), las más recientes primero.
  const MAX_LIST = 8;
  const options = useMemo(() => samples
    .map((s) => ({ s, o: orders.find((x) => x.id === s.orderId) }))
    .filter((x): x is { s: typeof x.s; o: NonNullable<typeof x.o> } => !!x.o && isOpenOrder(x.o))
    .sort((a, b) => b.o.createdAt.getTime() - a.o.createdAt.getTime() || b.s.dbId - a.s.dbId)
    .map(({ s, o }) => ({ sample: s, order: o, patient: patients.find((p) => p.id === o.patientId), view: viewStatus(s, o) })), [samples, orders, patients]);
  const q = norm(sampleId);
  const filtered = options.filter((x) => !q || norm(x.sample.id).includes(q) || norm(x.order.folio).includes(q) || norm(x.patient?.name ?? "").includes(q));
  const [listOpen, setListOpen] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setNotice("");
    setBusy(true);
    // Solo se envían los campos del formulario: el responsable lo resuelve el servidor con la sesión activa.
    const result = await lab.registerIncident({ sampleId, type, description });
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    setError("");
    setNotice(`Incidencia ${result.incident.id} registrada a nombre de ${result.incident.reportedBy}. Se envió una alerta de retoma a Recepción.`);
    setSampleId(""); setDescription(""); setType("Dañada");
  };

  return (
    <Workspace title="Registro de incidencias" subtitle="Documenta una anomalía en la muestra para mantener la trazabilidad" onClose={onClose}>
      {notice && <Notice>{notice}</Notice>}
      {error && <ErrorNote>{error}</ErrorNote>}

      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        <div className="relative">
          <Field label="Folio de muestra">
            <Input required value={sampleId} onChange={(e) => { setSampleId(e.target.value); setError(""); setListOpen(true); }} onFocus={() => setListOpen(true)}
              onBlur={() => setTimeout(() => setListOpen(false), 150)} role="combobox" aria-expanded={listOpen} aria-controls="lab-sample-list"
              placeholder="Busca por folio (M-12), paciente u orden" autoComplete="off" />
          </Field>
          {listOpen && (
            <ul id="lab-sample-list" role="listbox" className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
              {filtered.slice(0, MAX_LIST).map(({ sample, order, patient, view }) => (
                <li key={sample.id} role="option" aria-selected={sample.id === sampleId}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setSampleId(sample.id); setListOpen(false); setError(""); }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-blue-50">
                    <span className="text-sm font-semibold text-blue-600">{sample.id}</span>
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-600">{patient?.name ?? "—"} · {order.folio}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${VIEW_STYLE[view]}`}>{view}</span>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && <li className="px-3 py-3 text-xs text-slate-500">No hay muestras activas con “{sampleId}”.</li>}
              {filtered.length > MAX_LIST && <li className="px-3 py-2 text-[11px] text-slate-400">Mostrando las {MAX_LIST} más recientes de {filtered.length}. Sigue escribiendo para acotar.</li>}
            </ul>
          )}
          <p className={`mt-1.5 text-[11px] ${matched ? "text-emerald-600" : "text-slate-400"}`}>
            {matched && matchedInfo?.patient ? `${matchedInfo.patient.name} · ${matchedInfo.order?.folio}` : sampleId.trim() && !listOpen ? "No se encontró ninguna muestra con ese folio." : "Solo aparecen muestras de órdenes abiertas (sin entregar), las más recientes primero."}
          </p>
        </div>

        <Field label="Responsable">
          <Input value={session.displayName} readOnly disabled aria-describedby="responsable-hint" className="cursor-not-allowed !bg-slate-100 !text-slate-500" />
          <span id="responsable-hint" className="text-[11px] font-normal text-slate-400">Se asigna automáticamente con tu sesión activa.</span>
        </Field>

        <Field label="Tipo de incidencia">
          <Select value={type} onChange={(e) => setType(e.target.value as IncidentType)}>
            {INCIDENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>

        <div className="flex items-end pb-1 text-[11px] text-slate-400">Toda incidencia invalida la muestra: se solicita nueva toma y se alerta a Recepción.</div>

        <div className="md:col-span-2">
          <Field label="Descripción y acción tomada">
            <Textarea required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe lo ocurrido y las medidas aplicadas..." />
          </Field>
        </div>

        <div className="flex justify-end md:col-span-2"><Button type="submit" disabled={busy}>Guardar incidencia</Button></div>
      </form>

      <div className="mt-8 border-t border-slate-100 pt-5">
        <h3 className="mb-3 text-sm font-bold text-slate-800">Incidencias recientes</h3>
        {incidents.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Aún no hay incidencias registradas.</p>
        ) : (
          <div className="grid gap-2">
            {incidents.slice(0, 8).map((inc) => {
              const sample = samples.find((s) => s.id === inc.sampleId);
              const info = sample ? patientOf(sample.orderId) : null;
              return (
                <div key={inc.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{inc.id} · {inc.sampleId} · {inc.type}{info?.patient && ` · ${info.patient.name}`}</p>
                    <p className="mt-0.5 text-xs text-slate-600">{inc.description}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{inc.reportedBy} · {dateTimeLabel(inc.at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Workspace>
  );
}
