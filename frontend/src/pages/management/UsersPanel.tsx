import { useState } from "react";
import { Button, Field, Input, Notice, Select, Workspace } from "../../components/ui/FormControls";
import Modal from "../../components/ui/Modal";
import { dateTimeLabel, relativeDay, timeLabel, type Payroll, type PayrollMethod, type Periodicidad, type StaffUser, type UserRole } from "./data";
import { nameError, norm, USERNAME_RE, squash } from "../../utils/validation";
import PayrollSection from "./PayrollSection";

const initials = (name: string) => name.split(" ").map((p) => p[0]).slice(0, 2).join("");

function sessionSummaryLine(user: StaffUser, now: Date) {
  if (!user.lastLogin) return "Aún no ha iniciado sesión";
  return `Último inicio de sesión: ${relativeDay(user.lastLogin, now).toLowerCase()} ${timeLabel(user.lastLogin)}`;
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}

interface Props {
  users: StaffUser[];
  currentUserId: string;
  onAdd: (input: { name: string; username: string; password: string; role: UserRole }) => Promise<void>;
  onSetActive: (user: StaffUser, active: boolean) => Promise<void>;
  payroll: Payroll[];
  onSetSalary: (user: StaffUser, input: { salary: number; periodicity: Periodicidad; startDate: string }) => Promise<void>;
  onPay: (user: StaffUser, input: { period: string; method: PayrollMethod; note: string; amount?: number }) => Promise<void>;
  now: Date;
  onClose: () => void;
}

