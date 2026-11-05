import { useState } from "react";
import Shell from "../components/Shell";
import { identityOf, type SessionUser } from "../lib/session";
import type { ModulePage, RoleAction } from "../types";

const FASE: Record<Exclude<ModulePage, "reception">, string> = { laboratory: "Fase 3", management: "Fase 4" };

/** Pantalla temporal: este módulo todavía se está conectando a la base de datos. */
export default function PendingRoot({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const [activeAction, setActiveAction] = useState<RoleAction | null>(null);
  const modulo = user.modulo === "reception" ? "reception" : user.modulo;
  return (
    <Shell activePage={modulo} identity={identityOf(user)} activeAction={activeAction} onAction={setActiveAction} onLogout={onLogout}>
      <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-bold text-slate-800">Módulo en conexión con la base de datos</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Tu sesión ya es real ({user.nombre}, {user.rol}). Las pantallas de este rol se conectan en la {modulo === "reception" ? "Fase 2" : FASE[modulo]}.
        </p>
      </div>
    </Shell>
  );
}
