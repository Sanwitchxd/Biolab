import { useMemo, useState } from "react";
import { Button, Field, Input, Notice, Textarea, Workspace } from "../../components/ui/FormControls";
import Modal from "../../components/ui/Modal";
import { dateLabel, dateTimeLabel, money, moneyExact } from "../../utils/format";
import { nameError, onlyDigits, phoneError, squash } from "../../utils/validation";
import { printHtml } from "../../utils/print";
import { escapeHtml as esc } from "../../utils/escape";
import { FLAG_STYLE, FLAG_TEXT } from "../../utils/reference";
import {
  allValidated, ATTENTION_STYLE, attentionOf, financeState, isValidated, latestOrder, orderBalance, orderPaid, orderTotal, patientLocked,
  digits, formatPhone, type FinanceState, type Order, type OrderItem, type Patient,
} from "./data";
import ChargeForm from "./ChargeForm";
import type { ReceptionStore } from "./store";
import TicketModal from "./Ticket";

const errorText = (e: unknown) => (e instanceof Error ? e.message : "No se pudo completar la operación.");
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const FIN_STYLE: Record<FinanceState, string> = {
  Liquidado: "bg-emerald-100 text-emerald-700", "Con adeudo": "bg-red-100 text-red-700", Abonado: "bg-amber-100 text-amber-700", Cancelada: "bg-slate-100 text-slate-500",
};
const RESULT_STYLE: Record<string, string> = { Pendiente: "bg-slate-100 text-slate-500", Capturado: "bg-amber-100 text-amber-700", Validado: "bg-emerald-100 text-emerald-700", Liberado: "bg-emerald-100 text-emerald-700" };

