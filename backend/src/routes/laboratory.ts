import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { authenticate } from "../auth/auth.js";
import { withConnection, withTransaction } from "../database/db.js";
import { HttpError } from "../middleware/errors.js";
import { requireRole } from "../auth/roles.js";

/**
 * /api/laboratorio/*  - SOLO Químico. Nunca devuelve precios, pagos, caja, usuarios ni teléfonos
 * (la cuenta MySQL del químico tampoco puede leerlos). Las reglas de resultados (captura editable hasta validar,
 * validar antes de liberar, estados de la orden, bitácora, alertas a recepción) las aplican los triggers.
 */
export const laboratoryRouter = Router();
laboratoryRouter.use(authenticate, requireRole("Químico"));

const UPLOADS = fileURLToPath(new URL("../../uploads/", import.meta.url));
const NOMBRE_PDF = /^[0-9a-f-]{36}\.pdf$/;
const MAX_PDF = 10 * 1024 * 1024;
const TIPOS_INCIDENCIA = ["Hemolizada", "Dañada", "Otra"] as const;

function idPositivo(valor: unknown, que = "El identificador"): number {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `${que} no es válido.`, "DATOS_INVALIDOS");
  return n;
}

/* ------------------------------ Lectura ------------------------------ */

/** GET /api/laboratorio/estudios - catálogo SIN precio (RN-01: lo clínico no ve lo financiero). */
laboratoryRouter.get("/estudios", async (req, res) => {
  const filas = await withConnection("Químico", req.user!.id, async (conn) => {
    const [r] = await conn.query<RowDataPacket[]>(
      `SELECT id_estudio, clave, nombre, es_externo
         FROM ESTUDIO WHERE activo = TRUE ORDER BY nombre`,
    );
    return r;
  });
  res.json({ estudios: filas.map((f) => ({ ...f, es_externo: Boolean(f.es_externo) })) });
});

/**
 * GET /api/laboratorio/datos
 * Órdenes abiertas + las de los últimos 60 días, con muestras, estudios, parámetros, incidencias y resultados.
 * Solo columnas permitidas al químico: sin precios, pagos, teléfonos ni datos de usuarios.
 */
laboratoryRouter.get("/datos", async (req, res) => {
  const datos = await withConnection("Químico", req.user!.id, async (conn) => {
    const q = async (sql: string, params: unknown[] = []) => (await conn.query<RowDataPacket[]>(sql, params))[0];
    const ordenes = await q(
      `SELECT id_orden, folio, id_paciente, fecha_registro, estado FROM ORDEN
        WHERE estado NOT IN ('Entregada','Cancelada') OR fecha_registro >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)
        ORDER BY id_orden`,
    );
    const estudios = await q("SELECT id_estudio, clave, nombre, es_externo FROM ESTUDIO ORDER BY id_estudio");
    const parametros = await q("SELECT id_parametro, id_estudio, nombre, unidad, rango_referencia, opciones FROM PARAMETRO_ESTUDIO ORDER BY id_parametro");
    const base = { ordenes, estudios: estudios.map((e) => ({ ...e, es_externo: Boolean(e.es_externo) })), parametros };
    if (ordenes.length === 0) {
      return { ...base, pacientes: [], detalles: [], muestras: [], incidencias: [], resultados: [], valores: [] };
    }
    const ids = ordenes.map((o) => o.id_orden);
    const pacientes = await q(
      "SELECT id_paciente, nombre_completo FROM PACIENTE WHERE id_paciente IN (?)",
      [[...new Set(ordenes.map((o) => o.id_paciente))]],
    );
    const detalles = await q("SELECT id_detalle, id_orden, id_estudio FROM DETALLE_ORDEN WHERE id_orden IN (?)", [ids]);
    const muestras = await q("SELECT id_muestra, id_orden, fecha_recepcion, estado FROM MUESTRA WHERE id_orden IN (?) ORDER BY id_muestra", [ids]);
    const incidencias = await q(
      `SELECT id_incidencia, id_muestra, id_usuario, tipo, descripcion, fecha_hora FROM INCIDENCIA_MUESTRA
        WHERE id_muestra IN (SELECT id_muestra FROM MUESTRA WHERE id_orden IN (?)) ORDER BY id_incidencia DESC LIMIT 200`,
      [ids],
    );
    const resultados = await q(
      `SELECT id_resultado, id_detalle, estado, id_usuario_captura, fecha_captura, id_usuario_valida, fecha_validacion,
              fecha_liberacion, (ruta_pdf_externo IS NOT NULL) AS tiene_pdf
         FROM RESULTADO WHERE id_detalle IN (SELECT id_detalle FROM DETALLE_ORDEN WHERE id_orden IN (?))`,
      [ids],
    );
    const valores = await q(
      `SELECT id_resultado, id_parametro, valor FROM VALOR_RESULTADO
        WHERE id_resultado IN (SELECT r.id_resultado FROM RESULTADO r
                                WHERE r.id_detalle IN (SELECT id_detalle FROM DETALLE_ORDEN WHERE id_orden IN (?)))`,
      [ids],
    );
    return {
      ...base, pacientes, detalles, muestras, incidencias, valores,
      resultados: resultados.map((r) => ({ ...r, tiene_pdf: Boolean(r.tiene_pdf) })),
    };
  });
  res.json({ yo: { id: req.user!.id, nombre: req.user!.nombre }, ...datos });
});

