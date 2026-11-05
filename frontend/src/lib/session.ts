// Identidad de la sesión: viene del backend (token firmado), nunca de datos locales.
import type { ModulePage } from "../types";

export type Rol = "Gerente" | "Recepcionista" | "Químico";

/** Usuario autenticado, tal como lo devuelve POST /api/auth/login. */
export interface SessionUser {
  id: number;
  usuario: string;
  nombre: string;
  rol: Rol;
  modulo: ModulePage;
}

/** Datos que muestra el encabezado y el perfil. */
export interface Identity {
  initials: string;
  name: string;
  fullName: string;
  /** Nombre con el que se firman registros (resultados validados, incidencias, entregas). */
  displayName: string;
  role: string;
  contactLabel: string;
  contact: string;
  employeeId: string;
  area: string;
}

export type Session = Identity;

const AREA_POR_ROL: Record<Rol, string> = {
  Gerente: "Dirección administrativa",
  Recepcionista: "Admisión y recepción",
  Químico: "Laboratorio clínico",
};
const PREFIJO_POR_ROL: Record<Rol, string> = { Gerente: "GER", Recepcionista: "REC", Químico: "LAB" };

export function identityOf(user: SessionUser): Identity {
  const partes = user.nombre.trim().split(/\s+/).filter(Boolean);
  const initials = (partes.length > 1 ? partes[0][0] + partes[1][0] : (partes[0] ?? "?").slice(0, 2)).toUpperCase();
  const name = partes.length > 1 ? `${partes[0][0]}. ${partes[1]}` : user.nombre;
  return {
    initials,
    name,
    fullName: user.nombre,
    displayName: user.nombre,
    role: user.rol,
    contactLabel: "Usuario",
    contact: user.usuario,
    employeeId: `${PREFIJO_POR_ROL[user.rol]}-${String(user.id).padStart(3, "0")}`,
    area: AREA_POR_ROL[user.rol],
  };
}
