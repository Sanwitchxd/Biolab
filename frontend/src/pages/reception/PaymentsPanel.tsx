import { useMemo, useState } from "react";
import { Button, Input, Notice, Workspace } from "../../components/ui/FormControls";
import { dateTimeLabel, moneyExact } from "../../utils/format";
import { financeState, orderBalance, orderPaid, orderTotal } from "./data";
import ChargeForm from "./ChargeForm";
import type { ReceptionStore } from "./store";
import TicketModal from "./Ticket";

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export default function PaymentsPanel({ store, onClose }: { store: ReceptionStore; onClose: () => void }) {
  const { patients, orders, payments } = store;
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const patientOf = (id: string) => patients.find((p) => p.id === id)!;
  const debtors = useMemo(() => {
    const q = norm(query);
    return orders
      .filter((o) => orderBalance(o, payments) > 0)
      .filter((o) => !q || norm(o.folio).includes(q) || norm(patientOf(o.patientId).name).includes(q) || norm(o.patientId).includes(q))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, payments, patients, query]);

  const selected = orders.find((o) => o.id === selectedId && orderBalance(o, payments) > 0) ?? null;
  const ticket = payments.find((p) => p.id === ticketId) ?? null;
  const ticketOrder = ticket ? orders.find((o) => o.id === ticket.orderId) : null;
  const recent = [...payments].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 8);
  const totalDue = debtors.reduce((s, o) => s + orderBalance(o, payments), 0);

  return (
    <Workspace title="Cobro de servicios" subtitle="Selecciona una orden con saldo, registra el pago y emite el comprobante" onClose={onClose}>
      {notice && <Notice>{notice}</Notice>}

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por folio, paciente o ID" className="min-w-64 flex-1" />
        <span className="text-xs text-slate-500">{debtors.length} orden(es) por cobrar · <b className="text-amber-700">{moneyExact(totalDue)}</b></span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Folio</th><th className="px-4 py-3">Paciente</th><th className="px-4 py-3 text-right">Importe</th><th className="px-4 py-3 text-right">Pagado</th><th className="px-4 py-3 text-right">Saldo</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3" /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {debtors.map((o) => (
              <tr key={o.id} className={selected?.id === o.id ? "bg-blue-50/60" : "hover:bg-slate-50"}>
                <td className="px-4 py-3 font-semibold text-blue-600">{o.folio}</td>
                <td className="px-4 py-3 text-slate-700">{patientOf(o.patientId).name}<span className="block text-xs text-slate-400">{o.patientId}</span></td>
                <td className="px-4 py-3 text-right text-slate-600">{moneyExact(orderTotal(o))}</td>
                <td className="px-4 py-3 text-right text-emerald-700">{moneyExact(orderPaid(o, payments))}</td>
                <td className="px-4 py-3 text-right font-semibold text-red-600">{moneyExact(orderBalance(o, payments))}</td>
                <td className="px-4 py-3"><span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">{financeState(o, payments)}</span></td>
                <td className="px-4 py-3 text-right"><Button type="button" variant={selected?.id === o.id ? "primary" : "secondary"} className="!px-3 !py-1.5 !text-xs" onClick={() => { setSelectedId(o.id); setNotice(""); }}>Cobrar</Button></td>
              </tr>
            ))}
            {debtors.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">No hay órdenes con saldo pendiente.</td></tr>}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/30 p-5">
          <p className="mb-4 text-sm font-semibold text-slate-800">Registrar cobro</p>
          <ChargeForm key={selected.id} order={selected} patient={patientOf(selected.patientId)} payments={payments}
            onCharge={async (o, amount, method) => { try { const pay = await store.charge(o, amount, method); setTicketId(pay.id); setSelectedId(null); setNotice(`Pago de ${moneyExact(amount)} registrado como ${pay.type}. Comprobante ${pay.ticketNo} emitido.`); } catch (e) { setNotice(e instanceof Error ? e.message : "No se pudo registrar el pago."); } }} />
        </div>
      )}

      <p className="mb-2 mt-8 text-sm font-semibold text-slate-800">Comprobantes emitidos</p>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Ticket</th><th className="px-4 py-3">Folio</th><th className="px-4 py-3">Paciente</th><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Tipo de pago</th><th className="px-4 py-3 text-right">Importe</th><th className="px-4 py-3" /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {recent.map((p) => { const o = orders.find((x) => x.id === p.orderId)!; return (
              <tr key={p.id}>
                <td className="px-4 py-3 font-medium text-slate-700">{p.ticketNo}</td><td className="px-4 py-3 text-slate-500">{o.folio}</td><td className="px-4 py-3 text-slate-700">{patientOf(o.patientId).name}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{dateTimeLabel(p.at)}</td><td className="px-4 py-3 text-xs text-slate-500">{p.method} · {p.type}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-800">{moneyExact(p.amount)}</td>
                <td className="px-4 py-3 text-right"><Button type="button" variant="secondary" className="!px-3 !py-1.5 !text-xs" onClick={() => setTicketId(p.id)}>Ver ticket</Button></td>
              </tr>
            ); })}
          </tbody>
        </table>
      </div>

      {ticket && ticketOrder && <TicketModal payment={ticket} order={ticketOrder} patient={patientOf(ticketOrder.patientId)} payments={payments} onClose={() => setTicketId(null)} />}
    </Workspace>
  );
}