/* ------------------------------ Muestras ------------------------------ */

async function muestraAbierta(conn: PoolConnection, idMuestra: number) {
  const [r] = await conn.query<RowDataPacket[]>(
    `SELECT m.id_muestra, m.estado, o.estado AS estado_orden
       FROM MUESTRA m JOIN ORDEN o ON o.id_orden = m.id_orden WHERE m.id_muestra = ?`,
    [idMuestra],
  );
  const m = r[0];
  if (!m) throw new HttpError(404, "La muestra no existe.", "NO_ENCONTRADO");
  if (m.estado_orden === "Cancelada" || m.estado_orden === "Entregada") {
    throw new HttpError(409, "La orden de esta muestra ya está cerrada (entregada o cancelada).", "ORDEN_CERRADA");
  }
  return m;
}

/** POST /api/laboratorio/muestras/:id/recibir */
laboratoryRouter.post("/muestras/:id/recibir", async (req, res) => {
  const id = idPositivo(req.params.id, "La muestra");
  await withTransaction("Químico", req.user!.id, async (conn) => {
    const m = await muestraAbierta(conn, id);
    if (m.estado !== "Pendiente") throw new HttpError(409, "La muestra no está pendiente de recepción.", "ESTADO_INVALIDO");
    const [u] = await conn.query<ResultSetHeader>("UPDATE MUESTRA SET estado = 'Recibida', fecha_recepcion = NOW() WHERE id_muestra = ? AND estado = 'Pendiente'", [id]);
    if (u.affectedRows === 0) throw new HttpError(409, "La muestra ya no está pendiente de recepción.", "ESTADO_INVALIDO");
  });
  res.json({ ok: true });
});

/** POST /api/laboratorio/muestras/:id/retomada - la nueva toma ya viene en camino: vuelve a Pendiente. */
laboratoryRouter.post("/muestras/:id/retomada", async (req, res) => {
  const id = idPositivo(req.params.id, "La muestra");
  await withTransaction("Químico", req.user!.id, async (conn) => {
    const m = await muestraAbierta(conn, id);
    if (m.estado !== "Con incidencia") throw new HttpError(409, "La muestra no tiene una incidencia abierta.", "ESTADO_INVALIDO");
    const [u] = await conn.query<ResultSetHeader>("UPDATE MUESTRA SET estado = 'Pendiente', fecha_recepcion = NULL WHERE id_muestra = ? AND estado = 'Con incidencia'", [id]);
    if (u.affectedRows === 0) throw new HttpError(409, "La muestra ya no tiene una incidencia abierta.", "ESTADO_INVALIDO");
  });
  res.json({ ok: true });
});

/** POST /api/laboratorio/incidencias { idMuestra, tipo, descripcion } - el trigger marca la muestra y avisa a Recepción. */
laboratoryRouter.post("/incidencias", async (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const idMuestra = idPositivo(b.idMuestra, "La muestra");
  if (!TIPOS_INCIDENCIA.includes(b.tipo as (typeof TIPOS_INCIDENCIA)[number])) {
    throw new HttpError(400, "El tipo de incidencia no es válido.", "DATOS_INVALIDOS");
  }
  const descripcion = typeof b.descripcion === "string" ? b.descripcion.trim() : "";
  if (descripcion.length < 10) throw new HttpError(400, "Describe lo ocurrido y la acción tomada (mínimo 10 caracteres).", "DATOS_INVALIDOS");
  if (descripcion.length > 255) throw new HttpError(400, "La descripción es demasiado larga (máximo 255 caracteres).", "DATOS_INVALIDOS");
  const idIncidencia = await withTransaction("Químico", req.user!.id, async (conn) => {
    await muestraAbierta(conn, idMuestra);
    const [r] = await conn.query<ResultSetHeader>(
      "INSERT INTO INCIDENCIA_MUESTRA (id_muestra, id_usuario, tipo, descripcion) VALUES (?, ?, ?, ?)",
      [idMuestra, req.user!.id, b.tipo, descripcion],
    );
    return r.insertId;
  });
  res.status(201).json({ id_incidencia: idIncidencia });
});

