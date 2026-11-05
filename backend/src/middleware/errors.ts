import type { NextFunction, Request, Response } from "express";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

const SIN_CONEXION = new Set([
  "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EHOSTUNREACH", "ECONNRESET",
  "PROTOCOL_CONNECTION_LOST", "ER_CON_COUNT_ERROR", "POOL_CLOSED",
]);

/**
 * Traduce un error de MySQL a un mensaje claro para el frontend.
 * Devuelve null si el error no es de MySQL. Nunca expone SQL ni credenciales.
 */
export function traducirErrorDb(err: unknown): HttpError | null {
  if (!err || typeof err !== "object") return null;
  const e = err as { errno?: number; code?: string; sqlMessage?: string };

  if (e.code && SIN_CONEXION.has(e.code)) {
    return new HttpError(503, "No hay conexión con la base de datos. Intenta de nuevo en unos segundos.", "DB_NO_DISPONIBLE");
  }
  if (typeof e.errno !== "number") return null;

  switch (e.errno) {
    case 1044: // acceso denegado a la base
    case 1142: // sin permiso sobre la tabla
    case 1143: // sin permiso sobre la columna
    case 1227: // falta privilegio
    case 1370: // sin permiso para ejecutar el procedimiento
      return new HttpError(403, "Tu rol no tiene permiso en la base de datos para esta operación.", "DB_PERMISO");
    case 1045: // las credenciales de la cuenta MySQL del .env son incorrectas
      return new HttpError(503, "El servidor no pudo autenticarse con la base de datos. Avisa al administrador.", "DB_CREDENCIALES");
    case 1644: // SIGNAL de un trigger/procedimiento: regla de negocio con mensaje propio
      return new HttpError(409, e.sqlMessage || "La base de datos rechazó la operación.", "REGLA_NEGOCIO");
    case 3819: // CHECK (MySQL)
    case 4025: // CHECK (MariaDB)
      return new HttpError(422, "Alguno de los datos no es válido.", "DATO_INVALIDO");
    case 1062:
      return new HttpError(409, "Ya existe un registro con ese valor.", "DUPLICADO");
    case 1451:
    case 1452:
      return new HttpError(422, "El registro está relacionado con otro que no existe o que depende de él.", "RELACION");
    case 1048:
    case 1264:
    case 1265:
    case 1292:
    case 1366:
    case 1406:
      return new HttpError(422, "Alguno de los datos no es válido o es demasiado largo.", "DATO_INVALIDO");
    case 1205:
    case 1213:
      return new HttpError(503, "La base de datos está ocupada. Intenta de nuevo.", "DB_OCUPADA");
    default:
      return new HttpError(500, "Error en la base de datos.", "DB_ERROR");
  }
}

export function notFound(_req: Request, _res: Response, next: NextFunction): void {
  next(new HttpError(404, "Ruta no encontrada."));
}

/** Manejador final de errores: respuesta JSON { error, codigo } sin detalles internos. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  let http: HttpError;

  if (err instanceof HttpError) {
    http = err;
  } else {
    const db = traducirErrorDb(err);
    const e = err as { status?: number; type?: string };
    if (db) {
      http = db;
    } else if (typeof e?.status === "number" && e.status >= 400 && e.status < 500) {
      // errores del analizador JSON (cuerpo mal formado, demasiado grande...)
      http = new HttpError(e.status, "Solicitud no válida.", "SOLICITUD");
    } else {
      http = new HttpError(500, "Error interno del servidor.", "INTERNO");
    }
    registrar(req, http, err);
  }

  if (http.status === 403 && http.code === "DB_PERMISO") {
    // MySQL frenó algo que la ruta no debió intentar: conviene enterarse.
    console.warn(`[PERMISO] ${req.method} ${req.path} rol=${req.user?.rol ?? "-"}: MySQL rechazó la operación`);
  }

  res.status(http.status).json({ error: http.message, ...(http.code ? { codigo: http.code } : {}) });
}

function registrar(req: Request, http: HttpError, err: unknown): void {
  if (http.status < 500 && http.code !== "DB_ERROR") return;
  const e = err as { errno?: number; code?: string; sqlMessage?: string; message?: string; stack?: string };
  // No se imprime e.sql (puede traer datos de pacientes) ni el cuerpo de la petición.
  const detalle = e?.errno !== undefined
    ? `mysql errno=${e.errno} code=${e.code ?? "-"} ${e.sqlMessage ?? ""}`
    : (e?.stack ?? String(err));
  console.error(`[ERROR] ${req.method} ${req.path} -> ${http.status} ${http.code ?? ""} ${detalle}`);
}
