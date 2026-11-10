import { useState } from "react";
import { changePassword } from "../../services/api";
import type { Identity } from "../../services/session";
import type { ModulePage, RoleAction } from "../../types";

/** Aviso mostrado en la campana del encabezado. Si `notices` no se envía, se muestra el aviso genérico. */
export interface ShellNotice {
  id: string;
  title: string;
  body: string;
  time?: string;
  tone: "info" | "success" | "warning" | "danger";
  /** Cuenta para el contador rojo (sin leer / sin atender). */
  pending: boolean;
  badge?: string;
  /** Muestra el botón "Marcar atendida". */
  attendable?: boolean;
}

const NOTICE_STYLE: Record<ShellNotice["tone"], string> = {
  info: "border-blue-100 bg-blue-50", success: "border-emerald-100 bg-emerald-50", warning: "border-amber-100 bg-amber-50", danger: "border-red-100 bg-red-50",
};

interface ShellProps {
  activePage: ModulePage;
  /** Quién inició sesión (viene del backend). */
  identity: Identity;
  activeAction: RoleAction | null;
  onAction: (action: RoleAction) => void;
  onLogout: () => void;
  notices?: ShellNotice[];
  onAttendNotice?: (id: string) => void;
  /** Contadores rojos junto a las opciones del menú (por ejemplo, mensajes sin leer). */
  badges?: Partial<Record<RoleAction, number>>;
  children: React.ReactNode;
}

type NavItem = {
  id: RoleAction;
  label: string;
  icon: "user" | "calendar" | "file" | "card" | "sample" | "alert" | "pulse" | "check" | "users" | "log" | "cash" | "chart" | "chat" | "whatsapp";
};

const roleNav: Record<ModulePage, NavItem[]> = {
  reception: [
    { id: "patients", label: "Pacientes", icon: "user" },
    { id: "appointments", label: "Citas", icon: "calendar" },
    { id: "payments", label: "Cobros", icon: "card" },
    { id: "whatsapp", label: "WhatsApp", icon: "whatsapp" },
    { id: "messages", label: "Mensajes", icon: "chat" },
  ],
  laboratory: [
    { id: "samples", label: "Recepción de muestras", icon: "sample" },
    { id: "incidents", label: "Registro de incidencias", icon: "alert" },
    { id: "results", label: "Captura de resultados", icon: "pulse" },
    { id: "validation", label: "Validación médica", icon: "check" },
    { id: "messages", label: "Mensajes", icon: "chat" },
  ],
  management: [
    { id: "users", label: "Gestión de usuarios", icon: "users" },
    { id: "catalog", label: "Catálogo de estudios", icon: "sample" },
    { id: "logs", label: "Bitácora", icon: "log" },
    { id: "cash", label: "Corte de caja", icon: "cash" },
    { id: "stats", label: "Estadísticas globales", icon: "chart" },
    { id: "messages", label: "Mensajes", icon: "chat" },
  ],
};

const moduleNames: Record<ModulePage, string> = {
  reception: "Recepción",
  laboratory: "Laboratorio",
  management: "Gerencia",
};

function NavIcon({ name }: { name: NavItem["icon"] }) {
  const common = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2 };
  if (name === "user") return <svg {...common}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
  if (name === "calendar") return <svg {...common}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>;
  if (name === "file" || name === "log") return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></svg>;
  if (name === "card") return <svg {...common}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20M6 15h3" /></svg>;
  if (name === "sample") return <svg {...common}><path d="M9 3h6M10 3v7l-5 8a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-8V3" /><path d="M8 15h8" /></svg>;
  if (name === "alert") return <svg {...common}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></svg>;
  if (name === "pulse") return <svg {...common}><path d="M3 12h4l2-7 4 14 2-7h6" /></svg>;
  if (name === "check") return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></svg>;
  if (name === "users") return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8.5 11a4 4 0 1 0 0-8M20 8v6M23 11h-6" /></svg>;
  if (name === "chat") return <svg {...common}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
  if (name === "whatsapp") return <svg {...common}><path d="M3 21l1.7-5.1A8.5 8.5 0 1 1 8.3 19.4z" /><path d="M9 10c0 3 2 5 5 5l1.2-1.4-2-1-.8.8c-.8-.4-1.6-1.2-2-2l.8-.8-1-2z" /></svg>;
  if (name === "cash") return <svg {...common}><rect x="2" y="5" width="20" height="14" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M6 9H5v1M18 15h1v-1" /></svg>;
  return <svg {...common}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>;
}

function MicroscopeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2">
      <path d="M6 18h8M3 21h18M14 21v-3a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v3M10 13a5 5 0 0 0 5-5V6M13 6l2-2 4 4-2 2M15 4l-4 4" />
    </svg>
  );
}

export default function Shell({ activePage, identity, activeAction, onAction, onLogout, notices, onAttendNotice, badges, children }: ShellProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const unread = notices === undefined ? 1 : notices.filter((n) => n.pending).length;
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwMessage, setPwMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pw.next.length < 8) return setPwMessage({ type: "error", text: "La nueva contraseña debe tener al menos 8 caracteres." });
    if (pw.next === pw.current) return setPwMessage({ type: "error", text: "La nueva contraseña debe ser distinta a la actual." });
    if (pw.next !== pw.confirm) return setPwMessage({ type: "error", text: "La confirmación no coincide." });
    try {
      await changePassword(pw.current, pw.next);
      setPw({ current: "", next: "", confirm: "" });
      setPwMessage({ type: "ok", text: "Contraseña actualizada correctamente." });
    } catch (err) {
      setPwMessage({ type: "error", text: err instanceof Error ? err.message : "No se pudo cambiar la contraseña." });
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <aside className="flex w-60 flex-shrink-0 flex-col border-r border-slate-200 bg-slate-200">
        <div className="flex h-[60px] items-center gap-2 border-b border-slate-300 px-5">
          <MicroscopeIcon />
          <span className="text-sm font-bold tracking-wide text-slate-800">BIOLAB</span>
        </div>
        <div className="px-4 py-5">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">{moduleNames[activePage]}</p>
          <nav className="flex flex-col gap-1.5">
            {roleNav[activePage].map((item) => {
              const selected = activeAction === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onAction(item.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-medium transition ${selected ? "bg-blue-100 text-blue-700 shadow-sm" : "text-slate-600 hover:bg-white/60 hover:text-slate-900"}`}
                >
                  <span className={selected ? "text-blue-500" : "text-slate-400"}><NavIcon name={item.icon} /></span>
                  <span className="flex-1">{item.label}</span>
                  {(badges?.[item.id] ?? 0) > 0 && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">{(badges![item.id] ?? 0) > 9 ? "9+" : badges![item.id]}</span>}
                </button>
              );
            })}
          </nav>
        </div>
        <div className="mt-auto border-t border-slate-300 p-4">
          <button type="button" onClick={onLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 transition hover:bg-red-50 hover:text-red-600">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex min-h-[60px] flex-shrink-0 items-center justify-between border-b border-slate-200 bg-slate-300 px-5">
          <div>
            <p className="text-sm font-bold text-slate-800">{moduleNames[activePage]}</p>
            <p className="text-[11px] text-slate-500">Panel exclusivo de {identity.role.toLowerCase()}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button type="button" onClick={() => { setNotificationsOpen((open) => !open); setProfileOpen(false); }} aria-label="Ver notificaciones" className="relative rounded-lg p-2 transition hover:bg-white/50">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
                {notices === undefined
                  ? <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
                  : unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">{unread > 9 ? "9+" : unread}</span>}
              </button>
              {notificationsOpen && (
                <div className="absolute right-0 top-11 z-20 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                  <p className="text-sm font-semibold text-slate-800">Notificaciones</p>
                  {notices === undefined ? (
                    <p className="mt-2 rounded-lg bg-blue-50 p-3 text-xs leading-relaxed text-slate-600">Tienes actividades pendientes en el módulo de {moduleNames[activePage].toLowerCase()}.</p>
                  ) : notices.length === 0 ? (
                    <p className="mt-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">Sin notificaciones por ahora.</p>
                  ) : (
                    <ul className="mt-2 max-h-96 space-y-2 overflow-y-auto">
                      {notices.map((n) => (
                        <li key={n.id} className={`rounded-lg border p-3 ${NOTICE_STYLE[n.tone]} ${n.pending ? "" : "opacity-60"}`}>
                          <p className="text-xs font-semibold text-slate-800">{n.title}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{n.body}</p>
                          {(n.time || n.badge) && <p className="mt-1 text-[10px] text-slate-400">{[n.time, n.badge].filter(Boolean).join(" · ")}</p>}
                          {n.attendable && onAttendNotice && <button type="button" onClick={() => onAttendNotice(n.id)} className="mt-2 text-[11px] font-semibold text-blue-600 hover:underline">Marcar atendida</button>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <div className="h-7 w-px bg-slate-400/40" />
            <div className="relative">
              <button
                type="button"
                onClick={() => { setProfileOpen((open) => !open); setNotificationsOpen(false); }}
                aria-expanded={profileOpen}
                className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-left transition hover:bg-white/50"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-card-blue text-xs font-semibold text-white">{identity.initials}</div>
                <div className="leading-tight">
                  <div className="text-xs font-semibold text-slate-800">{identity.name}</div>
                  <div className="text-[11px] text-slate-500">{identity.role}</div>
                </div>
                <svg className={`ml-1 text-slate-500 transition ${profileOpen ? "rotate-180" : ""}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-12 z-30 w-96 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  <div className="bg-gradient-to-r from-blue-500 to-sky-500 px-5 py-5 text-white">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-white/20 text-sm font-bold">{identity.initials}</div>
                      <div>
                        <p className="text-sm font-bold">{identity.fullName}</p>
                        <p className="mt-0.5 text-xs text-blue-100">{identity.role} · {identity.employeeId}</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="mb-5">
                      <div className="mb-3 flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-700">Datos generales</p>
                      </div>
                      <dl className="grid grid-cols-[90px_1fr] gap-x-3 gap-y-2 rounded-xl bg-slate-50 p-4 text-xs">
                        <dt className="text-slate-400">Nombre</dt><dd className="font-medium text-slate-700">{identity.fullName}</dd>
                        <dt className="text-slate-400">{identity.contactLabel}</dt><dd className="font-medium text-slate-700">{identity.contact}</dd>
                        <dt className="text-slate-400">Área</dt><dd className="font-medium text-slate-700">{identity.area}</dd>
                        <dt className="text-slate-400">Estado</dt><dd><span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">Activo</span></dd>
                      </dl>
                    </div>
                    <div className="border-t border-slate-100 pt-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-700">Cambiar contraseña</p>
                        </div>
                      </div>
                      <form onSubmit={submitPassword} className="space-y-2">
                        {pwMessage && <p className={`rounded-lg px-3 py-2 text-xs font-medium ${pwMessage.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{pwMessage.text}</p>}
                        <input required type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} placeholder="Contraseña actual" autoComplete="current-password" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-400 focus:bg-white" />
                        <div className="grid grid-cols-2 gap-2">
                          <input required type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} placeholder="Nueva contraseña" autoComplete="new-password" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-400 focus:bg-white" />
                          <input required type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} placeholder="Confirmar contraseña" autoComplete="new-password" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-400 focus:bg-white" />
                        </div>
                        <button type="submit" className="w-full rounded-lg bg-blue-500 py-2 text-xs font-semibold text-white transition hover:bg-blue-600">Actualizar contraseña</button>
                      </form>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