/* ----------------------------- Resultados ----------------------------- */

/**
 * POST /api/laboratorio/resultados { idDetalle, valores: [{idParametro, valor}], pdfBase64? }
 * Crea la captura o la corrige mientras siga en estado Capturado (después el trigger la congela, RN-03).
 */
laboratoryRouter.post("/resultados", async (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const idDetalle = idPositivo(b.idDetalle, "El estudio");
  const valoresIn = Array.isArray(b.valores) ? (b.valores as { idParametro?: unknown; valor?: unknown }[]) : [];
  if (valoresIn.length > 200) throw new HttpError(400, "Demasiados valores.", "DATOS_INVALIDOS");
  const valores = valoresIn.map((v) => {
    const valor = typeof v.valor === "string" ? v.valor.trim() : "";
    if (!valor || valor.length > 50) throw new HttpError(400, "Cada valor es obligatorio y mide máximo 50 caracteres.", "DATOS_INVALIDOS");
    return { idParametro: idPositivo(v.idParametro, "El parámetro"), valor };
  });
  if (new Set(valores.map((v) => v.idParametro)).size !== valores.length) {
    throw new HttpError(400, "Hay parámetros repetidos.", "DATOS_INVALIDOS");
  }

  let pdf: Buffer | null = null;
  if (b.pdfBase64 !== undefined && b.pdfBase64 !== null) {
    if (typeof b.pdfBase64 !== "string") throw new HttpError(400, "El PDF no es válido.", "DATOS_INVALIDOS");
    pdf = Buffer.from(b.pdfBase64, "base64");
    if (pdf.length === 0 || pdf.length > MAX_PDF) throw new HttpError(400, "El PDF debe pesar entre 1 byte y 10 MB.", "DATOS_INVALIDOS");
    if (pdf.subarray(0, 5).toString("latin1") !== "%PDF-") throw new HttpError(400, "Solo se permiten archivos PDF.", "DATOS_INVALIDOS");
  }

  let archivoNuevo: string | null = null;
  try {
    const out = await withTransaction("Químico", req.user!.id, async (conn) => {
      const [det] = await conn.query<RowDataPacket[]>(
        `SELECT d.id_orden, d.id_estudio, e.es_externo, o.estado AS estado_orden
           FROM DETALLE_ORDEN d JOIN ORDEN o ON o.id_orden = d.id_orden JOIN ESTUDIO e ON e.id_estudio = d.id_estudio
          WHERE d.id_detalle = ?`,
        [idDetalle],
      );
      const d = det[0];
      if (!d) throw new HttpError(404, "El estudio no existe.", "NO_ENCONTRADO");
      if (d.estado_orden === "Cancelada" || d.estado_orden === "Entregada") {
        throw new HttpError(409, "No se capturan resultados en una orden cancelada o entregada.", "ORDEN_CERRADA");
      }
      const [mu] = await conn.query<RowDataPacket[]>("SELECT estado FROM MUESTRA WHERE id_orden = ? ORDER BY id_muestra LIMIT 1", [d.id_orden]);
      if (!mu[0] || (mu[0].estado !== "Recibida" && mu[0].estado !== "Procesada")) {
        throw new HttpError(409, "La muestra de esta orden debe estar recibida (sin incidencia) para capturar resultados.", "MUESTRA_NO_RECIBIDA");
      }
      const [params] = await conn.query<RowDataPacket[]>("SELECT id_parametro FROM PARAMETRO_ESTUDIO WHERE id_estudio = ?", [d.id_estudio]);
      const validos = new Set(params.map((p) => p.id_parametro as number));
      if (valores.some((v) => !validos.has(v.idParametro))) throw new HttpError(400, "Un parámetro no pertenece a este estudio.", "DATOS_INVALIDOS");
      if (validos.size > 0 && valores.length !== validos.size) throw new HttpError(400, "Captura todos los parámetros del estudio.", "DATOS_INVALIDOS");

      const [res0] = await conn.query<RowDataPacket[]>("SELECT id_resultado, estado, (ruta_pdf_externo IS NOT NULL) AS tiene_pdf FROM RESULTADO WHERE id_detalle = ?", [idDetalle]);
      let idResultado: number;
      let tienePdf = false;
      if (res0[0]) {
        if (res0[0].estado !== "Capturado") throw new HttpError(409, "RN-03: el resultado ya fue validado y no puede editarse.", "RESULTADO_CONGELADO");
        idResultado = res0[0].id_resultado;
        tienePdf = Boolean(res0[0].tiene_pdf);
      } else {
        if (d.es_externo && !pdf) throw new HttpError(400, "Este estudio es externo: adjunta el reporte PDF del laboratorio de referencia.", "DATOS_INVALIDOS");
        const [ins] = await conn.query<ResultSetHeader>("INSERT INTO RESULTADO (id_detalle, id_usuario_captura) VALUES (?, ?)", [idDetalle, req.user!.id]);
        idResultado = ins.insertId;
      }
      if (d.es_externo && !pdf && !tienePdf) throw new HttpError(400, "Este estudio es externo: adjunta el reporte PDF del laboratorio de referencia.", "DATOS_INVALIDOS");

      for (const v of valores) {
        await conn.query(
          "INSERT INTO VALOR_RESULTADO (id_resultado, id_parametro, valor) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)",
          [idResultado, v.idParametro, v.valor],
        );
      }
      if (pdf) {
        archivoNuevo = `${randomUUID()}.pdf`;
        await mkdir(UPLOADS, { recursive: true });
        await writeFile(UPLOADS + archivoNuevo, pdf, { mode: 0o600 });
        await conn.query("UPDATE RESULTADO SET ruta_pdf_externo = ? WHERE id_resultado = ?", [archivoNuevo, idResultado]);
      }
      return idResultado;
    });
    res.status(201).json({ id_resultado: out });
  } catch (err) {
    if (archivoNuevo) await unlink(UPLOADS + archivoNuevo).catch(() => undefined);
    throw err;
  }
});

