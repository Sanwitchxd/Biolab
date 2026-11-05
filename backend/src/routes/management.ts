import { Router } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { authenticate, hashContrasena } from "../auth/auth.js";
import { withConnection } from "../database/db.js";
import { HttpError } from "../middleware/errors.js";
import { requireRole } from "../auth/roles.js";
import { esFecha, fechaPagable, PERIODICIDADES, resumenNomina, type Periodicidad } from "../services/nomina.js";

/**
 * /api/gerencia/*  - SOLO Gerente (middleware 403 + permisos de la cuenta MySQL del gerente).
 * La bitácora es de lectura exclusiva: aquí solo existe GET; no hay ninguna ruta que la modifique.
 */
export const managementRouter = Router();
managementRouter.use(authenticate, requireRole("Gerente"));

const ROLES_USUARIO = ["Gerente", "Recepcionista", "Químico"] as const;

function texto(valor: unknown, max: number, que: string, min = 1): string {
  const t = typeof valor === "string" ? valor.trim() : "";
  if (t.length < min) throw new HttpError(400, `${que} es obligatorio${min > 1 ? ` (mínimo ${min} caracteres)` : ""}.`, "DATOS_INVALIDOS");
  if (t.length > max) throw new HttpError(400, `${que} es demasiado largo (máximo ${max} caracteres).`, "DATOS_INVALIDOS");
  return t;
}

function idPositivo(valor: unknown): number {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "El identificador no es válido.", "DATOS_INVALIDOS");
  return n;
}

/* ------------------------------- Usuarios ------------------------------- */

/** GET /api/gerencia/usuarios - cuentas + último inicio de sesión registrado en la bitácora. */
managementRouter.get("/usuarios", async (req, res) => {
  const usuarios = await withConnection("Gerente", req.user!.id, async (conn) => {
    const [r] = await conn.query<RowDataPacket[]>(
      `SELECT u.id_usuario, u.nombre_completo, u.nombre_usuario, u.rol, u.estado,
              (SELECT MAX(b.fecha_hora) FROM BITACORA b
                WHERE b.id_usuario = u.id_usuario AND b.accion = 'INICIO_SESION') AS ultimo_inicio
         FROM USUARIO u ORDER BY u.id_usuario`,
    );
    return r;
  });
  res.json({ usuarios });
});

/** POST /api/gerencia/usuarios { nombre, usuario, contrasena, rol } - el trigger registra CREAR_USUARIO. */
managementRouter.post("/usuarios", async (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const nombre = texto(b.nombre, 100, "El nombre", 3);
  const usuario = texto(b.usuario, 30, "El usuario", 3);
  if (!/^[A-Za-z0-9_.-]+$/.test(usuario)) {
    throw new HttpError(400, "El usuario solo puede llevar letras, números, punto, guion y guion bajo.", "DATOS_INVALIDOS");
  }
  const contrasena = typeof b.contrasena === "string" ? b.contrasena : "";
  if (contrasena.length < 8 || Buffer.byteLength(contrasena) > 72) {
    throw new HttpError(400, "La contraseña debe tener entre 8 y 72 caracteres.", "DATOS_INVALIDOS");
  }
  if (!ROLES_USUARIO.includes(b.rol as (typeof ROLES_USUARIO)[number])) {
    throw new HttpError(400, "El rol no es válido.", "DATOS_INVALIDOS");
  }
  const hash = await hashContrasena(contrasena);
  const id = await withConnection("Gerente", req.user!.id, async (conn) => {
    const [r] = await conn.query<ResultSetHeader>(
      "INSERT INTO USUARIO (nombre_completo, nombre_usuario, contrasena_hash, rol) VALUES (?, ?, ?, ?)",
      [nombre, usuario, hash, b.rol],
    );
    return r.insertId;
  });
  res.status(201).json({ id_usuario: id });
});

