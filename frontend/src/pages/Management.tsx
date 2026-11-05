import { useEffect, useMemo, useState } from "react";
import type { ManagementAction } from "../types";
import CashPanel from "./management/CashPanel";
import LogsPanel from "./management/LogsPanel";
import StatsPanel from "./management/StatsPanel";
import UsersPanel from "./management/UsersPanel";
import { buildCuts } from "./management/data";
import type { ManagementStore } from "./management/store";

type Action = ManagementAction;
const cards: { id: Action; title: string; description: string; actionLabel: string }[] = [
  { id: "users", title: "GESTIÓN DE USUARIOS", description: "Administración de cuentas, roles y control de acceso del personal.", actionLabel: "Administrar usuarios" },
  { id: "logs", title: "BITÁCORA INMUTABLE", description: "Registro de auditoría con filtros por día, mes, usuario y paciente.", actionLabel: "Consultar bitácora" },
  { id: "cash", title: "CORTE DE CAJA", description: "Caja en tiempo real, cierre seguro, rangos de fechas e historial de cortes.", actionLabel: "Abrir caja" },
  { id: "stats", title: "ESTADÍSTICAS GLOBALES", description: "Indicadores y gráficas de rendimiento ligadas a la caja.", actionLabel: "Ver indicadores" },
];

function AdminIcon() {
  return <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></svg>;
}

interface ManagementProps {
  store: ManagementStore;
  currentUserId: string;
  activeAction?: Action | null;
  onActionChange?: (action: Action | null) => void;
}

export default function Management({ store, currentUserId, activeAction, onActionChange }: ManagementProps) {
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
          <div className="grid max-w-5xl gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <article key={card.id} className="flex min-h-56 flex-col rounded-2xl bg-[#5B8EC4] p-5 text-white transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/15"><AdminIcon /></div>
                <h2 className="text-sm font-bold">{card.title}</h2>
                <p className="mt-2 text-xs leading-relaxed text-white/75">{card.description}</p>
                <button type="button" onClick={() => setActive(card.id)} className="mt-auto w-full rounded-xl border border-white/30 bg-white/15 px-3 py-2 text-sm font-semibold transition hover:bg-white/25">{card.actionLabel}</button>
              </article>
            ))}
          </div>
        </>
      )}

      {active === "users" && <UsersPanel users={store.users} currentUserId={currentUserId} onAdd={store.addUser} onSetActive={store.setActive} now={now} onClose={() => setActive(null)} />}
      {active === "logs" && <LogsPanel logs={store.logs} users={store.users} now={now} onClose={() => setActive(null)} />}
      {active === "cash" && <CashPanel payments={store.payments} cuts={cuts} now={now} onClose={() => setActive(null)} />}
      {active === "stats" && <StatsPanel payments={store.payments} studies={store.studies} now={now} onClose={() => setActive(null)} />}
    </div>
  );
}
