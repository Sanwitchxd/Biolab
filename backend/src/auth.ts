import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import type { RowDataPacket } from "mysql2/promise";
import { getConfig } from "./config.js";
import { withConnection } from "./db.js";
import { HttpError } from "./errors.js";
import { esRol, type Rol } from "./roles.js";

/** sp_login_usuario lo pueden ejecutar los 3 roles; se usa la cuenta de menor privilegio. */
export const ROL_PARA_LOGIN: Rol = "Químico";

export interface FilaLogin {
  id_usuario: number;
  nombre_completo: string;
  contrasena_hash: string;
  rol: string;
  estado: string;
}

/** CALL sp_login_usuario(nombre_usuario) con el pool indicado. */
export async function buscarUsuarioLogin(rolPool: Rol, nombreUsuario: string): Promise<FilaLogin | null> {
  return withConnection(rolPool, null, async (conn) => {
    const [resultado] = await conn.query<RowDataPacket[][]>("CALL sp_login_usuario(?)", [nombreUsuario]);
    const filas = Array.isArray(resultado[0]) ? resultado[0] : [];
    return (filas[0] as unknown as FilaLogin | undefined) ?? null;
  });
}

/* ------------------------------- JWT ------------------------------- */

export function firmarToken(u: { id: number; usuario: string; nombre: string; rol: Rol }): string {
  const { jwt: cfg } = getConfig();
  return jwt.sign({ usuario: u.usuario, nombre: u.nombre, rol: u.rol }, cfg.secret, {
    algorithm: "HS256",
    subject: String(u.id),
    expiresIn: cfg.expiresIn as SignOptions["expiresIn"],
  });
}

/* ------------------- ¿la cuenta sigue activa y con el mismo rol? ------------------- */
// Un token firmado dura horas; sin esto, un usuario bloqueado o cambiado de rol seguiría
// entrando hasta que expire. Se consulta sp_login_usuario (con el pool de SU rol) y se
// recuerda el resultado 30 s para no cargar la base en cada petición.
const TTL_ESTADO_MS = 30_000;
const estadoCache = new Map<number, { hasta: number }>();

async function confirmarVigencia(u: NonNullable<Request["user"]>): Promise<void> {
  const vigente = estadoCache.get(u.id);
  if (vigente && vigente.hasta > Date.now()) return;
  const fila = await buscarUsuarioLogin(u.rol, u.usuario);
  if (!fila || fila.id_usuario !== u.id || fila.estado !== "Activo" || fila.rol !== u.rol) {
    estadoCache.delete(u.id);
    throw new HttpError(401, "Tu sesión ya no es válida. Inicia sesión de nuevo.", "SESION_INVALIDA");
  }
  estadoCache.set(u.id, { hasta: Date.now() + TTL_ESTADO_MS });
}

/** Verifica el JWT y deja el usuario (id y rol del TOKEN) en req.user. */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const cabecera = req.headers.authorization ?? "";
  const [esquema, token] = cabecera.split(" ");
  if (esquema !== "Bearer" || !token) {
    return next(new HttpError(401, "Inicia sesión para continuar.", "SIN_TOKEN"));
  }

  let payload: unknown;
  try {
    payload = jwt.verify(token, getConfig().jwt.secret, { algorithms: ["HS256"] });
  } catch {
    return next(new HttpError(401, "Tu sesión expiró o no es válida. Inicia sesión de nuevo.", "TOKEN_INVALIDO"));
  }

  const p = payload as { sub?: unknown; usuario?: unknown; nombre?: unknown; rol?: unknown };
  const id = Number(p.sub);
  if (!Number.isInteger(id) || typeof p.usuario !== "string" || typeof p.nombre !== "string" || !esRol(p.rol)) {
    return next(new HttpError(401, "Tu sesión no es válida. Inicia sesión de nuevo.", "TOKEN_INVALIDO"));
  }

  const usuario = { id, usuario: p.usuario, nombre: p.nombre, rol: p.rol };
  try {
    await confirmarVigencia(usuario);
  } catch (err) {
    return next(err);
  }
  req.user = usuario;
  next();
}

/** Hash de relleno: se compara aunque el usuario no exista, para que tarde igual (evita adivinar usuarios). */
export const HASH_RELLENO = bcrypt.hashSync("relleno-" + Math.random().toString(36), 10);
export const compararContrasena = (plana: string, hash: string) => bcrypt.compare(plana, hash);
export const hashContrasena = (plana: string) => bcrypt.hash(plana, 12);
