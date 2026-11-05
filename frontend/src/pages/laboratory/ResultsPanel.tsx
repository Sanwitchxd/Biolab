import { useMemo, useState, type FormEvent } from "react";
import { Button, Field, Input, Notice, Select, Workspace } from "../../components/ui/FormControls";
import { dateTimeLabel } from "../../utils/format";
import { openProtectedPdf } from "../../services/api";
import type { Session } from "../../services/session";
import {
  buildPayloadValues, isEditable, isOpenOrder, MAX_PDF_MB, norm, paramKind, paramLabel, paramOptions, paramRef,
  validateInputs, validatePdf, type LabService, type Order, type OrderItem, type Patient, type Sample,
} from "./data";
import type { LabStore, SaveResultInput } from "./store";
import { ErrorNote, Pill } from "./ui";
import { evaluarReferencia, FLAG_STYLE, FLAG_TEXT } from "../../utils/reference";

interface Entry { order: Order; patient: Patient; item: OrderItem; service: LabService; sample?: Sample; blocked?: string }
const keyOf = (e: { order: Order; item: OrderItem }) => `${e.order.id}|${e.item.detailId}`;

export default function ResultsPanel({ lab, session, onClose }: { lab: LabStore; session: Session; onClose: () => void }) {
  const { orders, patients } = lab;
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  // Cola de captura: estudios clínicos abiertos y aún editables (RN-03: validado = bloqueado).
  const entries = useMemo(() => {
    const list: Entry[] = [];
    orders.filter(isOpenOrder).forEach((order) => {
      const patient = patients.find((p) => p.id === order.patientId);
      if (!patient) return;
      order.items.forEach((item) => {
        if (!isEditable(item)) return;
        const sample = lab.samples.find((s) => s.orderId === order.id);
        const blocked = sample?.state === "Pendiente" ? `Muestra ${sample.id} pendiente de recepción` : sample?.state === "Con incidencia" ? `Muestra ${sample.id} con incidencia` : undefined;
        list.push({ order, patient, item, service: lab.serviceOf(item.serviceId), sample, blocked });
      });
    });
    return list.sort((a, b) => Number(!!a.blocked) - Number(!!b.blocked) || b.order.createdAt.getTime() - a.order.createdAt.getTime());
  }, [orders, patients, lab.samples]);

  const q = norm(query);
  const visible = entries.filter((e) => !q || norm(e.patient.name).includes(q) || norm(e.order.folio).includes(q) || norm(e.item.name).includes(q));
  const selected = entries.find((e) => keyOf(e) === selectedKey && !e.blocked) ?? null;

  const [error, setError] = useState("");
  const save = async (input: SaveResultInput, entry: Entry) => {
    setError("");
    try {
      await lab.saveResult(input);
      setSelectedKey(null);
      setNotice(`${entry.item.name} de ${entry.patient.name} guardado. Quedó pendiente de validación médica.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el resultado.");
    }
  };

  return (
    <Workspace title="Captura de resultados" subtitle="Los campos se generan según el estudio solicitado" onClose={onClose}>
      {notice && <Notice>{notice}</Notice>}
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <div>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Paciente, folio o estudio" className="mb-3 w-full" aria-label="Buscar estudio por capturar" />
          <div className="grid max-h-[32rem] gap-2 overflow-y-auto pr-1">
            {visible.map((e) => {
              const active = keyOf(e) === selectedKey;
              return (
                <button key={keyOf(e)} type="button" disabled={!!e.blocked} onClick={() => { setSelectedKey(keyOf(e)); setNotice(""); }}
                  className={`rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${active ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white enabled:hover:border-blue-300"}`}>
                  <p className="text-sm font-semibold text-slate-800">{e.item.name}</p>
                  <p className="text-xs text-slate-500">{e.patient.name} · {e.order.folio}</p>
                  <p className={`mt-1 text-[11px] font-medium ${e.blocked ? "text-amber-700" : e.item.result.status === "Capturado" ? "text-blue-600" : "text-slate-400"}`}>
                    {e.blocked ?? (e.item.result.status === "Capturado" ? "Capturado · editable hasta validar" : `Muestra ${e.sample?.id ?? "—"} recibida · por capturar`)}
                  </p>
                </button>
              );
            })}
            {visible.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">No hay estudios por capturar.</p>}
          </div>
        </div>

        <div className="min-w-0">
          {selected ? (
            <ResultForm key={keyOf(selected)} entry={selected} session={session} onSave={(input) => save(input, selected)} onCancel={() => setSelectedKey(null)} />
          ) : (
            <div className="flex h-full min-h-48 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              Selecciona un estudio de la lista para capturar sus resultados.<br />Las muestras pendientes o con incidencia no se pueden capturar.
            </div>
          )}
        </div>
      </div>
    </Workspace>
  );
}