export default function UsersPanel({ users, currentUserId, onAdd, onSetActive, payroll, onSetSalary, onPay, now, onClose }: Props) {
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const selected = users.find((u) => u.id === selectedId) ?? null;

  const openUser = (id: string) => { setSelectedId(id); setConfirmToggle(false); setError(""); };
  const fail = (e: unknown) => setError(e instanceof Error ? e.message : "No se pudo completar la operación.");

  const addUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const name = squash(String(form.get("name")));
    const username = String(form.get("username")).trim();
    const password = String(form.get("password"));
    const role = String(form.get("role")) as UserRole;
    setError(""); setNotice("");
    const nErr = nameError(name);
    if (nErr) return setError(nErr);
    if (username.length < 3 || !USERNAME_RE.test(username)) return setError("El usuario debe tener al menos 3 caracteres y solo letras, números, punto, guion y guion bajo (sin espacios).");
    if (users.some((u) => norm(u.username) === norm(username))) return setError(`El usuario «${username}» ya existe. Elige otro.`);
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return setError("La contraseña debe combinar letras y números.");
    if (norm(password) === norm(username)) return setError("La contraseña no puede ser igual al usuario.");
    setBusy(true); setError(""); setNotice("");
    try {
      await onAdd({ name, username, password, role });
      setNotice(`Usuario ${name} creado correctamente.`);
      formEl.reset();
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const toggleActive = async (user: StaffUser) => {
    setBusy(true); setError(""); setNotice("");
    try {
      await onSetActive(user, !user.active);
      setNotice(`Cuenta de ${user.name} ${user.active ? "desactivada" : "activada"}.`);
      setConfirmToggle(false);
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const isSelf = selected?.id === currentUserId;

  return (
    <Workspace title="Gestión de usuarios" subtitle="Administra el acceso y estado del personal · Exclusivo para Gerencia" onClose={onClose}>
      {notice && <Notice>{notice}</Notice>}
      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</p>}

      <form onSubmit={addUser} className="mb-6 grid gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_auto]">
        <Field label="Nombre"><Input name="name" required minLength={3} maxLength={100} placeholder="Nombre completo" /></Field>
        <Field label="Usuario"><Input name="username" required minLength={3} maxLength={30} pattern="[A-Za-z0-9_.\-]+" title="Letras, números, punto, guion y guion bajo" autoComplete="off" placeholder="usuario01" /></Field>
        <Field label="Contraseña"><Input name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" placeholder="8+, letras y números" /></Field>
        <Field label="Rol"><Select name="role" defaultValue="Recepcionista"><option>Recepcionista</option><option>Químico</option><option>Gerencia</option></Select></Field>
        <Button type="submit" className="self-end" disabled={busy}>Agregar</Button>
      </form>

      <p className="mb-3 text-xs text-slate-400">Haz clic (o doble clic) sobre un empleado para ver su información y controlar su acceso.</p>
      <ul className="space-y-2">
        {users.map((user) => {
          const live = false;
          return (
            <li key={user.id}>
              <div
                role="button" tabIndex={0}
                onClick={() => openUser(user.id)} onDoubleClick={() => openUser(user.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openUser(user.id); } }}
                className="flex cursor-pointer flex-wrap items-center gap-3 rounded-xl border border-slate-100 p-4 transition hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">
                  {initials(user.name)}
                  <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${live ? "bg-emerald-500" : "bg-slate-300"}`} />
                </div>
                <div className="min-w-48 flex-1">
                  <p className="text-sm font-semibold text-slate-800">{user.name}{user.id === currentUserId && <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">Tú</span>}</p>
                  <p className="text-xs text-slate-500">{user.role} · {user.area}</p>
                </div>
                <p className="hidden text-xs text-slate-400 md:block">{sessionSummaryLine(user, now)}</p>
                {(payroll.find((p) => p.userId === user.id)?.owed ?? 0) > 0 && <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-600">Se le debe sueldo</span>}
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${user.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{user.active ? "Activo" : "Inactivo"}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><path d="m9 6 6 6-6 6" /></svg>
              </div>
            </li>
          );
        })}
      </ul>

      {selected && (
        <Modal
          title={selected.name}
          subtitle={`${selected.role} · ID ${selected.id}`}
          onClose={() => setSelectedId(null)}
          size="lg"
          footer={
            confirmToggle ? (
              <>
                <span className="mr-auto text-xs font-medium text-slate-600">
                  {selected.active ? "¿Desactivar esta cuenta? Perderá el acceso de inmediato." : "¿Reactivar esta cuenta?"}
                </span>
                <Button type="button" variant="secondary" onClick={() => setConfirmToggle(false)}>Cancelar</Button>
                <Button type="button" variant={selected.active ? "danger" : "success"} disabled={busy} onClick={() => toggleActive(selected)}>{selected.active ? "Sí, desactivar" : "Sí, activar"}</Button>
              </>
            ) : (
              <>
                {isSelf && <span className="mr-auto text-xs text-slate-400">No puedes desactivar tu propia cuenta.</span>}
                <Button type="button" variant="secondary" onClick={() => setSelectedId(null)}>Cerrar</Button>
                <Button type="button" variant={selected.active ? "danger" : "success"} disabled={isSelf} onClick={() => setConfirmToggle(true)}>{selected.active ? "Desactivar acceso" : "Activar acceso"}</Button>
              </>
            )
          }
        >
          <div className="mb-5 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-600">{initials(selected.name)}</div>
            <div>
              <p className="font-bold text-slate-800">{selected.name}</p>
              <span className={`mt-1 inline-block rounded-full px-3 py-0.5 text-xs font-semibold ${selected.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{selected.active ? "Activo" : "Inactivo"}</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <InfoItem label="Nombre completo" value={selected.name} />
            <InfoItem label="Usuario de acceso" value={selected.username} />
            <InfoItem label="Área de trabajo" value={selected.area} />
            <InfoItem label="Estado actual" value={selected.active ? "Activo" : "Inactivo"} />
          </div>

          <div className="mt-5 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-sky-50 p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-blue-700">Último inicio de sesión</p>
            {selected.lastLogin ? (
              <div>
                <p className="text-lg font-bold text-slate-800">{timeLabel(selected.lastLogin)}</p>
                <p className="text-[11px] text-slate-400">{relativeDay(selected.lastLogin, now)} · {dateTimeLabel(selected.lastLogin)}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Este usuario aún no ha iniciado sesión.</p>
            )}
          </div>
          <PayrollSection key={selected.id} user={selected} payroll={payroll.find((p) => p.userId === selected.id)} onSetSalary={onSetSalary} onPay={onPay} />
        </Modal>
      )}
    </Workspace>
  );
}
