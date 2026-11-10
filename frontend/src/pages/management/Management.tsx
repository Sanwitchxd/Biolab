import { useEffect, useMemo, useState } from "react";
import type { ManagementAction } from "../../types";
import ModuleCard from "../../components/ui/ModuleCard";
import CatalogPanel from "./CatalogPanel";
import CashPanel from "./CashPanel";
import LogsPanel from "./LogsPanel";
import StatsPanel from "./StatsPanel";
import UsersPanel from "./UsersPanel";
import ChatPanel from "../../components/chat/ChatPanel";
import { buildCuts } from "./data";
import type { ManagementStore } from "./store";

type Action = ManagementAction;
const cards: { id: Action; title: string; description: string; actionLabel: string }[] = [
  { id: "users", title: "GESTIÓN DE USUARIOS", description: "Administración de cuentas, roles y control de acceso del personal.", actionLabel: "Administrar usuarios" },
  { id: "catalog", title: "CATÁLOGO DE ESTUDIOS", description: "Alta y edición de estudios, precios y parámetros con sus valores de referencia.", actionLabel: "Administrar catálogo" },
  { id: "logs", title: "BITÁCORA INMUTABLE", description: "Registro de auditoría con filtros por día, mes, usuario y paciente.", actionLabel: "Consultar bitácora" },
  { id: "cash", title: "CORTE DE CAJA", description: "Caja en tiempo real, cierre seguro, rangos de fechas e historial de cortes.", actionLabel: "Abrir caja" },
  { id: "stats", title: "ESTADÍSTICAS GLOBALES", description: "Indicadores y gráficas de rendimiento ligadas a la caja.", actionLabel: "Ver indicadores" },
  { id: "messages", title: "MENSAJES", description: "Chat interno con Recepción y Laboratorio.", actionLabel: "Abrir chat" },
];

function AdminIcon() {
  return <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></svg>;
}

interface ManagementProps {
  store: ManagementStore;
  currentUserId: string;
  onChatActivity?: () => void;
  activeAction?: Action | null;
  onActionChange?: (action: Action | null) => void;
}

export default function Management({ store, currentUserId, onChatActivity, activeAction, onActionChange }: ManagementProps) {
  const [localActive, setLocalActive] = useState<Action | null>(null);
  const active = activeAction === undefined ? localActive : activeAction;
  const setActive = onActionChange ?? setLocalActive;

  // Reloj compartido: alimenta la caja en tiempo real y las sesiones en curso.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);

  const cuts = useMemo(() => buildCuts(store.payments, now), [store.payments, now]);

  return (
    <div>
      {active === null && (
        <>
          <div className="mb-6">
            <h1 className="text-xl font-bold text-slate-800">Gerencia</h1>
            <p className="mt-0.5 text-sm text-slate-500">Interfaz Administrativa — Control y supervisión del sistema</p>
          </div>
          <div className="grid max-w-6xl gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => (
              <ModuleCard key={card.id} title={card.title} description={card.description} actionLabel={card.actionLabel} icon={<AdminIcon />} onAction={() => setActive(card.id)} />
            ))}
          </div>
        </>
      )}

      {active === "users" && <UsersPanel users={store.users} currentUserId={currentUserId} onAdd={store.addUser} onSetActive={store.setActive} payroll={store.payroll} onSetSalary={store.setSalary} onPay={store.payPeriod} now={now} onClose={() => setActive(null)} />}
      {active === "catalog" && <CatalogPanel catalog={store.catalog} onCreate={store.createStudy} onUpdate={store.updateStudy} onClose={() => setActive(null)} />}
      {active === "logs" && <LogsPanel logs={store.logs} users={store.users} now={now} onClose={() => setActive(null)} />}
      {active === "cash" && <CashPanel payments={store.payments} cuts={cuts} now={now} onClose={() => setActive(null)} />}
      {active === "messages" && <ChatPanel onActivity={onChatActivity} onClose={() => setActive(null)} />}
      {active === "stats" && <StatsPanel payments={store.payments} studies={store.studies} now={now} onClose={() => setActive(null)} />}
    </div>
  );
}
