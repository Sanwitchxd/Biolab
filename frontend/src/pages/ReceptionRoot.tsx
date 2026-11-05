import { useEffect, useState } from "react";
import { Button } from "../components/FormControls";
import Shell, { type ShellNotice } from "../components/Shell";
import { dateTimeLabel } from "../lib/format";
import { useNotifications } from "../lib/notifications";
import { identityOf, type SessionUser } from "../lib/session";
import type { ReceptionAction, RoleAction } from "../types";
import Reception from "./Reception";
import { useReceptionStore } from "./reception/store";

/** Módulo de Recepción: carga sus datos de la API y los comparte entre sus paneles. */
export default function ReceptionRoot({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const [activeAction, setActiveAction] = useState<RoleAction | null>(null);
  const store = useReceptionStore();
  const notifications = useNotifications(true);

  // Al cambiar de pantalla se traen los datos más recientes (el laboratorio trabaja sobre las mismas órdenes).
  const { reload, status } = store;
  const { refresh } = notifications;
  useEffect(() => {
    if (status !== "ready") return;
    reload().catch(() => { /* se conservan los datos que ya se muestran */ });
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAction]);

  const notices: ShellNotice[] = notifications.list.slice(0, 25).map((n) => ({
    id: n.id,
    title: `${n.type} · ${n.folio}`,
    body: `${n.patientName}: ${n.message}`,
    time: dateTimeLabel(n.at),
    tone: n.type === "Alerta de retoma" ? "warning" : "success",
    pending: n.state === "Pendiente",
    badge: `${n.channel} · ${n.state}`,
    attendable: n.state === "Pendiente",
  }));

  return (
    <Shell
      activePage="reception"
      identity={identityOf(user)}
      activeAction={activeAction}
      onAction={setActiveAction}
      notices={notices}
      onAttendNotice={notifications.attend}
      onLogout={onLogout}
    >
      {store.status === "loading" && <p className="text-sm text-slate-500">Cargando datos…</p>}
      {store.status === "error" && (
        <div className="max-w-md rounded-xl border border-red-100 bg-red-50 p-5">
          <p className="text-sm font-medium text-red-600">{store.error}</p>
          <Button type="button" className="mt-3" onClick={store.retry}>Reintentar</Button>
        </div>
      )}
      {store.status === "ready" && (
        <Reception store={store} activeAction={activeAction as ReceptionAction | null} onActionChange={setActiveAction} />
      )}
    </Shell>
  );
}
