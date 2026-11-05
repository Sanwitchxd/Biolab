// Notificaciones de Recepción (tabla NOTIFICACION). Vocabulario alineado con la base: tipo, canal y estado.
// El químico no puede leer NOTIFICACION; solo Recepción usa este hook.
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export type NotificationType = "Resultado listo" | "Alerta de retoma" | "Recordatorio";
export type NotificationChannel = "WhatsApp" | "Pantalla de recepción" | "Físico en sucursal";
export type NotificationState = "Pendiente" | "Enviada" | "Fallida" | "Atendida";

export interface AppNotification {
  id: string;
  orderId: string;
  folio: string;
  patientName: string;
  type: NotificationType;
  channel: NotificationChannel;
  state: NotificationState;
  message: string;
  at: Date;
}

interface Raw {
  id_notificacion: number; id_orden: number; folio: string; paciente: string;
  tipo: NotificationType; canal: NotificationChannel; estado: NotificationState; fecha_hora: string;
}

const MENSAJE: Record<NotificationType, (canal: NotificationChannel) => string> = {
  "Resultado listo": (canal) =>
    canal === "WhatsApp" ? "Resultados listos: avisar al paciente por WhatsApp."
    : canal === "Físico en sucursal" ? "Resultados listos: paciente sin WhatsApp, avisar de forma física en sucursal."
    : "Los resultados de la orden están liberados y listos para entrega.",
  "Alerta de retoma": () => "Una muestra tuvo una incidencia. Contactar al paciente para una nueva toma.",
  Recordatorio: (canal) => (canal === "WhatsApp" ? "Recordatorio de cita para mañana (WhatsApp)." : "Recordatorio de cita para mañana: avisar de forma física."),
};

const POLL_MS = 30_000;

export function useNotifications(enabled: boolean) {
  const [list, setList] = useState<AppNotification[]>([]);

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ notificaciones: Raw[] }>("/recepcion/notificaciones");
      setList(r.notificaciones.map((n): AppNotification => ({
        id: String(n.id_notificacion), orderId: String(n.id_orden), folio: n.folio, patientName: n.paciente,
        type: n.tipo, channel: n.canal, state: n.estado, message: MENSAJE[n.tipo](n.canal), at: new Date(n.fecha_hora),
      })));
    } catch { /* la campana se vuelve a intentar en el siguiente ciclo */ }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [enabled, refresh]);

  const attend = async (id: string) => {
    setList((cur) => cur.map((n) => (n.id === id ? { ...n, state: "Atendida" } : n)));
    try { await api(`/recepcion/notificaciones/${id}`, { method: "PATCH", body: { estado: "Atendida" } }); }
    catch { void refresh(); }
  };

  return { list, attend, refresh };
}

export type NotificationsStore = ReturnType<typeof useNotifications>;
