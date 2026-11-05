import { lazy, Suspense, useEffect, useState } from "react";
import Login from "./pages/login/Login";
import { fetchMe, getToken, onSessionExpired, setToken } from "./services/api";
import type { SessionUser } from "./services/session";

// Cada módulo se carga solo cuando el rol lo necesita (lazy loading). La seguridad real está en el backend.
const ReceptionRoot = lazy(() => import("./pages/reception/ReceptionRoot"));
const LaboratoryRoot = lazy(() => import("./pages/laboratory/LaboratoryRoot"));
const ManagementRoot = lazy(() => import("./pages/management/ManagementRoot"));

const Splash = () => <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500">Cargando…</div>;

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [booting, setBooting] = useState(() => getToken() !== null);

  useEffect(() => {
    onSessionExpired(() => setUser(null));
    if (getToken() === null) return;
    // Recarga de la página: se recupera la sesión desde el token guardado en esta pestaña.
    fetchMe().then(setUser).catch(() => setToken(null)).finally(() => setBooting(false));
    return () => onSessionExpired(null);
  }, []);

  const logout = () => { setToken(null); setUser(null); };

  if (booting) return <Splash />;
  if (!user) return <Login onLogin={setUser} />;

  return (
    <Suspense fallback={<Splash />}>
      {user.modulo === "reception" ? <ReceptionRoot user={user} onLogout={logout} /> : user.modulo === "management" ? <ManagementRoot user={user} onLogout={logout} /> : <LaboratoryRoot user={user} onLogout={logout} />}
    </Suspense>
  );
}
