import { useState } from "react";
import { Button, Field, Input, Select } from "../../components/ui/FormControls";
import { dateTimeLabel, isoDayLabel, moneyExact, PERIODICIDADES, type Payroll, type PayrollMethod, type Periodicidad, type StaffUser } from "./data";

interface Props {
  user: StaffUser;
  payroll: Payroll | undefined;
  onSetSalary: (user: StaffUser, input: { salary: number; periodicity: Periodicidad; startDate: string }) => Promise<void>;
  onPay: (user: StaffUser, input: { period: string; method: PayrollMethod; note: string; amount?: number }) => Promise<void>;
}

const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** Sueldo del empleado: cuánto gana, cuándo se le paga, si ya se le pagó y si se le debe algo. */
export default function PayrollSection({ user, payroll, onSetSalary, onPay }: Props) {
  const [editing, setEditing] = useState(!payroll);
  const [salary, setSalary] = useState(payroll ? String(payroll.salary) : "");
  const [periodicity, setPeriodicity] = useState<Periodicidad>(payroll?.periodicity ?? "Quincenal");
  const [startDate, setStartDate] = useState(payroll?.startDate ?? todayIso());
  const [method, setMethod] = useState<PayrollMethod>("Efectivo");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const run = async (fn: () => Promise<void>, message: string) => {
    setBusy(true); setError(""); setOk("");
    try { await fn(); setOk(message); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo completar la operación."); } finally { setBusy(false); }
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(salary);
    if (!Number.isFinite(n) || n <= 0) { setError("Escribe un sueldo mayor a 0."); return; }
    if (n > 1_000_000) { setError("El sueldo no puede pasar de 1,000,000."); return; }
    if (Math.round(n * 100) / 100 !== n) { setError("El sueldo solo admite hasta 2 decimales."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) { setError("Indica la fecha desde la que cuenta el sueldo."); return; }
    void run(async () => { await onSetSalary(user, { salary: n, periodicity, startDate }); setEditing(false); }, "Sueldo guardado.");
  };

  const pay = (period: string) => void run(() => onPay(user, { period, method, note: note.trim() }).then(() => setNote("")), `Pago del ${isoDayLabel(period)} registrado.`);

  return (
    <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Sueldo y pagos</p>
        {payroll && !editing && <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-blue-600 hover:underline">Cambiar sueldo</button>}
      </div>
      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>}
      {ok && <p className="mb-3 rounded-lg bg-emerald-100 px-3 py-2 text-xs font-medium text-emerald-700">{ok}</p>}

      {editing ? (
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-3">
          <Field label="Sueldo por periodo (MXN)"><Input type="number" min="1" max="1000000" step="0.01" required value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="0.00" /></Field>
          <Field label="Se paga"><Select value={periodicity} onChange={(e) => setPeriodicity(e.target.value as Periodicidad)}>{PERIODICIDADES.map((p) => <option key={p}>{p}</option>)}</Select></Field>
          <Field label="Cuenta desde"><Input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
          <p className="text-[11px] text-slate-500 sm:col-span-3">Semanal: cada 7 días desde esa fecha · Quincenal: días 15 y último del mes · Mensual: último día del mes. Solo se genera adeudo a partir de “Cuenta desde”.</p>
          <div className="flex gap-2 sm:col-span-3">
            <Button type="submit" disabled={busy}>Guardar sueldo</Button>
            {payroll && <Button type="button" variant="secondary" onClick={() => setEditing(false)}>Cancelar</Button>}
          </div>
        </form>
      ) : payroll && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-white p-3"><p className="text-[10px] font-bold uppercase text-slate-400">Sueldo</p><p className="mt-1 text-sm font-semibold text-slate-700">{moneyExact(payroll.salary)} · {payroll.periodicity}</p></div>
            <div className="rounded-xl bg-white p-3"><p className="text-[10px] font-bold uppercase text-slate-400">Próximo pago</p><p className="mt-1 text-sm font-semibold text-slate-700">{isoDayLabel(payroll.nextPay)}</p></div>
            <div className="rounded-xl bg-white p-3"><p className="text-[10px] font-bold uppercase text-slate-400">Último pago</p><p className="mt-1 text-sm font-semibold text-slate-700">{payroll.lastPay ? isoDayLabel(payroll.lastPay) : "Aún sin pagos"}</p></div>
            <div className={`rounded-xl p-3 ${payroll.owed > 0 ? "bg-red-50" : "bg-white"}`}><p className="text-[10px] font-bold uppercase text-slate-400">¿Se le debe algo?</p>
              <p className={`mt-1 text-sm font-semibold ${payroll.owed > 0 ? "text-red-600" : "text-emerald-600"}`}>{payroll.owed > 0 ? `Sí: ${moneyExact(payroll.owed)} (${payroll.pending.length} periodo${payroll.pending.length > 1 ? "s" : ""})` : "No, está al corriente"}</p></div>
          </div>

          {payroll.pending.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold text-slate-600">Periodos por pagar</p>
              <div className="mb-3 grid gap-3 sm:grid-cols-2">
                <Field label="Forma de pago"><Select value={method} onChange={(e) => setMethod(e.target.value as PayrollMethod)}><option>Efectivo</option><option>Transferencia</option><option>Cheque</option></Select></Field>
                <Field label="Nota (opcional)"><Input value={note} maxLength={255} onChange={(e) => setNote(e.target.value)} placeholder="Ej. transferencia ref. 123" /></Field>
              </div>
              <ul className="space-y-1.5">
                {payroll.pending.slice(-12).map((p) => (
                  <li key={p} className="flex items-center gap-3 rounded-lg bg-white px-3 py-2 text-xs">
                    <span className="flex-1 font-medium text-slate-700">Pago del {isoDayLabel(p)}</span><span className="text-slate-500">{moneyExact(payroll.salary)}</span>
                    <Button type="button" variant="success" disabled={busy} onClick={() => pay(p)}>Registrar pago</Button>
                  </li>
                ))}
              </ul>
              {payroll.pending.length > 12 && <p className="mt-1 text-[11px] text-slate-400">Se muestran los 12 periodos más recientes de {payroll.pending.length}.</p>}
            </div>
          )}

          {payroll.payments.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold text-slate-600">Historial de pagos</p>
              <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-slate-600">
                {payroll.payments.map((p) => <li key={p.id} className="flex justify-between gap-2 rounded-lg bg-white px-3 py-1.5"><span>{isoDayLabel(p.period)} · {p.method}{p.note ? ` · ${p.note}` : ""}</span><span className="shrink-0 text-slate-400">{moneyExact(p.amount)} · {dateTimeLabel(p.at)} · {p.by}</span></li>)}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