function ResultForm({ entry, session, onSave, onCancel }: { entry: Entry; session: Session; onSave: (input: SaveResultInput) => void | Promise<void>; onCancel: () => void }) {
  const { order, patient, item, service } = entry;
  const initial: Record<string, string> = {};
  item.result.values.forEach((v) => { initial[v.name] = v.value; });

  const [inputs, setInputs] = useState<Record<string, string>>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [attach, setAttach] = useState(service.external || item.result.hasPdf);
  const [file, setFile] = useState<File | null>(null);
  const [existingPdf, setExistingPdf] = useState(item.result.hasPdf);
  const [fileError, setFileError] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const pickFile = (picked: File | undefined) => {
    if (!picked) return;
    const problem = validatePdf(picked);
    if (problem) { setFileError(problem); return; }
    setFileError("");
    setFile(picked);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validateInputs(service, inputs);
    setErrors(found);
    if (Object.keys(found).length > 0) { setFormError("Revisa los campos marcados."); return; }
    const hasFile = attach && (file !== null || existingPdf);
    if (service.external && !hasFile) { setFormError("Este estudio es externo: adjunta el reporte PDF del laboratorio de referencia."); return; }
    setFormError("");
    setBusy(true);
    try {
      await onSave({ detailId: item.detailId, values: buildPayloadValues(service, inputs), pdf: attach ? file : null });
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className="mb-4 rounded-xl bg-slate-50 p-4">
        <p className="font-bold text-slate-800">{service.name} <span className="font-normal text-slate-400">({service.clave})</span></p>
        <p className="text-xs text-slate-500">{patient.name} · {order.folio} · Muestra {entry.sample?.id ?? "—"}</p>
        {item.result.capturedAt && <p className="mt-1 text-[11px] text-blue-600">Capturado por {item.result.capturedBy} · {dateTimeLabel(item.result.capturedAt)}. Puedes corregirlo hasta que se valide.</p>}
      </div>

      {formError && <ErrorNote>{formError}</ErrorNote>}

      {service.params.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {service.params.map((p) => {
            const kind = paramKind(p);
            const raw = inputs[p.name] ?? "";
            const set = (value: string) => { setInputs({ ...inputs, [p.name]: value }); if (errors[p.name]) setErrors({ ...errors, [p.name]: "" }); };
            return (
              <div key={p.name}>
                <Field label={paramLabel(p)}>
                  {kind === "select" ? (
                    <Select value={raw} onChange={(e) => set(e.target.value)} aria-invalid={!!errors[p.name]}>
                      <option value="">Selecciona…</option>
                      {paramOptions(p).map((o) => <option key={o} value={o}>{o}</option>)}
                    </Select>
                  ) : (
                    <Input type={kind === "number" ? "number" : "text"} inputMode={kind === "number" ? "decimal" : undefined} step="any" min={kind === "number" ? 0 : undefined}
                      value={raw} onChange={(e) => set(e.target.value)} aria-invalid={!!errors[p.name]} />
                  )}
                </Field>
                <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-400">Ref. {paramRef(p)}{p.unit && kind === "number" && p.ref ? ` ${p.unit}` : ""}</span>
                  {errors[p.name] ? <span className="font-medium text-red-600">{errors[p.name]}</span> : (() => {
                    const f = raw.trim() ? evaluarReferencia(raw, p.ref) : "n/d";
                    return f === "n/d" ? null : <span className={`rounded-full px-2 py-0.5 font-semibold ${FLAG_STYLE[f]}`}>{FLAG_TEXT[f]}</span>;
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-xl bg-blue-50 p-4 text-sm text-blue-800">Este estudio se procesa en un laboratorio de referencia y no tiene parámetros propios. Adjunta el reporte externo para continuar.</p>
      )}

      <div className="mt-5 rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-800">Reporte externo</p>
            <p className="text-xs text-slate-500">PDF de otra clínica, hospital o laboratorio asociado, ligado al expediente del paciente.</p>
          </div>
          {!service.external && (
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600">
              <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} className="h-4 w-4 accent-blue-500" /> Adjuntar
            </label>
          )}
        </div>
        {attach && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label={`Archivo PDF (máx. ${MAX_PDF_MB} MB)`}>
              <input type="file" accept="application/pdf,.pdf" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-600" />
            </Field>
            {fileError && <p className="text-xs font-medium text-red-600 md:col-span-2">{fileError}</p>}
            {(file || existingPdf) && (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800 md:col-span-2">
                <span className="min-w-0 truncate font-semibold">{file ? `${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB (se enviará al guardar)` : "Reporte externo ya adjunto"}</span>
                <span className="flex shrink-0 items-center gap-3">
                  {!file && item.result.id !== null && (
                    <button type="button" onClick={() => { const id = item.result.id; if (id !== null) openProtectedPdf(`/laboratorio/resultados/${id}/pdf`).catch((e: unknown) => setFileError(e instanceof Error ? e.message : "No se pudo abrir el PDF.")); }} className="font-semibold underline">Ver</button>
                  )}
                  {file && <button type="button" onClick={() => setFile(null)} className="font-semibold text-red-600 hover:underline">Quitar</button>}
                </span>
              </div>
            )}
          </div>
        )}
      </div>


      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Pill className="bg-slate-100 text-slate-600">Capturista: {session.displayName}</Pill>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" disabled={busy}>Guardar y enviar a validación</Button>
        </div>
      </div>
    </form>
  );
}
