import mysql from "mysql2/promise";
import type { Pool, PoolConnection } from "mysql2/promise";
import { getConfig } from "../config/config.js";
import { ROLES, type Rol } from "../auth/roles.js";

/**
 * TRES pools, uno por cuenta de MySQL (gerente_biolab, recepcion_biolab, quimico_biolab).
 * Cada petición usa EXCLUSIVAMENTE el pool del rol del usuario autenticado (rol que sale del JWT).
 * Así, aunque una ruta tuviera un error, MySQL rechaza lo que ese rol no puede hacer (doble protección).
 */
const pools = new Map<Rol, Pool>();

export function getPool(rol: Rol): Pool {
  let pool = pools.get(rol);
  if (!pool) {
    const cfg = getConfig();
    const cuenta = cfg.db.cuentas[rol];
    pool = mysql.createPool({
      host: cfg.db.host,
      port: cfg.db.port,
      database: cfg.db.name,
      user: cuenta.user,
      password: cuenta.password,
      timezone: cfg.db.timezone,   // cómo se leen/escriben las fechas JS
      decimalNumbers: true,        // DECIMAL llega como número (no texto)
      connectionLimit: cfg.db.poolLimit,
      waitForConnections: true,
      queueLimit: 0,
      connectTimeout: 10_000,
      enableKeepAlive: true,
      multipleStatements: false,   // una sola sentencia por consulta
    });
    pools.set(rol, pool);
  }
  return pool;
}

/**
 * Toma una conexión del pool del rol, fija la sesión y la devuelve al terminar:
 *   SET time_zone = '-06:00', @app_usuario_id = <id del token>
 * Los triggers usan @app_usuario_id para la bitácora. Como las conexiones se reutilizan,
 * se vuelve a fijar en CADA toma y se limpia al liberar.
 * `usuarioId` es null solo en el login (todavía no hay usuario).
 */
export async function withConnection<T>(
  rol: Rol,
  usuarioId: number | null,
  fn: (conn: PoolConnection) => Promise<T>,
): Promise<T> {
  if (usuarioId !== null && !Number.isInteger(usuarioId)) throw new Error("usuarioId inválido");
  const conn = await getPool(rol).getConnection();
  try {
    await conn.query("SET time_zone = ?, @app_usuario_id = ?", [getConfig().db.timezone, usuarioId]);
    return await fn(conn);
  } finally {
    try {
      await conn.query("SET @app_usuario_id = NULL");
      conn.release();
    } catch {
      conn.destroy(); // conexión en mal estado: que no vuelva al pool
    }
  }
}

/** Igual que withConnection, dentro de una transacción (COMMIT si todo sale bien, ROLLBACK si falla). */
export function withTransaction<T>(
  rol: Rol,
  usuarioId: number,
  fn: (conn: PoolConnection) => Promise<T>,
): Promise<T> {
  return withConnection(rol, usuarioId, async (conn) => {
    await conn.beginTransaction();
    try {
      const resultado = await fn(conn);
      await conn.commit();
      return resultado;
    } catch (err) {
      try { await conn.rollback(); } catch { /* la conexión se descartará */ }
      throw err;
    }
  });
}

export async function closePools(): Promise<void> {
  await Promise.allSettled([...pools.values()].map((p) => p.end()));
  pools.clear();
}

export { ROLES };
