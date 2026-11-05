// Cliente de la API de BioLab. El token (JWT) se guarda solo en esta pestaña (sessionStorage).
// Toda la seguridad real está en el backend; esto es únicamente comodidad.
import type { SessionUser } from "./session";

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const TOKEN_KEY = "biolab.token";

function leerToken(): string | null {
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
}

let token: string | null = leerToken();
let alExpirar: (() => void) | null = null;

export const getToken = () => token;

export function setToken(value: string | null) {
  token = value;
  try {
    if (value) sessionStorage.setItem(TOKEN_KEY, value);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch { /* sin almacenamiento: la sesión vive solo en memoria */ }
}

/** Se llama cuando el servidor responde 401 con una sesión abierta (token vencido o cuenta bloqueada). */
export function onSessionExpired(handler: (() => void) | null) { alExpirar = handler; }

export class ApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method: options.method ?? (options.body === undefined ? "GET" : "POST"),
      headers: {
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, "No se pudo conectar con el servidor. Verifica que el backend esté en marcha.", "SIN_CONEXION");
  }

  const data = (await res.json().catch(() => null)) as { error?: string; codigo?: string } | null;
  if (!res.ok) {
    if (res.status === 401 && token && path !== "/auth/login") {
      setToken(null);
      alExpirar?.();
    }
    throw new ApiError(res.status, data?.error ?? "El servidor no pudo completar la operación.", data?.codigo);
  }
  return data as T;
}

/* ------------------------------ Sesión ------------------------------ */

export async function login(usuario: string, contrasena: string): Promise<SessionUser> {
  const r = await api<{ token: string; usuario: SessionUser }>("/auth/login", { body: { usuario, contrasena } });
  setToken(r.token);
  return r.usuario;
}

export async function fetchMe(): Promise<SessionUser> {
  return (await api<{ usuario: SessionUser }>("/auth/me")).usuario;
}

export async function changePassword(actual: string, nueva: string): Promise<void> {
  await api("/auth/cambiar-contrasena", { body: { actual, nueva } });
}

/** Abre un archivo protegido (PDF) con el token de la sesión: no se puede enlazar directo porque exige autenticación. */
export async function openProtectedPdf(path: string): Promise<void> {
  const res = await fetch(`${BASE}/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new ApiError(res.status, "No se pudo abrir el reporte externo.");
  const url = URL.createObjectURL(await res.blob());
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