/** PATCH /api/gerencia/usuarios/:id/estado { estado: "Activo" | "Bloqueado" } */
managementRouter.patch("/usuarios/:id/estado", async (req, res) => {
  const id = idPositivo(req.params.id);
  const estado = (req.body ?? {}).estado;
  if (estado !== "Activo" && estado !== "Bloqueado") throw new HttpError(400, "El estado no es válido.", "DATOS_INVALIDOS");
  if (id === req.user!.id) throw new HttpError(409, "No puedes bloquear tu propia cuenta.", "AUTO_BLOQUEO");
  const filas = await withConnection("Gerente", req.user!.id, async (conn) => {
    const [r] = await conn.query<ResultSetHeader>("UPDATE USUARIO SET estado = ? WHERE id_usuario = ?", [estado, id]);
    return r.affectedRows;
  });
  if (filas === 0) throw new HttpError(404, "El usuario no existe.", "NO_ENCONTRADO");
  res.json({ ok: true });
});

/** POST /api/gerencia/usuarios/:id/contrasena { nueva } - restablecer contraseña de otro usuario. */
managementRouter.post("/usuarios/:id/contrasena", async (req, res) => {
  const id = idPositivo(req.params.id);
  const nueva = typeof (req.body ?? {}).nueva === "string" ? (req.body as { nueva: string }).nueva : "";
  if (nueva.length < 8 || Buffer.byteLength(nueva) > 72) {
    throw new HttpError(400, "La contraseña debe tener entre 8 y 72 caracteres.", "DATOS_INVALIDOS");
  }
  const hash = await hashContrasena(nueva);
  const filas = await withConnection("Gerente", req.user!.id, async (conn) => {
    const [r] = await conn.query<ResultSetHeader>("UPDATE USUARIO SET contrasena_hash = ? WHERE id_usuario = ?", [hash, id]);
    return r.affectedRows;
  });
  if (filas === 0) throw new HttpError(404, "El usuario no existe.", "NO_ENCONTRADO");
  res.json({ ok: true });
});

/* ------------------------------- Bitácora ------------------------------- */

/** GET /api/gerencia/bitacora?limite=5000 - solo lectura. Incluye folio y paciente de la orden. */
managementRouter.get("/bitacora", async (req, res) => {
  const pedido = Number(req.query.limite);
  const limite = Number.isInteger(pedido) ? Math.min(Math.max(pedido, 1), 20000) : 5000;
  const filas = await withConnection("Gerente", req.user!.id, async (conn) => {
    const [r] = await conn.query<RowDataPacket[]>(
      `SELECT b.id_bitacora, b.fecha_hora, u.nombre_completo AS usuario, u.rol, b.accion, b.detalle,
              o.folio, pa.id_paciente, pa.nombre_completo AS paciente
         FROM BITACORA b
         JOIN USUARIO u       ON u.id_usuario = b.id_usuario
         LEFT JOIN ORDEN o    ON o.id_orden = b.id_orden
         LEFT JOIN PACIENTE pa ON pa.id_paciente = o.id_paciente
        ORDER BY b.id_bitacora DESC LIMIT ?`,
      [limite],
    );
    return r;
  });
  res.json({ bitacora: filas });
});

/* --------------------------- Caja y estadísticas ------------------------- */

/** GET /api/gerencia/caja?dias=400 - pagos reales (folio, paciente, cajero). */
managementRouter.get("/caja", async (req, res) => {
  const pedido = Number(req.query.dias);
  const dias = Number.isInteger(pedido) ? Math.min(Math.max(pedido, 1), 1100) : 400;
  const pagos = await withConnection("Gerente", req.user!.id, async (conn) => {
    const [r] = await conn.query<RowDataPacket[]>(
      `SELECT p.id_pago, p.id_orden, o.folio, pa.id_paciente, pa.nombre_completo AS paciente,
              p.monto, p.metodo_pago, p.tipo, p.fecha_hora, u.nombre_completo AS cajero
         FROM PAGO p
         JOIN ORDEN o     ON o.id_orden = p.id_orden
         JOIN PACIENTE pa ON pa.id_paciente = o.id_paciente
         JOIN USUARIO u   ON u.id_usuario = p.id_usuario
        WHERE p.fecha_hora >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        ORDER BY p.fecha_hora, p.id_pago`,
      [dias],
    );
    return r;
  });
  res.json({ pagos });
});

