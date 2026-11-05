import { useEffect, useState } from "react";
import { Button } from "../components/FormControls";
import Shell from "../components/Shell";
import { identityOf, type SessionUser } from "../lib/session";
import type { LaboratoryAction, RoleAction } from "../types";
import Laboratory from "./Laboratory";
import { useLabStore } from "./laboratory/store";

/** Módulo de Laboratorio: carga muestras, estudios y resultados de la API. */
export default function LaboratoryRoot({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const [activeAction, setActiveAction] = useState<RoleAction | null>(null);
  const lab = useLabStore();
  const identity = identityOf(user);

  // Al cambiar de pantalla se traen los datos más recientes (Recepción registra órdenes en paralelo).
  const { reload, status } = lab;
  useEffect(() => {
    if (status !== "ready") return;
    reload().catch(() => { /* se conservan los datos que ya se muestran */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAction]);

  return (
    <Shell activePage="laboratory" identity={identity} activeAction={activeAction} onAction={setActiveAction} onLogout={onLogout}>
      {lab.status === "loading" && <p className="text-sm text-slate-500">Cargando datos…</p>}
      {lab.status === "error" && (
        <div className="max-w-md rounded-xl border border-red-100 bg-red-50 p-5">
          <p className="text-sm font-medium text-red-600">{lab.error}</p>
          <Button type="button" className="mt-3" onClick={lab.retry}>Reintentar</Button>
        </div>
      )}
      {lab.status === "ready" && (
        <Laboratory lab={lab} session={identity} activeAction={activeAction as LaboratoryAction | null} onActionChange={setActiveAction} />
      )}
    </Shell>
  );
}
