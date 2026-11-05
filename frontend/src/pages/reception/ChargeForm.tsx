import { useState } from "react";
import { Button, Field, Input, Select } from "../../components/ui/FormControls";
import { moneyExact } from "../../utils/format";
import { orderBalance, orderPaid, orderTotal, type Order, type Patient, type Payment, type PayMethod } from "./data";

interface Props { order: Order; patient: Patient; payments: Payment[]; onCharge: (order: Order, amount: number, method: PayMethod) => void | Promise<void> }

/** Formulario de cobro: folio, paciente e importe de solo lectura; se elige importe a cobrar y tipo de pago. */
export default function ChargeForm({ order, patient, payments, onCharge }: Props) {
  const balance = orderBalance(order, payments);
  const [amount, setAmount] = useState(String(balance));
  const [method, setMethod] = useState<PayMethod>("Efectivo");
  const [saving, setSaving] = useState(false);
  const value = Number(amount);
  const valid = value > 0 && value <= balance + 0.0001;
  const type = value >= balance ? "Liquidación" : "Abono";

  return (
    <form onSubmit={async (e) => { e.preventDefault(); if (!valid || saving) return; setSaving(true); try { await onCharge(order, Math.round(value * 100) / 100, method); } finally { setSaving(false); } }} className="grid gap-4 md:grid-cols-2">
      <Field label="Folio de orden"><Input readOnly value={order.folio} className="bg-slate-100" /></Field>
      <Field label="Paciente"><Input readOnly value={`${patient.name} · ${patient.id}`} className="bg-slate-100" /></Field>
      <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-4 text-sm md:col-span-2">
        <div><p className="text-xs text-slate-500">Total de la orden</p><p className="font-semibold text-slate-800">{moneyExact(orderTotal(order))}</p></div>
        <div><p className="text-xs text-slate-500">Pagado</p><p className="font-semibold text-emerald-700">{moneyExact(orderPaid(order, payments))}</p></div>
        <div><p className="text-xs text-slate-500">Saldo pendiente</p><p className="font-semibold text-amber-700">{moneyExact(balance)}</p></div>
      </div>
      <Field label="Importe a cobrar (MXN)"><Input required type="number" min="0.01" max={balance} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      <Field label="Tipo de pago"><Select value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}><option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option></Select></Field>
      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        <button type="button" onClick={() => setAmount(String(balance))} className="text-xs font-semibold text-blue-600 hover:underline">Cobrar saldo completo</button>
        {valid && <span className={`rounded-full px-3 py-1 text-xs font-semibold ${type === "Liquidación" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>Se registrará como {type}{type === "Abono" ? ` · quedará un saldo de ${moneyExact(balance - value)}` : ""}</span>}
        {!valid && amount !== "" && <span className="text-xs text-red-500">El importe debe ser mayor a 0 y no exceder el saldo.</span>}
        <Button type="submit" variant="success" className="ml-auto" disabled={!valid || saving}>Cobrar y emitir comprobante</Button>
      </div>
    </form>
  );
}
