import type { NextFunction, Request, Response } from "express";
import { HttpError } from "./errors.js";

/** Roles de la aplicación = valores de USUARIO.rol en MySQL. */
export const ROLES = ["Gerente", "Recepcionista", "Químico"] as const;
export type Rol = (typeof ROLES)[number];

export const esRol = (valor: unknown): valor is Rol =>
  typeof valor === "string" && (ROLES as readonly string[]).includes(valor);

/** Módulo del frontend que corresponde a cada rol. */
export const MODULO_POR_ROL: Record<Rol, "management" | "reception" | "laboratory"> = {
  Gerente: "management",
  Recepcionista: "reception",
  Químico: "laboratory",
};

/**
 * Middleware de rol: se pone en CADA grupo de rutas (después de `authenticate`).
 * Es la primera barrera; la segunda son los permisos de MySQL del pool de ese rol.
 */
export function requireRole(...permitidos: Rol[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const rol = req.user?.rol;
    if (!rol) return next(new HttpError(401, "Inicia sesión para continuar."));
    if (!permitidos.includes(rol)) {
      return next(new HttpError(403, "Tu rol no tiene permiso para esta operación."));
    }
    next();
  };
}
