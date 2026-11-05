import Modal from "../../components/ui/Modal";
import { Button } from "../../components/ui/FormControls";
import { dateTimeLabel, moneyExact } from "../../utils/format";
import { printHtml } from "../../utils/print";
import { escapeHtml as esc } from "../../utils/escape";
import { orderTotal, type Order, type Patient, type Payment } from "./data";

interface Props { payment: Payment; order: Order; patient: Patient; payments: Payment[]; onClose: () => void }

/** Comprobante de pago: importes de la orden y de este movimiento (sin datos clínicos). */
export default function TicketModal({ payment, order, patient, payments, onClose }: Props) {
  const total = orderTotal(order);
  const upTo = payments.filter((p) => p.orderId === order.id && p.at.getTime() <= payment.at.getTime());
  const paidToDate = upTo.reduce((s, p) => s + p.amount, 0);
  const balance = Math.max(0, total - paidToDate);

  const rows = [["Ticket", payment.ticketNo], ["Folio de orden", order.folio], ["Paciente", `${patient.name} (${patient.id})`], ["Fecha", dateTimeLabel(payment.at)], ["Atendió", payment.cashier]];

  const print = () => {
    const html = `<h1>BIOLAB</h1><p class="c muted">Laboratorio de análisis clínicos<br/>Comprobante de pago</p><hr/>
      ${rows.map(([k, v]) => `<div class="row"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join("")}<hr/>
      ${order.items.map((i) => `<div class="row"><span>${esc(i.name)}</span><span>${moneyExact(i.price)}</span></div>`).join("")}<hr/>
      <div class="row"><span>Total de la orden</span><span>${moneyExact(total)}</span></div>
      <div class="row"><b>${payment.type} (${payment.method})</b><b>${moneyExact(payment.amount)}</b></div>
      <div class="row"><span>Pagado a la fecha</span><span>${moneyExact(paidToDate)}</span></div>
      <div class="row"><span>Saldo pendiente</span><span>${moneyExact(balance)}</span></div><hr/>
      ${order.prep ? `<p class="muted"><b>Preparación previa:</b> ${esc(order.prep)}</p><hr/>` : ""}
      <p class="c muted">${balance === 0 ? "ORDEN LIQUIDADA" : "Conserve este comprobante"}<br/>Gracias por su preferencia</p>`;
    printHtml(payment.ticketNo, html);
  };

  return (
    <Modal title="Comprobante de pago" subtitle={payment.ticketNo} onClose={onClose} footer={<><Button type="button" variant="secondary" onClick={onClose}>Cerrar</Button><Button type="button" onClick={print}>Imprimir comprobante</Button></>}>
      <div className="mx-auto max-w-xs rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 font-mono text-xs text-slate-700">
        <p className="text-center text-sm font-bold">BIOLAB</p>
        <p className="mb-3 text-center text-[11px] text-slate-500">Laboratorio de análisis clínicos<br />Comprobante de pago</p>
        <div className="space-y-1 border-y border-dashed border-slate-300 py-2">
          {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3"><span className="text-slate-500">{k}</span><span className="text-right font-medium">{v}</span></div>)}
        </div>
        <div className="space-y-1 border-b border-dashed border-slate-300 py-2">
          {order.items.map((i) => <div key={i.serviceId} className="flex justify-between gap-3"><span>{i.name}</span><span>{moneyExact(i.price)}</span></div>)}
        </div>
        <div className="space-y-1 pt-2">
          <div className="flex justify-between"><span>Total de la orden</span><span>{moneyExact(total)}</span></div>
          <div className="flex justify-between text-sm font-bold"><span>{payment.type} · {payment.method}</span><span>{moneyExact(payment.amount)}</span></div>
          <div className="flex justify-between"><span>Pagado a la fecha</span><span>{moneyExact(paidToDate)}</span></div>
          <div className="flex justify-between font-bold"><span>Saldo pendiente</span><span>{moneyExact(balance)}</span></div>
        </div>
        {order.prep && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800"><b>Preparación previa:</b> {order.prep}</p>}
        <p className={`mt-3 text-center font-bold ${balance === 0 ? "text-emerald-600" : "text-amber-600"}`}>{balance === 0 ? "ORDEN LIQUIDADA" : "SALDO PENDIENTE"}</p>
      </div>
    </Modal>
  );
}