export default function PatientsPanel({ store, focusPatientId, onClose }: { store: ReceptionStore; focusPatientId?: string | null; onClose: () => void }) {
  const { patients, orders, payments } = store;
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(focusPatientId ?? null);
  const [notice, setNotice] = useState("");
  const [chargeOrder, setChargeOrder] = useState<Order | null>(null);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ order: Order; item: OrderItem } | null>(null);
  const [cancelling, setCancelling] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [delivering, setDelivering] = useState<Order | null>(null);
  const [editing, setEditing] = useState<{ name: string; phone: string; whatsapp: boolean } | null>(null);
  const [editError, setEditError] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [wa, setWa] = useState<{ text: string; at: string } | null>(null);
  const [waError, setWaError] = useState("");
  const [waBusy, setWaBusy] = useState(false);

  const patientOrders = (id: string) => orders.filter((o) => o.patientId === id).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const debt = (id: string) => patientOrders(id).reduce((s, o) => s + orderBalance(o, payments), 0);
  /** null = el paciente aún no tiene cobros que mostrar (sin órdenes vigentes). */
  const financeOf = (id: string): { debt: number } | null => {
    const vigentes = patientOrders(id).filter((o) => o.status !== "Cancelada");
    return vigentes.length === 0 ? null : { debt: debt(id) };
  };

  const rows = useMemo(() => {
    const q = norm(query);
    return patients
      .filter((p) => !q || norm(p.name).includes(q) || norm(p.id).includes(q))
      .map((p) => ({ p, last: patientOrders(p.id)[0]?.createdAt ?? p.registeredAt }))
      .sort((a, b) => b.last.getTime() - a.last.getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patients, orders, query]);

  const patient = patients.find((p) => p.id === selectedId) ?? null;
  const ticket = payments.find((p) => p.id === ticketId) ?? null;
  const ticketOrder = ticket ? orders.find((o) => o.id === ticket.orderId) : null;
  const ticketPatient = ticketOrder ? patients.find((p) => p.id === ticketOrder.patientId) : null;
  // Mantiene la orden actualizada dentro del modal de cobro
  const liveCharge = chargeOrder ? orders.find((o) => o.id === chargeOrder.id) ?? chargeOrder : null;

  const printResult = (order: Order, item: OrderItem, p: Patient) => {
    // Todo dato que viene de la base se escapa: un nombre o valor con "<" no puede inyectar código en la ventana de impresión.
    const html = `<h1>BIOLAB</h1><p class="c muted">Informe de resultados</p><hr/>
      <div class="row"><span>Paciente</span><span>${esc(p.name)} (${esc(p.id)})</span></div><div class="row"><span>Folio</span><span>${esc(order.folio)}</span></div>
      <div class="row"><span>Estudio</span><span>${esc(item.name)}</span></div><div class="row"><span>Liberado</span><span>${item.result.releasedAt ? esc(dateTimeLabel(item.result.releasedAt)) : ""}</span></div><hr/>
      <table><tr><th>Parámetro</th><th>Resultado</th><th>Referencia</th></tr>${item.result.values.map((v) => `<tr><td>${esc(v.name)}</td><td>${esc(v.value)} ${esc(v.unit)}${v.flag === "alto" || v.flag === "bajo" || v.flag === "anormal" ? " *" : ""}</td><td>${esc(v.ref)}</td></tr>`).join("")}</table>
      <p class="muted">* Valor fuera de la referencia. Los valores de referencia son generales; el médico interpreta el resultado.</p>`;
    printHtml(`${order.folio}-${item.serviceId}`, html);
  };

  /* ------------------------------ Vista de detalle ------------------------------ */
  if (patient) {
    const pOrders = patientOrders(patient.id);
    const lock = patientLocked(pOrders);
    const attn = attentionOf(latestOrder(pOrders));
    const finance = financeOf(patient.id);
    return (
      <Workspace title={patient.name} subtitle={`Paciente ${patient.id} · resultados validados y estado de cuenta`} onClose={onClose}>
        {notice && <Notice>{notice}</Notice>}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={() => { setSelectedId(null); setNotice(""); }} className="text-xs font-semibold text-blue-600 hover:underline">← Volver al directorio</button>
          <div className="flex flex-wrap items-center gap-2">
            {patient.whatsapp && digits(patient.phone).length === 10 && <Button type="button" variant="success" className="!px-3 !py-1.5 !text-xs" onClick={() => { setWa({ text: "", at: "" }); setWaError(""); }}>Enviar WhatsApp</Button>}
            <Button type="button" variant="secondary" className="!px-3 !py-1.5 !text-xs" disabled={lock.locked} title={lock.locked ? lock.reason : ""} onClick={() => { setEditing({ name: patient.name, phone: patient.phone, whatsapp: patient.whatsapp }); setEditError(""); }}>Editar datos</Button>
          </div>
        </div>
        {lock.locked && <p className="mb-4 rounded-xl bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800">🔒 {lock.reason}</p>}

        <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-600">{patient.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-slate-800">{patient.name}</p>
            <p className="mt-0.5 text-xs text-slate-500">ID <span className="font-semibold text-blue-600">{patient.id}</span> · Tel. {patient.phone || "—"} · {patient.whatsapp ? "Autoriza WhatsApp" : "Sin WhatsApp (aviso físico)"}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span title={attn.detail} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ATTENTION_STYLE[attn.tone]}`}>{attn.label}</span>
              {finance && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${finance.debt > 0 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>{finance.debt > 0 ? `Debe ${moneyExact(finance.debt)}` : "Pagado"}</span>}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {pOrders.map((order) => {
            const fin = financeState(order, payments);
            const balance = orderBalance(order, payments);
            const orderPayments = payments.filter((p) => p.orderId === order.id).sort((a, b) => a.at.getTime() - b.at.getTime());
            const ready = allValidated(order);
            const canDeliver = order.status !== "Cancelada" && order.status !== "Entregada" && ready && balance === 0;
            const canCancel = (order.status === "Registrada" || order.status === "En proceso") && !order.items.some(isValidated);
            return (
              <article key={order.id} className="rounded-xl border border-slate-200">
                <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3">
                  <div><p className="text-sm font-bold text-slate-800">{order.folio}</p><p className="text-xs text-slate-400">Registrada {dateTimeLabel(order.createdAt)}{order.appointmentAt && ` · Cita ${dateTimeLabel(order.appointmentAt)}`}</p></div>
                  <span className="ml-auto rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">{order.status}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${FIN_STYLE[fin]}`}>{fin === "Liquidado" ? "Liquidado" : fin === "Cancelada" ? "Cancelada" : `Debe ${money(balance)}`}</span>
                </div>

                <div className="grid gap-5 p-5 lg:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Resultados médicos</p>
                    <ul className="space-y-2">
                      {order.items.map((item) => {
                        const hasResults = true; // todo estudio del catálogo genera informe
                        const ok = isValidated(item);
                        return (
                          <li key={item.serviceId} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                            <span className="min-w-0 flex-1 truncate text-slate-700">{item.name}</span>
                            {hasResults ? (
                              <>
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${RESULT_STYLE[item.result.status]}`}>{ok ? "Validado" : item.result.status === "Capturado" ? "En validación" : "Pendiente"}</span>
                                <Button type="button" variant="secondary" className="!px-3 !py-1 !text-xs" disabled={!ok} title={ok ? "" : "Disponible cuando el químico valide el resultado"} onClick={() => setViewing({ order, item })}>Ver</Button>
                              </>
                            ) : <span className="text-[11px] text-slate-400">Sin informe</span>}
                          </li>
                        );
                      })}
                    </ul>
                    <p className="mt-2 text-[11px] text-slate-400">Solo se pueden consultar resultados validados por el químico.</p>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Estado financiero</p>
                    <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-sm">
                      <div><p className="text-[11px] text-slate-500">Total</p><p className="font-semibold text-slate-800">{moneyExact(orderTotal(order))}</p></div>
                      <div><p className="text-[11px] text-slate-500">Pagado</p><p className="font-semibold text-emerald-700">{moneyExact(orderPaid(order, payments))}</p></div>
                      <div><p className="text-[11px] text-slate-500">Saldo</p><p className={`font-semibold ${balance > 0 ? "text-red-600" : "text-slate-700"}`}>{moneyExact(balance)}</p></div>
                    </div>
                    {orderPayments.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs text-slate-500">{orderPayments.map((p) => (
                        <li key={p.id} className="flex items-center justify-between"><span>{dateLabel(p.at)} · {p.type} · {p.method}</span><button type="button" className="font-semibold text-blue-600 hover:underline" onClick={() => setTicketId(p.id)}>{moneyExact(p.amount)} · ticket</button></li>
                      ))}</ul>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {balance > 0 && order.status !== "Cancelada" && <Button type="button" variant="success" className="!px-4 !py-2 !text-xs" onClick={() => setChargeOrder(order)}>Pagar saldo {money(balance)}</Button>}
                      {order.status !== "Cancelada" && order.status !== "Entregada" && <Button type="button" className="!px-4 !py-2 !text-xs" disabled={!canDeliver} onClick={() => setDelivering(order)}>Entregar resultados</Button>}
                      {canCancel && <Button type="button" variant="danger" className="!px-4 !py-2 !text-xs" onClick={() => { setCancelling(order); setCancelReason(""); }}>Cancelar orden</Button>}
                    </div>
                    {order.status !== "Cancelada" && order.status !== "Entregada" && !canDeliver && (
                      <p className="mt-2 text-[11px] text-slate-400">{balance > 0 ? "Para entregar resultados primero debe liquidarse el saldo." : !ready ? "Faltan resultados por validar." : ""}</p>
                    )}
                    {order.status === "Entregada" && <p className="mt-2 text-[11px] text-emerald-600">Entregada el {order.deliveredAt && dateTimeLabel(order.deliveredAt)} por {order.deliveredBy}.</p>}
                    {order.status === "Cancelada" && <p className="mt-2 text-[11px] text-slate-500">Motivo: {order.cancelReason}</p>}
                  </div>
                </div>
              </article>
            );
          })}
          {pOrders.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">Este paciente aún no tiene órdenes.</p>}
        </div>

        {viewing && (
          <Modal title={viewing.item.name} subtitle={`${viewing.order.folio} · ${patient.name}`} size="lg" onClose={() => setViewing(null)}
            footer={<>
              {orderBalance(viewing.order, payments) > 0 && <span className="mr-auto text-xs text-amber-700">Impresión disponible al liquidar el saldo.</span>}
              <Button type="button" variant="secondary" onClick={() => setViewing(null)}>Cerrar</Button>
              <Button type="button" disabled={orderBalance(viewing.order, payments) > 0 || viewing.item.result.values.length === 0} onClick={() => printResult(viewing.order, viewing.item, patient)}>Imprimir informe</Button>
            </>}>
            <p className="mb-3 text-xs text-slate-500">Validado{viewing.item.result.validatedBy ? ` por ${viewing.item.result.validatedBy}` : ""}{viewing.item.result.validatedAt && ` · ${dateTimeLabel(viewing.item.result.validatedAt)}`}. Informe clínico sin precios ni saldos.</p>
            {viewing.item.result.values.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-2.5">Parámetro</th><th className="px-4 py-2.5">Resultado</th><th className="px-4 py-2.5">Referencia</th><th className="px-4 py-2.5">Estado</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">{viewing.item.result.values.map((v) => (
                    <tr key={v.name}><td className="px-4 py-2.5 font-medium text-slate-700">{v.name}</td><td className={`px-4 py-2.5 font-semibold ${v.flag === "alto" || v.flag === "bajo" || v.flag === "anormal" ? "text-red-600" : "text-slate-800"}`}>{v.value} <span className="text-xs font-normal text-slate-400">{v.unit}</span></td><td className="px-4 py-2.5 text-slate-500">{v.ref}</td>
                      <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${FLAG_STYLE[v.flag]}`}>{FLAG_TEXT[v.flag]}</span></td></tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{viewing.item.result.externalPdf ? `Reporte externo adjunto: ${viewing.item.result.externalPdf}` : "Sin valores capturados."}</p>}
          </Modal>
        )}

        {liveCharge && (
          <Modal title="Pagar saldo" subtitle={liveCharge.folio} onClose={() => setChargeOrder(null)}>
            <ChargeForm order={liveCharge} patient={patient} payments={payments} onCharge={async (o, amount, method) => { try { const pay = await store.charge(o, amount, method); setChargeOrder(null); setTicketId(pay.id); setNotice(`Pago de ${moneyExact(amount)} registrado (${pay.type}).`); } catch (e) { setChargeOrder(null); setNotice(errorText(e)); } }} />
          </Modal>
        )}

        {editing && (
          <Modal title="Editar datos del paciente" subtitle={patient.id} onClose={() => setEditing(null)}
            footer={<><Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button><Button type="button" disabled={editBusy || Boolean(nameError(editing.name)) || Boolean(phoneError(digits(editing.phone)))} onClick={async () => {
              setEditBusy(true); setEditError("");
              try { await store.updatePatient(patient.id, { ...editing, name: squash(editing.name), whatsapp: editing.whatsapp && digits(editing.phone).length === 10 }); setEditing(null); setNotice("Datos del paciente actualizados."); } catch (e) { setEditError(errorText(e)); } finally { setEditBusy(false); }
            }}>Guardar cambios</Button></>}>
            {editError && <p role="alert" className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{editError}</p>}
            <div className="grid gap-4">
              <Field label="Nombre completo">
                <Input value={editing.name} maxLength={100} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                {editing.name.trim() !== "" && nameError(editing.name) && <span className="text-[11px] font-normal text-red-500">{nameError(editing.name)}</span>}
              </Field>
              <Field label="Teléfono (opcional, 10 dígitos)">
                <Input value={digits(editing.phone)} inputMode="numeric" maxLength={10} onChange={(e) => { const d = onlyDigits(e.target.value, 10); setEditing({ ...editing, phone: d, whatsapp: d.length === 10 ? editing.whatsapp : false }); }} placeholder="Sin teléfono" />
                {phoneError(digits(editing.phone)) && <span className="text-[11px] font-normal text-amber-600">{phoneError(digits(editing.phone))}</span>}
              </Field>
              {digits(editing.phone).length === 10
                ? <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={editing.whatsapp} onChange={(e) => setEditing({ ...editing, whatsapp: e.target.checked })} className="h-4 w-4 accent-blue-500" /> Autoriza notificaciones por WhatsApp</label>
                : <p className="text-xs text-slate-500">Sin teléfono completo no se pueden usar avisos por WhatsApp.</p>}
            </div>
          </Modal>
        )}

        {wa && (
          <Modal title="Enviar WhatsApp al paciente" subtitle={`${patient.name} · ${patient.phone}`} onClose={() => setWa(null)}
            footer={<><Button type="button" variant="secondary" onClick={() => setWa(null)}>Cancelar</Button><Button type="button" variant="success" disabled={waBusy || wa.text.trim().length < 3} onClick={async () => {
              setWaBusy(true); setWaError("");
              try { await store.queueWhatsApp(patient.id, wa.text, wa.at ? new Date(wa.at) : null); setWa(null); setNotice("Mensaje en la cola de WhatsApp. Ábrelo desde la opción WhatsApp del menú para enviarlo."); }
              catch (e) { setWaError(errorText(e)); } finally { setWaBusy(false); }
            }}>Programar mensaje</Button></>}>
            {waError && <p role="alert" className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{waError}</p>}
            <div className="grid gap-4">
              <Field label="Mensaje"><Textarea value={wa.text} maxLength={1000} onChange={(e) => setWa({ ...wa, text: e.target.value })} placeholder="Ej. Hola, recuerda llegar en ayuno de 8 horas…" /></Field>
              <div className="flex flex-wrap gap-2">
                {["Recuerda llegar en ayuno de 8 a 12 horas (solo agua).", "No tomes agua ni alimentos desde las 12 de la noche.", "Trae tu identificación y tu orden médica.", "Tus resultados ya están listos, puedes pasar por ellos."].map((t) => (
                  <button key={t} type="button" onClick={() => setWa({ ...wa, text: t })} className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-600 hover:border-blue-300 hover:text-blue-600">{t}</button>
                ))}
              </div>
              <Field label="Enviar el (opcional; vacío = ahora)"><Input type="datetime-local" value={wa.at} onChange={(e) => setWa({ ...wa, at: e.target.value })} /></Field>
            </div>
          </Modal>
        )}

        {delivering && (
          <Modal title="Entregar resultados" subtitle={delivering.folio} onClose={() => setDelivering(null)}
            footer={<><Button type="button" variant="secondary" onClick={() => setDelivering(null)}>Cancelar</Button><Button type="button" onClick={async () => { try { await store.deliver(delivering.id); setNotice(`Resultados de ${delivering.folio} entregados.`); } catch (e) { setNotice(errorText(e)); } setDelivering(null); }}>Confirmar entrega</Button></>}>
            <p className="text-sm text-slate-600">Se registrará la entrega de los resultados de <b>{patient.name}</b> con fecha y hora actuales. El saldo de la orden está en $0.00.</p>
          </Modal>
        )}

        {cancelling && (
          <Modal title="Cancelar orden" subtitle={cancelling.folio} onClose={() => setCancelling(null)}
            footer={<><Button type="button" variant="secondary" onClick={() => setCancelling(null)}>Volver</Button><Button type="button" variant="danger" disabled={cancelReason.trim().length < 10} onClick={async () => { try { await store.cancel(cancelling.id, cancelReason.trim()); setNotice(`Orden ${cancelling.folio} cancelada.`); } catch (e) { setNotice(errorText(e)); } setCancelling(null); }}>Confirmar cancelación</Button></>}>
            <p className="mb-3 text-xs text-slate-500">La cancelación es lógica: la orden se conserva con su justificación. Los pagos ya cobrados se conservan para su revisión por Gerencia.</p>
            <Field label="Justificación (mín. 10 caracteres)"><Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} /></Field>
          </Modal>
        )}

        {ticket && ticketOrder && ticketPatient && <TicketModal payment={ticket} order={ticketOrder} patient={ticketPatient} payments={payments} onClose={() => setTicketId(null)} />}
      </Workspace>
    );
  }

  /* --------------------------------- Directorio --------------------------------- */
  return (
    <Workspace title="Directorio de pacientes" subtitle="Busca por nombre o ID de paciente · haz clic para ver resultados y estado de cuenta" onClose={onClose}>
      <div className="mb-5 flex gap-3">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ej. Ana Martínez o P-1048" className="flex-1" autoFocus />
        {query && <Button type="button" variant="secondary" onClick={() => setQuery("")}>Limpiar</Button>}
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">ID de paciente</th><th className="px-4 py-3">Paciente</th><th className="px-4 py-3">Teléfono</th><th className="px-4 py-3">WhatsApp</th><th className="px-4 py-3">Última visita</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Estado de cuenta</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ p, last }) => {
              const fin = financeOf(p.id);
              const attn = attentionOf(latestOrder(patientOrders(p.id)));
              return (
                <tr key={p.id} tabIndex={0} onClick={() => setSelectedId(p.id)} onKeyDown={(e) => { if (e.key === "Enter") setSelectedId(p.id); }} className="cursor-pointer hover:bg-blue-50/40 focus:bg-blue-50/60 focus:outline-none">
                  <td className="px-4 py-3 font-semibold text-blue-600">{p.id}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">{p.name}</td>
                  <td className="px-4 py-3 text-slate-500">{p.phone}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{p.whatsapp ? "Sí" : "No"}</td>
                  <td className="px-4 py-3 text-slate-500">{dateLabel(last)}</td>
                  <td className="px-4 py-3"><span title={attn.detail} className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${ATTENTION_STYLE[attn.tone]}`}>{attn.label}</span></td>
                  <td className="px-4 py-3">{fin ? <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${fin.debt > 0 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>{fin.debt > 0 ? `Debe ${money(fin.debt)}` : "Pagado"}</span> : <span className="text-xs text-slate-400">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No se encontraron pacientes con “{query}”.</p>}
      </div>
    </Workspace>
  );
}
