import { useEffect, useState } from "react";
import { Button } from "../components/FormControls";
import Shell from "../components/Shell";
import { identityOf, type SessionUser } from "../lib/session";
import type { ManagementAction, RoleAction } from "../types";
import Management from "./Management";
import { useManagementStore } from "./management/store";

/** Módulo de Gerencia: carga usuarios, bitácora, pagos y estudios desde la API. */
export default function ManagementRoot({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const [activeAction, setActiveAction] = useState<RoleAction | null>(null);
  const store = useManagementStore();

  // Al cambiar de pantalla se traen los datos más recientes.
  const { reload, status } = store;
  useEffect(() => {
    if (status !== "ready") return;
    reload().catch(() => { /* se conservan los datos que ya se muestran */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAction]);

  return (
    <Shell activePage="management" identity={identityOf(user)} activeAction={activeAction} onAction={setActiveAction} onLogout={onLogout}>
      {store.status === "loading" && <p className="text-sm text-slate-500">Cargando datos…</p>}
      {store.status === "error" && (
        <div className="max-w-md rounded-xl border border-red-100 bg-red-50 p-5">
          <p className="text-sm font-medium text-red-600">{store.error}</p>
          <Button type="button" className="mt-3" onClick={store.retry}>Reintentar</Button>
        </div>
      )}
      {store.status === "ready" && (
        <Management store={store} currentUserId={String(user.id)} activeAction={activeAction as ManagementAction | null} onActionChange={setActiveAction} />
      )}
    </Shell>
  );
}