/** GET /api/gerencia/estadisticas?dias=400 - estudios solicitados por día (para KPIs y gráficas). */
managementRouter.get("/estadisticas", async (req, res) => {
  const pedido = Number(req.query.dias);
  const dias = Number.isInteger(pedido) ? Math.min(Math.max(pedido, 1), 1100) : 400;
  const estudios = await withConnection("Gerente", req.user!.id, async (conn) => {
    const [r] = await conn.query<RowDataPacket[]>(
      `SELECT DATE_FORMAT(o.fecha_registro, '%Y-%m-%d') AS dia, e.nombre AS estudio, e.es_externo, COUNT(*) AS cantidad
         FROM DETALLE_ORDEN d
         JOIN ORDEN o   ON o.id_orden = d.id_orden
         JOIN ESTUDIO e ON e.id_estudio = d.id_estudio
        WHERE o.estado <> 'Cancelada' AND o.fecha_registro >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY dia, e.nombre, e.es_externo
        ORDER BY dia`,
      [dias],
    );
    return r;
  });
  res.json({ estudios: estudios.map((f) => ({ ...f, es_externo: Boolean(f.es_externo), cantidad: Number(f.cantidad) })) });
});

/* ------------------------------- Nómina ------------------------------- */

/** Las fechas (DATE) se piden ya formateadas como "AAAA-MM-DD" con DATE_FORMAT: así no dependen de la zona horaria. */
const fechaIso = (v: unknown): string => String(v).slice(0, 10);

/**
 * GET /api/gerencia/nomina - para cada empleado: su sueldo (si se definió), cuándo se le paga,
 * qué periodos se le deben y su historial de pagos. "Hoy" lo da MySQL (zona de México).
 */
managementRouter.get("/nomina", async (req, res) => {
  const { hoy, sueldos, pagos } = await withConnection("Gerente", req.user!.id, async (conn) => {
    const [h] = await conn.query<RowDataPacket[]>("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS hoy");
    const [s] = await conn.query<RowDataPacket[]>("SELECT id_usuario, salario, periodicidad, DATE_FORMAT(fecha_inicio, '%Y-%m-%d') AS fecha_inicio FROM SUELDO_USUARIO");
    const [p] = await conn.query<RowDataPacket[]>(
      `SELECT n.id_pago_nomina, n.id_usuario, DATE_FORMAT(n.fecha_corresponde, '%Y-%m-%d') AS fecha_corresponde, n.monto, n.metodo_pago, n.nota, n.fecha_hora, u.nombre_completo AS registro
         FROM PAGO_NOMINA n JOIN USUARIO u ON u.id_usuario = n.id_usuario_registra
        ORDER BY n.fecha_corresponde DESC, n.id_pago_nomina DESC`,
    );
    return { hoy: fechaIso(h[0]!.hoy), sueldos: s, pagos: p };
  });
  const empleados = sueldos.map((s) => {
    const sueldo = { salario: Number(s.salario), periodicidad: s.periodicidad as Periodicidad, fechaInicio: fechaIso(s.fecha_inicio) };
    const suyos = pagos.filter((p) => p.id_usuario === s.id_usuario);
    const resumen = resumenNomina(sueldo, new Set(suyos.map((p) => fechaIso(p.fecha_corresponde))), hoy);
    return {
      id_usuario: s.id_usuario as number,
      salario: sueldo.salario, periodicidad: sueldo.periodicidad, fecha_inicio: sueldo.fechaInicio,
      ...resumen,
      pagos: suyos.slice(0, 24).map((p) => ({
        id_pago_nomina: p.id_pago_nomina as number, fecha_corresponde: fechaIso(p.fecha_corresponde), monto: Number(p.monto),
        metodo_pago: p.metodo_pago as string, nota: (p.nota as string | null) ?? null, fecha_hora: p.fecha_hora as string, registro: p.registro as string,
      })),
    };
  });
  res.json({ hoy, empleados });
});

