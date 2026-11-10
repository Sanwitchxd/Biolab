import { useEffect, useState } from "react";
import { Button } from "../../components/ui/FormControls";
import Shell, { type ShellNotice } from "../../components/layout/Shell";
import { dateTimeLabel } from "../../utils/format";
import { useNotifications } from "../../services/notifications";
import { useChatSummary } from "../../services/chat";
import { useAutoRefresh } from "../../services/autorefresh";
import { identityOf, type SessionUser } from "../../services/session";
import type { ReceptionAction, RoleAction } from "../../types";
import Reception from "./Reception";
import { useReceptionStore } from "./store";

/** Módulo de Recepción: carga sus datos de la API y los comparte entre sus paneles. */
export default function ReceptionRoot({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const [activeAction, setActiveAction] = useState<RoleAction | null>(null);
  const store = useReceptionStore();
  const notifications = useNotifications(true);
  const chat = useChatSummary(true);

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

  // Los cambios que hacen los otros perfiles aparecen solos, sin recargar la página.
  useAutoRefresh(async () => { await reload(); await refresh(); }, status === "ready", 8000);

  return (
    <Shell
      activePage="reception"
      identity={identityOf(user)}
      activeAction={activeAction}
      onAction={setActiveAction}
      notices={notices}
      onAttendNotice={notifications.attend}
      badges={{ messages: chat.unread }}
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
        <Reception store={store} onChatActivity={chat.refresh} activeAction={activeAction as ReceptionAction | null} onActionChange={setActiveAction} />
      )}
    </Shell>
  );
}
