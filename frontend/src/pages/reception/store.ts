import { useCallback, useEffect, useState } from "react";
import { api } from "../../services/api";
import { digits, type Order, type Patient, type Payment, type PayMethod, type Service } from "./data";
import { mapDatos, type RawDatos, type ReceptionData } from "./mapping";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export interface AppointmentInput {
  name: string; phone: string; whatsapp: boolean; appointmentAt: Date; serviceIds: string[]; abono: number; method: PayMethod;
  /** Solo se usan si el paciente autoriza WhatsApp. */
  prep?: string; remind?: boolean; remindAt?: Date | null; resultsNotice?: boolean;
}

const VACIO: ReceptionData = { patients: [], orders: [], payments: [], services: [] };

/**
 * Datos de Recepción desde la API. Las reglas de negocio (folio, saldo, entrega, cancelación, bitácora)
 * las aplica MySQL; si las rechaza, el error llega aquí con su mensaje y la pantalla lo muestra.
 */
export function useReceptionStore() {
  const [data, setData] = useState<ReceptionData>(VACIO);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  const load = useCallback(async (): Promise<ReceptionData> => {
    const fresh = mapDatos(await api<RawDatos>("/recepcion/datos"));
    setData(fresh);
    return fresh;
  }, []);

  const start = useCallback(() => {
    setStatus("loading");
    load().then(() => setStatus("ready")).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los datos.");
      setStatus("error");
    });
  }, [load]);

  useEffect(() => { start(); }, [start]);

  const { patients, orders, payments, services } = data;
  const findPatient = (name: string): Patient | undefined => patients.find((p) => norm(p.name) === norm(name));

  /** Paciente (si no existe) + ORDEN + estudios + muestra + abono inicial, en una sola transacción en el servidor. */
  const createAppointment = async (input: AppointmentInput) => {
    const r = await api<{ id_orden: number; id_paciente: number; id_pago: number | null }>("/recepcion/citas", {
      body: {
        nombre: input.name.trim(), telefono: digits(input.phone), whatsapp: input.whatsapp, fechaCita: input.appointmentAt.toISOString(),
        estudios: input.serviceIds.map(Number), abono: input.abono, metodo: input.method,
        preparacion: input.whatsapp ? (input.prep ?? "").trim() : "", recordatorio: input.whatsapp && input.remind === true,
        recordatorioEnvio: input.whatsapp && input.remindAt ? input.remindAt.toISOString() : undefined,
        avisoResultados: input.whatsapp && input.resultsNotice === true,
      },
    });
    const fresh = await load();
    const order = fresh.orders.find((o) => o.id === String(r.id_orden))!;
    return {
      order,
      patient: fresh.patients.find((p) => p.id === order.patientId)!,
      payment: r.id_pago === null ? null : fresh.payments.find((p) => p.id === String(r.id_pago)) ?? null,
    };
  };

  const charge = async (order: Order, amount: number, method: PayMethod): Promise<Payment> => {
    const r = await api<{ id_pago: number }>(`/recepcion/ordenes/${order.id}/pagos`, { body: { monto: amount, metodo: method } });
    const fresh = await load();
    return fresh.payments.find((p) => p.id === String(r.id_pago))!;
  };

  const deliver = async (orderId: string) => {
    await api(`/recepcion/ordenes/${orderId}/entregar`, { method: "POST", body: {} });
    await load();
  };

  const cancel = async (orderId: string, reason: string) => {
    await api(`/recepcion/ordenes/${orderId}/cancelar`, { body: { motivo: reason } });
    await load();
  };

  const updatePatient = async (id: string, input: { name: string; phone: string; whatsapp: boolean }) => {
    await api(`/recepcion/pacientes/${id.replace(/\D/g, "").replace(/^0+/, "")}`, {
      method: "PATCH", body: { nombre: input.name.trim(), telefono: digits(input.phone), whatsapp: input.whatsapp },
    });
    await load();
  };

  /** WhatsApp manual: deja el mensaje en la cola (solo si el paciente autorizó WhatsApp). */
  const queueWhatsApp = async (patientId: string, message: string, at: Date | null) => {
    await api("/recepcion/whatsapp", { body: { idPaciente: Number(patientId.replace(/\D/g, "")), mensaje: message.trim(), programadoPara: at ? at.toISOString() : undefined } });
  };

  return { patients, orders, payments, services: services as readonly Service[], status, error, retry: start, reload: load, createAppointment, charge, deliver, cancel, findPatient, updatePatient, queueWhatsApp };
}

export type ReceptionStore = ReturnType<typeof useReceptionStore>;
