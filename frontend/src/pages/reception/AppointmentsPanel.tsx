import { useMemo, useState } from "react";
import { Button, Field, Input, Select, Textarea, Workspace } from "../../components/ui/FormControls";
import TypeChips, { countByType, type TypeFilter } from "../../components/ui/TypeChips";
import { dateTimeLabel, dayKey, moneyExact, pad } from "../../utils/format";
import { nameError, norm, onlyDigits, phoneError, squash, studyType, STUDY_TYPE_STYLE } from "../../utils/validation";
import {
  CLOSE_HOUR, MAX_POR_HORA, OPEN_HOUR, digits, formatPhone,
  type Order, type Patient, type Payment, type PayMethod,
} from "./data";
import type { ReceptionStore } from "./store";
import TicketModal from "./Ticket";

const PREP_PRESETS = [
  "Acude en ayuno de 8 a 12 horas. Solo puedes tomar agua natural.",
  "No tomes agua ni alimentos desde las 12 de la noche.",
  "No realices ejercicio intenso 24 horas antes del estudio.",
  "Evita alimentos grasosos y alcohol 24 horas antes.",
  "Recolecta la primera orina de la mañana en el frasco que te entregamos.",
  "Trae tu identificación oficial y tu orden médica.",
];
const toLocalInput = (d: Date) => `${dayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
/** RF-01: por defecto, el día anterior a la cita a las 17:00. */
function defaultRemindAt(date: string, time: string): string {
  if (!date) return "";
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = (time || "08:00").split(":").map(Number);
  const cita = new Date(y, m - 1, d, h, mi);
  const r = new Date(cita.getFullYear(), cita.getMonth(), cita.getDate() - 1, 17, 0);
  return toLocalInput(r);
}
interface Props { store: ReceptionStore; onViewPatient: (id: string) => void; onClose: () => void }

export default function AppointmentsPanel({ store, onViewPatient, onClose }: Props) {
  const { patients, orders, payments, services } = store;
  const serviceById = (id: string) => services.find((s) => s.id === id);
  const today = dayKey(new Date());
  const maxDate = dayKey(new Date(Date.now() + 365 * 86_400_000));
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [svcQuery, setSvcQuery] = useState("");
  const [svcType, setSvcType] = useState<TypeFilter>("Todos");
  const [abono, setAbono] = useState("");
  const [method, setMethod] = useState<PayMethod>("Efectivo");
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ order: Order; patient: Patient; payment: Payment | null } | null>(null);
  const [showTicket, setShowTicket] = useState(false);
  const [saving, setSaving] = useState(false);
  // Avisos por WhatsApp (solo si el paciente los autoriza)
  const [needsPrep, setNeedsPrep] = useState(false);
  const [prep, setPrep] = useState("");
  const [remind, setRemind] = useState(true);
  const [remindAtEdited, setRemindAtEdited] = useState<string | null>(null);
  const [resultsNotice, setResultsNotice] = useState(true);
  const remindAt = remindAtEdited ?? defaultRemindAt(date, time);

  const total = useMemo(() => Math.round(serviceIds.reduce((s, id) => s + (serviceById(id)?.price ?? 0), 0) * 100) / 100, [serviceIds, services]); // calculado, no editable
  const phoneDigits = digits(phone);
  const hasPhone = phoneDigits.length === 10; // WhatsApp solo tiene sentido con un teléfono completo
  const canWhatsapp = hasPhone && whatsapp;
  const abonoNum = abono === "" ? 0 : Number(abono);
  const saldo = Math.max(0, total - abonoNum);
  const existing = patients.find((p) => norm(p.name) === norm(name));

  const onNameChange = (value: string) => {
    setName(value);
    const match = patients.find((p) => norm(p.name) === norm(value));
    if (match) { setPhone(digits(match.phone)); setWhatsapp(match.whatsapp && digits(match.phone).length === 10); }
  };

  const onPhoneChange = (value: string) => {
    const d = onlyDigits(value, 10);
    setPhone(d);
    if (d.length !== 10) setWhatsapp(false); // sin teléfono completo no hay WhatsApp
  };

  const setNow = () => {
    const d = new Date();
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
    if (d.getHours() < OPEN_HOUR) d.setHours(OPEN_HOUR, 0, 0, 0);
    setDate(dayKey(d)); setTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`); setRemindAtEdited(null);
  };
  const setTomorrow = () => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    setDate(dayKey(d)); if (!time) setTime(`${pad(OPEN_HOUR + 1)}:00`); setRemindAtEdited(null);
  };

  const addService = (id: string) => {
    if (!id) return;
    if (!serviceIds.includes(id)) {
      setServiceIds([...serviceIds, id]);
    }
  };

  const reset = () => {
    setNeedsPrep(false); setPrep(""); setRemind(true); setRemindAtEdited(null); setResultsNotice(true);
    setName(""); setPhone(""); setWhatsapp(false); setDate(""); setTime(""); setServiceIds([]); setSvcQuery(""); setSvcType("Todos"); setAbono(""); setMethod("Efectivo"); setError(""); setDone(null); setShowTicket(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const nErr = nameError(name, "El nombre del paciente");
    if (nErr) return setError(nErr);
    const pErr = phoneError(phoneDigits);
    if (pErr) return setError(pErr);
    if (!date || !time) return setError("Indica la fecha y la hora de la cita.");
    if (serviceIds.length === 0) return setError("Agrega al menos un servicio.");
    const [h, m] = time.split(":").map(Number);
    if (h < OPEN_HOUR || h > CLOSE_HOUR || (h === CLOSE_HOUR && m > 0)) return setError(`El horario de atención es de ${pad(OPEN_HOUR)}:00 a ${pad(CLOSE_HOUR)}:00 h.`);
    const [y, mo, d] = date.split("-").map(Number);
    const appointmentAt = new Date(y, mo - 1, d, h, m);
    if (appointmentAt.getTime() < Date.now()) return setError("La fecha y hora de la cita no pueden estar en el pasado.");
    // Mejor práctica: evitar sobrecupo por destino/hora y citas duplicadas del mismo paciente.
    const active = orders.filter((o) => o.status !== "Cancelada" && o.appointmentAt);
    const sameSlot = active.filter((o) => o.appointmentAt!.toDateString() === appointmentAt.toDateString() && o.appointmentAt!.getHours() === h);
    if (sameSlot.length >= MAX_POR_HORA) return setError(`El horario de las ${pad(h)}:00 h está saturado (máx. ${MAX_POR_HORA} citas). Elige otra hora.`);
    if (existing && sameSlot.some((o) => o.patientId === existing.id)) return setError("Este paciente ya tiene una cita en ese mismo horario.");
    const prepText = canWhatsapp && needsPrep ? prep.trim() : "";
    if (canWhatsapp && needsPrep && prepText.length < 5) return setError("Escribe las indicaciones de preparación para el paciente (mínimo 5 caracteres).");
    let remindDate: Date | null = null;
    if (canWhatsapp && remind && prepText) {
      remindDate = new Date(remindAt);
      if (Number.isNaN(remindDate.getTime())) return setError("Indica cuándo enviar el recordatorio por WhatsApp.");
      if (remindDate.getTime() >= appointmentAt.getTime()) return setError("El recordatorio debe enviarse antes de la hora de la cita.");
    }
    if (!Number.isFinite(abonoNum) || abonoNum < 0) return setError("El abono no es válido.");
    if (Math.round(abonoNum * 100) / 100 !== abonoNum) return setError("El abono solo admite hasta 2 decimales.");
    if (abonoNum > total) return setError("El abono no puede exceder el costo total.");
    setSaving(true);
    try {
      setDone(await store.createAppointment({ name: squash(name), phone: phoneDigits, whatsapp: canWhatsapp, appointmentAt, serviceIds, abono: abonoNum, method, prep: prepText, remind: canWhatsapp && remind, remindAt: remindDate, resultsNotice: canWhatsapp && resultsNotice }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la cita.");
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    const doneTotal = done.order.items.reduce((s, i) => s + i.price, 0);
    const livePayment = done.payment ? payments.find((p) => p.id === done.payment!.id) ?? done.payment : null;
    return (
      <Workspace title="Cita agendada" subtitle="La orden quedó registrada en el sistema" onClose={onClose}>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Folio de la orden</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{done.order.folio}</p>
          <p className="mt-1 text-sm text-slate-600">{done.patient.name} · ID {done.patient.id} · {done.order.appointmentAt && dateTimeLabel(done.order.appointmentAt)}</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Costo total</p><p className="text-lg font-bold text-slate-800">{moneyExact(doneTotal)}</p></div>
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Abono recibido</p><p className="text-lg font-bold text-emerald-700">{moneyExact(done.payment?.amount ?? 0)}</p></div>
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Saldo pendiente</p><p className="text-lg font-bold text-amber-700">{moneyExact(doneTotal - (done.payment?.amount ?? 0))}</p></div>
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 p-4 text-xs text-slate-600">
          <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">Avisos al paciente</p>
          {done.order.notify === "WhatsApp" ? (
            <ul className="list-inside list-disc space-y-0.5">
              <li>{done.order.remind ? (done.order.prep && done.order.remindAt ? `Recordatorio con indicaciones por WhatsApp el ${dateTimeLabel(done.order.remindAt)}.` : "Recordatorio por WhatsApp un día antes de la cita, a las 17:00 h.") : "Sin recordatorio por WhatsApp."}</li>
              <li>{done.order.resultsNotice ? "Se le avisará por WhatsApp cuando sus resultados estén validados." : "No se le avisará por WhatsApp de sus resultados: entregar el aviso en físico."}</li>
              {done.order.prep && <li>Preparación indicada: {done.order.prep}</li>}
            </ul>
          ) : <p>El paciente no cuenta con WhatsApp: los avisos se entregarán de forma física en sucursal.</p>}
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => onViewPatient(done.patient.id)}>Ver paciente</Button>
          {livePayment && <Button type="button" variant="secondary" onClick={() => setShowTicket(true)}>Ver comprobante del abono</Button>}
          <Button type="button" onClick={reset}>Nueva cita</Button>
        </div>
        {showTicket && livePayment && <TicketModal payment={livePayment} order={done.order} patient={done.patient} payments={payments} onClose={() => setShowTicket(false)} />}
      </Workspace>
    );
  }

  const availableServices = services.filter((s) => !serviceIds.includes(s.id));
  const typeOfService = (s: (typeof services)[number]) => studyType(s.clave, s.name, s.external);
  const svcCounts = countByType(availableServices, typeOfService);
  const filteredServices = availableServices.filter((s) => (svcType === "Todos" || typeOfService(s) === svcType) && (!svcQuery.trim() || norm(`${s.clave} ${s.name}`).includes(norm(svcQuery))));

  return (
    <Workspace title="Nueva cita" subtitle="Completa los datos de programación y el cobro inicial" onClose={onClose}>
      {error && <div role="alert" className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</div>}
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        <Field label="Nombre del paciente">
          <Input required list="known-patients" value={name} minLength={3} maxLength={100} onChange={(e) => onNameChange(e.target.value)} placeholder="Nombre completo" autoComplete="off" />
          <datalist id="known-patients">{patients.map((p) => <option key={p.id} value={p.name}>{p.id}</option>)}</datalist>
          {existing && <span className="text-[11px] font-normal text-emerald-600">Paciente registrado · ID {existing.id}</span>}
          {!existing && name.trim() !== "" && nameError(name, "El nombre") && <span className="text-[11px] font-normal text-red-500">{nameError(name, "El nombre")}</span>}
        </Field>
        <Field label="Teléfono (opcional)">
          <Input type="tel" inputMode="numeric" autoComplete="off" value={phone} maxLength={10} pattern="\d{10}" onChange={(e) => onPhoneChange(e.target.value)} placeholder="10 dígitos, ej. 7351234567" />
          <span className={`text-[11px] font-normal ${phoneError(phoneDigits) ? "text-amber-600" : "text-slate-400"}`}>
            {phoneDigits.length === 0 ? "Si el paciente no tiene teléfono, déjalo vacío: los avisos serán en físico." : phoneError(phoneDigits) || "Teléfono completo ✓"}
            {phoneDigits.length > 0 && phoneDigits.length < 10 ? ` (${phoneDigits.length}/10)` : ""}
          </span>
        </Field>
        <Field label="Fecha de la cita"><Input required type="date" min={today} max={maxDate} value={date} onChange={(e) => { setDate(e.target.value); setRemindAtEdited(null); }} /></Field>
        <Field label="Hora de la cita"><Input required type="time" min={`${pad(OPEN_HOUR)}:00`} max={`${pad(CLOSE_HOUR)}:00`} step={900} value={time} onChange={(e) => { setTime(e.target.value); setRemindAtEdited(null); }} /></Field>
        <div className="-mt-2 flex flex-wrap items-center gap-2 text-xs md:col-span-2">
          <span className="text-slate-400">Atajos:</span>
          <button type="button" onClick={setNow} className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-600 hover:border-blue-300 hover:text-blue-600">Ahora (próximo cuarto de hora)</button>
          <button type="button" onClick={setTomorrow} className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-600 hover:border-blue-300 hover:text-blue-600">Mañana</button>
          <span className="text-slate-400">Horario de atención {pad(OPEN_HOUR)}:00 – {pad(CLOSE_HOUR)}:00 h</span>
        </div>

        <div className="md:col-span-2">
          <p className="mb-1.5 text-xs font-semibold text-slate-600">Estudios solicitados</p>
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="mb-2 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
              <Input aria-label="Buscar estudio" value={svcQuery} onChange={(e) => setSvcQuery(e.target.value)} placeholder="Buscar por nombre o clave (ej. glucosa, EGO, perfil)…" />
              <TypeChips value={svcType} onChange={setSvcType} counts={svcCounts} />
            </div>
            <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-100" aria-label="Estudios disponibles">
              {filteredServices.map((s) => { const t = studyType(s.clave, s.name, s.external); return (
                <li key={s.id}>
                  <button type="button" onClick={() => addService(s.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-blue-50 focus:bg-blue-50 focus:outline-none">
                    <span className="w-14 shrink-0 text-[11px] font-semibold text-blue-600">{s.clave}</span>
                    <span className="flex-1 text-slate-700">{s.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STUDY_TYPE_STYLE[t]}`}>{t}</span>
                    <span className="w-20 shrink-0 text-right font-semibold text-slate-800">{moneyExact(s.price)}</span>
                    <span className="text-xs font-semibold text-blue-600">+ Agregar</span>
                  </button>
                </li>
              ); })}
              {filteredServices.length === 0 && <li className="px-3 py-6 text-center text-xs text-slate-400">{availableServices.length === 0 ? "Ya agregaste todos los estudios disponibles." : "Ningún estudio coincide con la búsqueda o el filtro."}</li>}
            </ul>
          </div>
          {serviceIds.length > 0 && (
            <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
              {serviceIds.map((id) => { const s = serviceById(id); if (!s) return null; return (
                <li key={id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-600">{s.clave}</span>
                  <span className="flex-1 text-slate-700">{s.name}<span className="ml-2 text-xs text-slate-400">{studyType(s.clave, s.name, s.external)}</span></span>
                  <span className="font-semibold text-slate-800" title="Precio fijo definido por Gerencia">{moneyExact(s.price)}</span>
                  <button type="button" aria-label={`Quitar ${s.name}`} onClick={() => setServiceIds(serviceIds.filter((x) => x !== id))} className="text-slate-400 hover:text-red-500">✕</button>
                </li>
              ); })}
            </ul>
          )}
        </div>

        {hasPhone ? (
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm md:col-span-2">
            <input type="checkbox" checked={whatsapp} onChange={(e) => setWhatsapp(e.target.checked)} className="mt-0.5 h-4 w-4" />
            <span><span className="font-semibold text-slate-700">El paciente cuenta con WhatsApp y autoriza recibir notificaciones por ese medio</span><span className="mt-0.5 block text-xs text-slate-500">Recordatorios de cita y aviso de resultados al {formatPhone(phoneDigits)}. Si no se marca, los avisos serán en físico.</span></span>
          </label>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-xs text-slate-500 md:col-span-2">Sin teléfono completo no se ofrecen avisos por WhatsApp: los avisos de este paciente se entregarán en físico en sucursal.</p>
        )}

        {canWhatsapp && (
          <fieldset className="grid gap-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 md:col-span-2">
            <legend className="px-2 text-xs font-bold uppercase tracking-wide text-emerald-700">Avisos por WhatsApp</legend>

            <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700">
              <input type="checkbox" checked={needsPrep} onChange={(e) => setNeedsPrep(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
              <span><span className="font-semibold">El paciente necesita preparación previa</span><span className="block text-xs text-slate-500">Ayuno, no tomar agua, recolectar muestra, etc. Se le enviará por WhatsApp.</span></span>
            </label>
            {needsPrep && (
              <div className="grid gap-3">
                <Field label="Indicaciones que recibirá el paciente">
                  <Textarea value={prep} maxLength={500} onChange={(e) => setPrep(e.target.value)} placeholder="Ej. No tomes agua ni alimentos 8 horas antes de tu cita." />
                </Field>
                <div className="flex flex-wrap gap-2">
                  {PREP_PRESETS.map((t) => (
                    <button key={t} type="button" onClick={() => setPrep((cur) => (cur.trim() ? `${cur.trim()} ${t}` : t).slice(0, 500))} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600 hover:border-emerald-400 hover:text-emerald-700">+ {t}</button>
                  ))}
                </div>
              </div>
            )}

            <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700">
              <input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
              <span><span className="font-semibold">El paciente acepta un recordatorio por WhatsApp antes de su cita</span><span className="block text-xs text-slate-500">{needsPrep && prep.trim() ? "Se envía el mensaje de preparación a la hora que elijas." : "Se envía automáticamente el día anterior a las 17:00 h con las indicaciones de la orden."}</span></span>
            </label>
            {remind && needsPrep && prep.trim() && (
              <div className="max-w-sm"><Field label="Enviar el recordatorio el">
                <Input type="datetime-local" value={remindAt} onChange={(e) => setRemindAtEdited(e.target.value)} />
                <span className="text-[11px] font-normal text-slate-500">Por defecto: el día anterior a las 17:00 h. Si ya pasó esa hora, se envía de inmediato.</span>
              </Field></div>
            )}

            <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700">
              <input type="checkbox" checked={resultsNotice} onChange={(e) => setResultsNotice(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
              <span><span className="font-semibold">El paciente acepta que le avisemos por WhatsApp cuando sus resultados estén listos</span><span className="block text-xs text-slate-500">Se envía solo, cuando el químico valida todos los estudios de la orden.</span></span>
            </label>
          </fieldset>
        )}

        <div className="rounded-xl bg-slate-50 p-4 md:col-span-2">
          <div className="grid gap-4 sm:grid-cols-4">
            <div><p className="text-xs text-slate-500">Costo total (automático)</p><p className="mt-1 text-xl font-bold text-slate-800">{moneyExact(total)}</p><p className="text-[11px] text-slate-400">Precios fijos del sistema</p></div>
            <Field label="Abono / prepago (MXN)"><Input type="number" min="0" max={total} step="0.01" value={abono} onChange={(e) => setAbono(e.target.value)} placeholder="0.00" disabled={total === 0} /></Field>
            <Field label="Forma de pago del abono"><Select value={method} onChange={(e) => setMethod(e.target.value as PayMethod)} disabled={abonoNum <= 0}><option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option></Select></Field>
            <div><p className="text-xs text-slate-500">Saldo restante</p><p className="mt-1 text-xl font-bold text-amber-700">{moneyExact(saldo)}</p></div>
          </div>
          {total > 0 && <button type="button" onClick={() => setAbono(String(total))} className="mt-2 text-xs font-semibold text-blue-600 hover:underline">Pagar el total ahora</button>}
        </div>

        <div className="flex justify-end md:col-span-2"><Button type="submit" disabled={saving}>Confirmar cita{abonoNum > 0 ? " y cobrar abono" : ""}</Button></div>
      </form>
    </Workspace>
  );
}