/** PUT /api/gerencia/usuarios/:id/sueldo { salario, periodicidad, fechaInicio } - define o cambia el sueldo. */
managementRouter.put("/usuarios/:id/sueldo", async (req, res) => {
  const id = idPositivo(req.params.id);
  const b = (req.body ?? {}) as Record<string, unknown>;
  const salario = Number(b.salario);
  if (!Number.isFinite(salario) || salario <= 0 || salario > 1_000_000) throw new HttpError(400, "El sueldo debe ser mayor a 0.", "DATOS_INVALIDOS");
  if (!PERIODICIDADES.includes(b.periodicidad as Periodicidad)) throw new HttpError(400, "La periodicidad no es válida.", "DATOS_INVALIDOS");
  if (!esFecha(b.fechaInicio)) throw new HttpError(400, "La fecha de inicio no es válida.", "DATOS_INVALIDOS");
  await withConnection("Gerente", req.user!.id, async (conn) => {
    const [u] = await conn.query<RowDataPacket[]>("SELECT id_usuario FROM USUARIO WHERE id_usuario = ?", [id]);
    if (!u[0]) throw new HttpError(404, "El usuario no existe.", "NO_ENCONTRADO");
    await conn.query(
      `INSERT INTO SUELDO_USUARIO (id_usuario, salario, periodicidad, fecha_inicio) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE salario = VALUES(salario), periodicidad = VALUES(periodicidad), fecha_inicio = VALUES(fecha_inicio)`,
      [id, Math.round(salario * 100) / 100, b.periodicidad, b.fechaInicio],
    );
  });
  res.json({ ok: true });
});

/** POST /api/gerencia/usuarios/:id/nomina/pagos { fecha, metodo, nota?, monto? } - liquida un periodo (queda inmutable). */
managementRouter.post("/usuarios/:id/nomina/pagos", async (req, res) => {
  const id = idPositivo(req.params.id);
  const b = (req.body ?? {}) as Record<string, unknown>;
  if (!esFecha(b.fecha)) throw new HttpError(400, "La fecha del periodo no es válida.", "DATOS_INVALIDOS");
  if (!["Efectivo", "Transferencia", "Cheque"].includes(String(b.metodo))) throw new HttpError(400, "La forma de pago no es válida.", "DATOS_INVALIDOS");
  const nota = typeof b.nota === "string" && b.nota.trim() ? texto(b.nota, 255, "La nota") : null;
  const idPago = await withConnection("Gerente", req.user!.id, async (conn) => {
    const [h] = await conn.query<RowDataPacket[]>("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS hoy");
    const [s] = await conn.query<RowDataPacket[]>("SELECT salario, periodicidad, DATE_FORMAT(fecha_inicio, '%Y-%m-%d') AS fecha_inicio FROM SUELDO_USUARIO WHERE id_usuario = ?", [id]);
    if (!s[0]) throw new HttpError(409, "Primero define el sueldo de este empleado.", "SIN_SUELDO");
    const sueldo = { salario: Number(s[0].salario), periodicidad: s[0].periodicidad as Periodicidad, fechaInicio: fechaIso(s[0].fecha_inicio) };
    const [pg] = await conn.query<RowDataPacket[]>("SELECT DATE_FORMAT(fecha_corresponde, '%Y-%m-%d') AS fecha_corresponde FROM PAGO_NOMINA WHERE id_usuario = ?", [id]);
    const pagadas = new Set(pg.map((p) => fechaIso(p.fecha_corresponde)));
    const { proximoPago } = resumenNomina(sueldo, pagadas, fechaIso(h[0]!.hoy));
    if (!fechaPagable(sueldo, String(b.fecha), proximoPago)) throw new HttpError(409, "Esa fecha no corresponde a un periodo de pago de este empleado.", "PERIODO_INVALIDO");
    if (pagadas.has(String(b.fecha))) throw new HttpError(409, "Ese periodo ya está pagado.", "YA_PAGADO");
    const monto = b.monto === undefined || b.monto === null || b.monto === "" ? sueldo.salario : Number(b.monto);
    if (!Number.isFinite(monto) || monto <= 0 || monto > 1_000_000) throw new HttpError(400, "El monto no es válido.", "DATOS_INVALIDOS");
    const [r] = await conn.query<ResultSetHeader>(
      "INSERT INTO PAGO_NOMINA (id_usuario, fecha_corresponde, monto, metodo_pago, nota, id_usuario_registra) VALUES (?, ?, ?, ?, ?, ?)",
      [id, b.fecha, Math.round(monto * 100) / 100, b.metodo, nota, req.user!.id],
    );
    return r.insertId;
  });
  res.status(201).json({ id_pago_nomina: idPago });
});
