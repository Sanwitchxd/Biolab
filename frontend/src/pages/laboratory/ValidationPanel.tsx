import { useMemo, useState } from "react";
import { Button, Input, Notice, Workspace } from "../../components/ui/FormControls";
import Modal from "../../components/ui/Modal";
import { dateTimeLabel } from "../../utils/format";
import type { Session } from "../../services/session";
import { openProtectedPdf } from "../../services/api";
import { isOpenOrder, isValidated, norm, outOfRange, type Order, type OrderItem, type Patient } from "./data";
import type { LabStore } from "./store";
import { Pill } from "./ui";
import { FLAG_TEXT, isOutOfRange } from "../../utils/reference";

interface Row { order: Order; patient: Patient; item: OrderItem; key: string }
type Tab = "pendientes" | "finalizados";
const MAX_DONE = 40;

export default function ValidationPanel({ lab, session, onClose }: { lab: LabStore; session: Session; onClose: () => void }) {
  const { orders, patients } = lab;
  const [tab, setTab] = useState<Tab>("pendientes");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const { pending, done } = useMemo(() => {
    const pending: Row[] = [];
    const done: Row[] = [];
    orders.filter((o) => o.status !== "Cancelada").forEach((order) => {
      const patient = patients.find((p) => p.id === order.patientId);
      if (!patient) return;
      order.items.forEach((item) => {
        const row = { order, patient, item, key: `${order.id}|${item.serviceId}` };
        if (item.result.status === "Capturado" && isOpenOrder(order)) pending.push(row);
        else if (isValidated(item)) done.push(row);
      });
    });
    pending.sort((a, b) => (a.item.result.capturedAt?.getTime() ?? 0) - (b.item.result.capturedAt?.getTime() ?? 0));
    done.sort((a, b) => (b.item.result.validatedAt?.getTime() ?? 0) - (a.item.result.validatedAt?.getTime() ?? 0));
    return { pending, done };
  }, [orders, patients]);

  const q = norm(query);
  const match = (r: Row) => !q || norm(r.patient.name).includes(q) || norm(r.order.folio).includes(q) || norm(r.item.name).includes(q);
  const rows = (tab === "pendientes" ? pending : done).filter(match);
  const shown = tab === "finalizados" ? rows.slice(0, MAX_DONE) : rows;
  const chosen = pending.filter((r) => selected.includes(r.key));
  const allChecked = tab === "pendientes" && rows.length > 0 && rows.every((r) => selected.includes(r.key));

  const toggle = (key: string) => setSelected((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  const toggleAll = () => setSelected(allChecked ? selected.filter((k) => !rows.some((r) => r.key === k)) : [...new Set([...selected, ...rows.map((r) => r.key)])]);

  const confirm = async () => {
    setBusy(true); setError("");
    try {
      const outcome = await lab.validateItems(chosen.map((r) => r.item.result.id).filter((id): id is number => id !== null));
      setSelected([]);
      setNotice(`${outcome.count} resultado${outcome.count === 1 ? "" : "s"} validado${outcome.count === 1 ? "" : "s"} y publicado${outcome.count === 1 ? "" : "s"}. Recepción fue notificada (${outcome.orders.map((o) => o.folio).join(", ")}).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo validar.");
    } finally { setBusy(false); setConfirming(false); }
  };

  return (
    <Workspace title="Validación médica" subtitle="Revisa los valores antes de autorizar su publicación" onClose={onClose}>
      {notice && <Notice>{notice}</Notice>}
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</p>}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl bg-slate-100 p-1" role="tablist">
          {([["pendientes", `Pendientes (${pending.length})`], ["finalizados", `Finalizados / Resultados listos (${done.length})`]] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setOpen(null); }}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${tab === id ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{label}</button>
          ))}
        </div>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Paciente, folio o estudio" aria-label="Buscar resultado" className="min-w-56 flex-1" />
      </div>

      {tab === "pendientes" && rows.length > 0 && (
        <label className="mb-3 flex cursor-pointer items-center gap-3 px-1 text-xs font-semibold text-slate-600">
          <input type="checkbox" checked={allChecked} onChange={toggleAll} className="h-4 w-4 accent-blue-500" /> Seleccionar todos los visibles
        </label>
      )}

      <div className="space-y-3">
        {shown.map((r) => {
          const flagged = outOfRange(r.item.result.values);
          const expanded = open === r.key;
          return (
            <div key={r.key} className={`rounded-xl border transition ${tab === "pendientes" && selected.includes(r.key) ? "border-blue-300 bg-blue-50/30" : "border-slate-200"}`}>
              <div className="flex items-center gap-4 p-4">
                {tab === "pendientes" && <input type="checkbox" aria-label={`Seleccionar ${r.item.name} de ${r.patient.name}`} checked={selected.includes(r.key)} onChange={() => toggle(r.key)} className="h-4 w-4 shrink-0 accent-blue-500" />}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800">{r.order.folio} · {r.patient.name}</p>
                  <p className="text-xs text-slate-500">
                    {r.item.name} · {r.item.result.values.length === 0 ? (r.item.result.hasPdf ? "Reporte externo adjunto" : "Sin valores") : flagged > 0 ? <span className="font-semibold text-red-600">{flagged} valor{flagged > 1 ? "es" : ""} fuera de rango</span> : "Capturado"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {tab === "pendientes" ? `Capturó ${r.item.result.capturedBy ?? "—"}${r.item.result.capturedAt ? ` · ${dateTimeLabel(r.item.result.capturedAt)}` : ""}` : `Validó ${r.item.result.validatedBy ?? "—"}${r.item.result.validatedAt ? ` · ${dateTimeLabel(r.item.result.validatedAt)}` : ""}`}
                  </p>
                </div>
                <button type="button" onClick={() => setOpen(expanded ? null : r.key)} aria-expanded={expanded} className="shrink-0 text-xs font-semibold text-blue-600 hover:underline">{expanded ? "Ocultar" : "Ver valores"}</button>
                {tab === "pendientes" ? <Pill className="bg-amber-100 text-amber-700">Pendiente</Pill> : <Pill className="bg-emerald-100 text-emerald-700">{r.order.status === "Entregada" ? "Entregado" : "Resultado listo"}</Pill>}
              </div>
              {expanded && (
                <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                  {r.item.result.values.length > 0 ? (
                    <table className="w-full text-left text-xs">
                      <thead><tr className="text-slate-400"><th className="py-1 font-semibold">Parámetro</th><th className="py-1 font-semibold">Resultado</th><th className="py-1 font-semibold">Referencia</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {r.item.result.values.map((v) => (
                          <tr key={v.name}><td className="py-1.5 font-medium text-slate-700">{v.name}</td>
                            <td className={`py-1.5 font-semibold ${isOutOfRange(v.flag) ? "text-red-600" : "text-slate-800"}`}>{v.value} <span className="font-normal text-slate-400">{v.unit}</span>{isOutOfRange(v.flag) && ` (${FLAG_TEXT[v.flag].toLowerCase()})`}</td>
                            <td className="py-1.5 text-slate-500">{v.ref}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <p className="text-xs text-slate-500">Sin parámetros: el resultado es el reporte externo adjunto.</p>}
                  {r.item.result.hasPdf && r.item.result.id !== null && <p className="mt-2 text-xs text-slate-600">Reporte externo adjunto · <button type="button" onClick={() => { const id = r.item.result.id; if (id !== null) openProtectedPdf(`/laboratorio/resultados/${id}/pdf`).catch((e: unknown) => setError(e instanceof Error ? e.message : "No se pudo abrir el PDF.")); }} className="font-semibold text-blue-600 underline">Ver</button></p>}
                </div>
              )}
            </div>
          );
        })}
        {shown.length === 0 && <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">{tab === "pendientes" ? "No hay resultados pendientes de validación." : "Aún no hay resultados finalizados."}</p>}
      </div>
      {tab === "finalizados" && rows.length > MAX_DONE && <p className="mt-3 text-center text-xs text-slate-400">Mostrando los {MAX_DONE} más recientes de {rows.length}.</p>}

      {tab === "pendientes" && (
        <div className="mt-5 flex justify-end">
          <Button type="button" variant="success" disabled={chosen.length === 0} onClick={() => setConfirming(true)}>Validar selección{chosen.length > 0 && ` (${chosen.length})`}</Button>
        </div>
      )}

      {confirming && (
        <Modal title="Validar resultados" subtitle={`Firma: ${session.displayName}`} onClose={() => setConfirming(false)}
          footer={<><Button type="button" variant="secondary" onClick={() => setConfirming(false)}>Cancelar</Button><Button type="button" variant="success" disabled={busy} onClick={confirm}>Validar y notificar</Button></>}>
          <p className="text-sm text-slate-600">Vas a validar <b>{chosen.length}</b> resultado{chosen.length > 1 ? "s" : ""}. Pasarán a <b>Finalizados / Resultados listos</b>, ya no podrán editarse y se avisará de inmediato a Recepción.</p>
          <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
            {chosen.map((r) => <li key={r.key}>{r.order.folio} · {r.patient.name} · {r.item.name}</li>)}
          </ul>
        </Modal>
      )}
    </Workspace>
  );
}