/** GET /api/laboratorio/resultados/:id/pdf - reporte externo adjunto (solo con sesión de químico). */
laboratoryRouter.get("/resultados/:id/pdf", async (req, res) => {
  const id = idPositivo(req.params.id, "El resultado");
  const ruta = await withConnection("Químico", req.user!.id, async (conn) => {
    const [r] = await conn.query<RowDataPacket[]>("SELECT ruta_pdf_externo FROM RESULTADO WHERE id_resultado = ?", [id]);
    return (r[0]?.ruta_pdf_externo as string | null | undefined) ?? null;
  });
  const nombre = ruta ? ruta.split(/[\\/]/).pop() ?? "" : "";
  if (!NOMBRE_PDF.test(nombre)) throw new HttpError(404, "Este resultado no tiene reporte externo.", "NO_ENCONTRADO");
  res.type("application/pdf").setHeader("Content-Disposition", "inline");
  res.sendFile(UPLOADS + nombre, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: "No se encontró el archivo del reporte.", codigo: "NO_ENCONTRADO" });
  });
});

/** POST /api/laboratorio/resultados/validar { ids: [id_resultado] } - valida y libera (el trigger exige Capturado → Validado → Liberado). */
laboratoryRouter.post("/resultados/validar", async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? (req.body.ids as unknown[]).map((x) => idPositivo(x, "El resultado")) : [];
  if (ids.length === 0 || ids.length > 100) throw new HttpError(400, "Selecciona entre 1 y 100 resultados.", "DATOS_INVALIDOS");
  const validados = await withTransaction("Químico", req.user!.id, async (conn) => {
    let n = 0;
    for (const id of [...new Set(ids)].sort((a, b) => a - b)) {
      const [r] = await conn.query<RowDataPacket[]>("SELECT estado FROM RESULTADO WHERE id_resultado = ?", [id]);
      if (!r[0]) throw new HttpError(404, "Un resultado seleccionado no existe.", "NO_ENCONTRADO");
      if (r[0].estado !== "Capturado") continue;
      await conn.query("UPDATE RESULTADO SET estado = 'Validado', id_usuario_valida = ? WHERE id_resultado = ?", [req.user!.id, id]);
      await conn.query("UPDATE RESULTADO SET estado = 'Liberado' WHERE id_resultado = ?", [id]);
      n += 1;
    }
    return n;
  });
  res.json({ validados });
});
