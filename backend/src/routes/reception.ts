import { Router } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { authenticate } from "../auth/auth.js";
import { withConnection, withTransaction } from "../database/db.js";
import { HttpError } from "../middleware/errors.js";
import { requireRole } from "../auth/roles.js";
import { enlaceWhatsApp } from "../services/whatsapp.js";
import { getConfig } from "../config/config.js";

/**
 * /api/recepcion/*  - SOLO Recepcionista.
 * Las reglas de negocio (folio, precio vigente, saldo, entrega sin adeudo, cancelación con motivo,
 * bitácora...) las aplica MySQL con sp_crear_orden, sp_agregar_estudio_orden y los triggers;
 * aquí solo se validan los datos de entrada y se invocan.
 */
export const receptionRouter = Router();
receptionRouter.use(authenticate, requireRole("Recepcionista"));

const METODOS = ["Efectivo", "Tarjeta", "Transferencia"] as const;
type Metodo = (typeof METODOS)[number];
const centavos = (n: number) => Math.round(n * 100);

function idPositivo(valor: unknown, que = "El identificador"): number {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `${que} no es válido.`, "DATOS_INVALIDOS");
  return n;
}

function texto(valor: unknown, max: number, que: string, min = 1): string {
  const t = typeof valor === "string" ? valor.trim() : "";
  if (t.length < min) {
    throw new HttpError(400, min > 1 ? `${que} debe tener al menos ${min} caracteres.` : `${que} es obligatorio.`, "DATOS_INVALIDOS");
  }
  if (t.length > max) throw new HttpError(400, `${que} es demasiado largo (máximo ${max} caracteres).`, "DATOS_INVALIDOS");
  return t;
}

function monto(valor: unknown, que: string, permitirCero = false): number {
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0 || (!permitirCero && n === 0) || n > 10_000_000) {
    throw new HttpError(400, `${que} no es válido.`, "DATOS_INVALIDOS");
  }
  return centavos(n) / 100;
}

const NOMBRE_RE = /^[\p{L}][\p{L} .'’-]*$/u;

/** Nombre de persona: solo letras, espacios, punto, apóstrofo y guion; sin espacios repetidos. */
function nombrePersona(valor: unknown): string {
  const t = texto(valor, 100, "El nombre del paciente", 3).replace(/\s+/g, " ");
  if (!NOMBRE_RE.test(t)) throw new HttpError(400, "El nombre solo puede llevar letras, espacios, punto, apóstrofo y guion.", "DATOS_INVALIDOS");
  return t;
}

/** El teléfono es opcional: vacío = sin teléfono (y por tanto sin WhatsApp). Si se escribe, deben ser 10 dígitos. */
function telefonoOpcional(valor: unknown, whatsapp: boolean): { telefono: string | null; whatsapp: boolean } {
  const bruto = String(valor ?? "").trim();
  if (/[^\d\s()+-]/.test(bruto)) throw new HttpError(400, "El teléfono solo puede llevar números.", "DATOS_INVALIDOS");
  const d = bruto.replace(/\D/g, "");
  if (d === "") return { telefono: null, whatsapp: false };
  if (d.length !== 10) throw new HttpError(400, "El teléfono debe tener exactamente 10 dígitos (o déjalo vacío si no tiene).", "DATOS_INVALIDOS");
  return { telefono: d, whatsapp };
}

function metodoPago(valor: unknown): Metodo {
  if (!METODOS.includes(valor as Metodo)) throw new HttpError(400, "La forma de pago no es válida.", "DATOS_INVALIDOS");
  return valor as Metodo;
}

/* ------------------------------ Lectura ------------------------------ */

/** GET /api/recepcion/estudios - catálogo vigente CON precio (recepción sí lo ve). */
receptionRouter.get("/estudios", async (req, res) => {
  const filas = await withConnection("Recepcionista", req.user!.id, async (conn) => {
    const [r] = await conn.query<RowDataPacket[]>(
      `SELECT id_estudio, clave, nombre, precio, es_externo
         FROM ESTUDIO WHERE activo = TRUE ORDER BY nombre`,
    );
    return r;
  });
  res.json({ estudios: filas.map((f) => ({ ...f, es_externo: Boolean(f.es_externo) })) });
});

/**
 * GET /api/recepcion/datos - todo lo que necesita la pantalla de recepción en una sola carga.
 * Los resultados clínicos salen SOLO de vw_informe_resultado (únicamente resultados Liberados, sin precios).
 */
receptionRouter.get("/datos", async (req, res) => {
  const u = req.user!;
  const d = await withConnection("Recepcionista", u.id, async (conn) => {
    const q = async (sql: string) => (await conn.query<RowDataPacket[]>(sql))[0];
    return {
      pacientes: await q(
        `SELECT id_paciente, nombre_completo, telefono, tiene_whatsapp, fecha_registro
           FROM PACIENTE ORDER BY id_paciente`),
      ordenes: await q(
        `SELECT id_orden, folio, id_paciente, fecha_registro, fecha_cita, indicaciones, estado,
                motivo_cancelacion, id_usuario_entrega, fecha_entrega,
                acepta_recordatorio, acepta_aviso_resultados, preparacion_mensaje, recordatorio_envio
           FROM ORDEN ORDER BY id_orden DESC`),
      muestras: await q(
        `SELECT id_muestra, id_orden, estado, fecha_recepcion FROM MUESTRA ORDER BY id_muestra`),
      detalles: await q(
        `SELECT d.id_detalle, d.id_orden, d.id_estudio, e.clave, e.nombre, e.es_externo, d.precio_aplicado
           FROM DETALLE_ORDEN d JOIN ESTUDIO e ON e.id_estudio = d.id_estudio
          ORDER BY d.id_detalle`),
      pagos: await q(
        `SELECT id_pago, id_orden, id_usuario, monto, metodo_pago, tipo, fecha_hora
           FROM PAGO ORDER BY id_pago`),
      informes: await q(
        `SELECT id_orden, estudio_clave, parametro, unidad, valor, referencia, fecha_liberacion, ruta_pdf_externo
           FROM vw_informe_resultado ORDER BY id_orden, estudio_clave`),
      estudios: await q(
        `SELECT id_estudio, clave, nombre, precio, es_externo
           FROM ESTUDIO WHERE activo = TRUE ORDER BY nombre`),
    };
  });
  res.json({
    yo: { id: u.id, nombre: u.nombre },
    pacientes: d.pacientes.map((p) => ({ ...p, tiene_whatsapp: Boolean(p.tiene_whatsapp) })),
    ordenes: d.ordenes.map((o) => ({ ...o, acepta_recordatorio: Boolean(o.acepta_recordatorio), acepta_aviso_resultados: Boolean(o.acepta_aviso_resultados) })),
    muestras: d.muestras,
    detalles: d.detalles.map((x) => ({ ...x, es_externo: Boolean(x.es_externo) })),
    pagos: d.pagos,
    informes: d.informes,
    estudios: d.estudios.map((e) => ({ ...e, es_externo: Boolean(e.es_externo) })),
  });
});

/* ------------------------------ Citas / órdenes ------------------------------ */

/**
 * PATCH /api/recepcion/pacientes/:id { nombre, telefono, whatsapp }
 * Edita datos de contacto (nunca borra). El trigger de MySQL rechaza la edición mientras el paciente
 * tenga resultados validados sin entregar (RN-03) y registra el cambio en la bitácora.
 */
receptionRouter.patch("/pacientes/:id", async (req, res) => {
  const id = idPositivo(req.params.id, "El paciente");
  const b = (req.body ?? {}) as Record<string, unknown>;
  const nombre = nombrePersona(b.nombre);
  const { telefono, whatsapp: conWhatsapp } = telefonoOpcional(b.telefono, b.whatsapp === true);
  const filas = await withConnection("Recepcionista", req.user!.id, async (conn) => {
    const [r] = await conn.query<ResultSetHeader>(
      "UPDATE PACIENTE SET nombre_completo = ?, telefono = ?, tiene_whatsapp = ? WHERE id_paciente = ?",
      [nombre, telefono, conWhatsapp, id],
    );
    return r.affectedRows;
  });
  if (filas === 0) throw new HttpError(404, "El paciente no existe.", "NO_ENCONTRADO");
  res.json({ ok: true });
});

/**
 * POST /api/recepcion/citas
 * { nombre, telefono, whatsapp, fechaCita (ISO), estudios:[id_estudio], abono, metodo }
 * Todo en UNA transacción: paciente (si no existe) -> sp_crear_orden -> sp_agregar_estudio_orden x N
 * -> muestra -> pago inicial. Si algo falla, no queda nada a medias.
 */
receptionRouter.post("/citas", async (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const nombre = nombrePersona(b.nombre);
  const { telefono, whatsapp } = telefonoOpcional(b.telefono, b.whatsapp === true);
  const fechaCita = new Date(String(b.fechaCita ?? ""));
  if (Number.isNaN(fechaCita.getTime())) throw new HttpError(400, "La fecha y hora de la cita no son válidas.", "DATOS_INVALIDOS");
  if (fechaCita.getTime() < Date.now() - 5 * 60_000) throw new HttpError(400, "La fecha y hora de la cita no pueden estar en el pasado.", "DATOS_INVALIDOS");
  if (fechaCita.getTime() > Date.now() + 366 * 86_400_000) throw new HttpError(400, "La cita no puede agendarse con más de un año de anticipación.", "DATOS_INVALIDOS");
  {
    // Horario de atención 07:00 a 20:00 h (hora de México, UTC-6)
    const mx = new Date(fechaCita.getTime() - 6 * 3600_000);
    const minutos = mx.getUTCHours() * 60 + mx.getUTCMinutes();
    if (minutos < 7 * 60 || minutos > 20 * 60) throw new HttpError(400, "El horario de atención es de 07:00 a 20:00 h.", "DATOS_INVALIDOS");
  }

  const crudos = Array.isArray(b.estudios) ? b.estudios : [];
  const estudios = [...new Set(crudos.map((x) => idPositivo(x, "Uno de los estudios")))];
  if (estudios.length === 0 || estudios.length > 30) {
    throw new HttpError(400, "Agrega entre 1 y 30 estudios.", "DATOS_INVALIDOS");
  }
  const abono = b.abono === undefined || b.abono === null || b.abono === "" ? 0 : monto(b.abono, "El abono", true);
  const metodo: Metodo = abono > 0 ? metodoPago(b.metodo) : "Efectivo";

  // Preferencias de WhatsApp (RN-04: sin WhatsApp no hay avisos digitales; el aviso es en físico)
  const prep = typeof b.preparacion === "string" ? b.preparacion.trim() : "";
  if (prep.length > 500) throw new HttpError(400, "Las indicaciones de preparación son demasiado largas (máximo 500 caracteres).", "DATOS_INVALIDOS");
  const aceptaRecordatorio = whatsapp && b.recordatorio === true;
  const aceptaAviso = whatsapp && b.avisoResultados === true;
  let envio: Date | null = null;
  if (aceptaRecordatorio && prep) {
    if (b.recordatorioEnvio) {
      envio = new Date(String(b.recordatorioEnvio));
    } else {
      // RF-01: el día anterior a las 17:00 hora de México (UTC-6, sin horario de verano)
      const mx = new Date(fechaCita.getTime() - 6 * 3600_000);
      envio = new Date(Date.UTC(mx.getUTCFullYear(), mx.getUTCMonth(), mx.getUTCDate() - 1, 17 + 6, 0, 0));
    }
    if (Number.isNaN(envio.getTime())) throw new HttpError(400, "La hora del recordatorio no es válida.", "DATOS_INVALIDOS");
    if (envio.getTime() >= fechaCita.getTime()) throw new HttpError(400, "El recordatorio debe enviarse antes de la cita.", "DATOS_INVALIDOS");
    if (envio.getTime() < Date.now()) envio = new Date(); // la cita es muy pronto: se envía de inmediato
  }

  const uid = req.user!.id;
  const r = await withTransaction("Recepcionista", uid, async (conn) => {
    // Paciente: se reutiliza si ya existe con ese nombre (sin distinguir mayúsculas ni acentos)
    const [ex] = await conn.query<RowDataPacket[]>(
      "SELECT id_paciente, telefono, tiene_whatsapp FROM PACIENTE WHERE nombre_completo = ? ORDER BY id_paciente LIMIT 1",
      [nombre],
    );
    let idPaciente: number;
    let actualizarContacto = false;
    if (ex[0]) {
      idPaciente = ex[0].id_paciente as number;
      actualizarContacto = (ex[0].telefono ?? null) !== telefono || Boolean(ex[0].tiene_whatsapp) !== whatsapp;
    } else {
      const [ins] = await conn.query<ResultSetHeader>(
        "INSERT INTO PACIENTE (nombre_completo, telefono, tiene_whatsapp) VALUES (?, ?, ?)",
        [nombre, telefono, whatsapp],
      );
      idPaciente = ins.insertId;
    }

    await conn.query("CALL sp_crear_orden(?, ?, ?, ?, @p_id_orden, @p_folio)", [idPaciente, uid, fechaCita, null]);
    const [o] = await conn.query<RowDataPacket[]>("SELECT @p_id_orden AS id_orden, @p_folio AS folio");
    const idOrden = o[0]!.id_orden as number;
    const folio = o[0]!.folio as string;

    // Con la orden nueva ya abierta, la última visita del paciente deja de estar "cerrada": se puede corregir su contacto.
    if (actualizarContacto) {
      await conn.query("UPDATE PACIENTE SET telefono = ?, tiene_whatsapp = ? WHERE id_paciente = ?", [telefono, whatsapp, idPaciente]);
    }
    // Esta actualización dispara en MySQL el trigger que programa el WhatsApp de preparación (RF-01)
    if (aceptaRecordatorio || aceptaAviso || prep) {
      await conn.query(
        "UPDATE ORDEN SET acepta_recordatorio = ?, acepta_aviso_resultados = ?, preparacion_mensaje = ?, recordatorio_envio = ? WHERE id_orden = ?",
        [aceptaRecordatorio, aceptaAviso, prep || null, envio, idOrden],
      );
    }

    for (const idEstudio of estudios) {
      await conn.query("CALL sp_agregar_estudio_orden(?, ?)", [idOrden, idEstudio]); // toma el precio vigente
    }
    await conn.query("INSERT INTO MUESTRA (id_orden) VALUES (?)", [idOrden]);

    let idPago: number | null = null;
    if (abono > 0) {
      const [t] = await conn.query<RowDataPacket[]>("SELECT total FROM vw_saldo_orden WHERE id_orden = ?", [idOrden]);
      const tipo = centavos(abono) >= centavos(Number(t[0]!.total)) ? "Liquidación" : "Anticipo";
      const [p] = await conn.query<ResultSetHeader>(
        "INSERT INTO PAGO (id_orden, id_usuario, monto, metodo_pago, tipo) VALUES (?, ?, ?, ?, ?)",
        [idOrden, uid, abono, metodo, tipo],
      );
      idPago = p.insertId;
    }
    return { id_orden: idOrden, folio, id_paciente: idPaciente, id_pago: idPago };
  });
  res.status(201).json(r);
});

/** POST /api/recepcion/ordenes/:id/pagos  { monto, metodo } - abono o liquidación (el tipo lo decide el saldo). */
receptionRouter.post("/ordenes/:id/pagos", async (req, res) => {
  const idOrden = idPositivo(req.params.id, "La orden");
  const b = (req.body ?? {}) as Record<string, unknown>;
  const importe = monto(b.monto, "El importe");
  const metodo = metodoPago(b.metodo);
  const uid = req.user!.id;

  const idPago = await withTransaction("Recepcionista", uid, async (conn) => {
    const [s] = await conn.query<RowDataPacket[]>("SELECT saldo FROM vw_saldo_orden WHERE id_orden = ?", [idOrden]);
    if (!s[0]) throw new HttpError(404, "La orden no existe.", "NO_ENCONTRADO");
    const tipo = centavos(importe) >= centavos(Number(s[0].saldo)) ? "Liquidación" : "Abono";
    const [p] = await conn.query<ResultSetHeader>(
      "INSERT INTO PAGO (id_orden, id_usuario, monto, metodo_pago, tipo) VALUES (?, ?, ?, ?, ?)",
      [idOrden, uid, importe, metodo, tipo],
    );
    return p.insertId;
  });
  res.status(201).json({ id_pago: idPago });
});

/** POST /api/recepcion/ordenes/:id/entregar - MySQL exige resultados liberados y saldo 0 (RN-05). */
receptionRouter.post("/ordenes/:id/entregar", async (req, res) => {
  const idOrden = idPositivo(req.params.id, "La orden");
  const uid = req.user!.id;
  await withTransaction("Recepcionista", uid, async (conn) => {
    const [r] = await conn.query<ResultSetHeader>(
      "UPDATE ORDEN SET estado = 'Entregada', id_usuario_entrega = ? WHERE id_orden = ?",
      [uid, idOrden],
    );
    if (r.affectedRows === 0) throw new HttpError(404, "La orden no existe.", "NO_ENCONTRADO");
  });
  res.json({ ok: true });
});

/** POST /api/recepcion/ordenes/:id/cancelar  { motivo } - cancelación lógica con justificación (RN-02). */
receptionRouter.post("/ordenes/:id/cancelar", async (req, res) => {
  const idOrden = idPositivo(req.params.id, "La orden");
  const b = (req.body ?? {}) as Record<string, unknown>;
  const motivo = texto(b.motivo, 255, "La justificación", 10);
  const uid = req.user!.id;
  await withTransaction("Recepcionista", uid, async (conn) => {
    // Regla de la interfaz: no se cancela una orden que ya tiene resultados liberados.
    const [lib] = await conn.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM vw_informe_resultado WHERE id_orden = ?", [idOrden]);
    if (Number(lib[0]!.n) > 0) throw new HttpError(409, "La orden ya tiene resultados liberados y no puede cancelarse.", "REGLA_NEGOCIO");
    const [r] = await conn.query<ResultSetHeader>(
      "UPDATE ORDEN SET estado = 'Cancelada', motivo_cancelacion = ? WHERE id_orden = ?",
      [motivo, idOrden],
    );
    if (r.affectedRows === 0) throw new HttpError(404, "La orden no existe.", "NO_ENCONTRADO");
  });
  res.json({ ok: true });
});

/* ------------------------------ Notificaciones ------------------------------ */

/** GET /api/recepcion/notificaciones - las 100 más recientes (campana del encabezado). */
receptionRouter.get("/notificaciones", async (req, res) => {
  const filas = await withConnection("Recepcionista", req.user!.id, async (conn) => {
    const [r] = await conn.query<RowDataPacket[]>(
      `SELECT n.id_notificacion, n.id_orden, o.folio, p.nombre_completo AS paciente,
              n.tipo, n.canal, n.estado, n.fecha_hora
         FROM NOTIFICACION n
         JOIN ORDEN o    ON o.id_orden = n.id_orden
         JOIN PACIENTE p ON p.id_paciente = o.id_paciente
        ORDER BY n.id_notificacion DESC LIMIT 100`,
    );
    return r;
  });
  res.json({ notificaciones: filas });
});

/** PATCH /api/recepcion/notificaciones/:id  { estado: Enviada | Fallida | Atendida } */
receptionRouter.patch("/notificaciones/:id", async (req, res) => {
  const id = idPositivo(req.params.id, "La notificación");
  const estado = (req.body ?? {}).estado;
  if (!["Enviada", "Fallida", "Atendida"].includes(estado)) throw new HttpError(400, "Estado no válido.", "DATOS_INVALIDOS");
  const afectadas = await withConnection("Recepcionista", req.user!.id, async (conn) => {
    const [r] = await conn.query<ResultSetHeader>("UPDATE NOTIFICACION SET estado = ? WHERE id_notificacion = ?", [estado, id]);
    return r.affectedRows;
  });
  if (afectadas === 0) throw new HttpError(404, "La notificación no existe.", "NO_ENCONTRADO");
  res.json({ ok: true });
});


/* ------------------------------ WhatsApp ------------------------------ */

/**
 * GET /api/recepcion/whatsapp - cola de mensajes (los 200 más recientes).
 * Cada mensaje trae el enlace que abre WhatsApp con el texto escrito (modo manual).
 */
receptionRouter.get("/whatsapp", async (req, res) => {
  const filas = await withConnection("Recepcionista", req.user!.id, async (conn) => {
    const [r] = await conn.query<RowDataPacket[]>(
      `SELECT w.id_wa, w.id_orden, o.folio, w.id_paciente, p.nombre_completo AS paciente, w.telefono, w.tipo, w.cuerpo,
              w.programado_para, w.estado, w.intentos, w.error, w.fecha_envio, (w.programado_para <= NOW()) AS vencido
         FROM WHATSAPP_COLA w
         JOIN PACIENTE p ON p.id_paciente = w.id_paciente
         LEFT JOIN ORDEN o ON o.id_orden = w.id_orden
        ORDER BY (w.estado = 'Pendiente') DESC, w.programado_para DESC, w.id_wa DESC LIMIT 200`,
    );
    return r;
  });
  res.json({
    proveedor: getConfig().whatsapp.proveedor,
    mensajes: filas.map((f) => ({ ...f, vencido: Boolean(f.vencido), enlace: enlaceWhatsApp(String(f.telefono), String(f.cuerpo)) })),
  });
});

/** POST /api/recepcion/whatsapp { idPaciente, mensaje, programadoPara? } - mensaje manual (solo si el paciente autorizó WhatsApp, RN-04). */
receptionRouter.post("/whatsapp", async (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const idPaciente = idPositivo(b.idPaciente, "El paciente");
  const mensaje = texto(b.mensaje, 1000, "El mensaje");
  let cuando: Date | null = null;
  if (b.programadoPara) {
    cuando = new Date(String(b.programadoPara));
    if (Number.isNaN(cuando.getTime())) throw new HttpError(400, "La hora de envío no es válida.", "DATOS_INVALIDOS");
  }
  await withConnection("Recepcionista", req.user!.id, async (conn) => {
    await conn.query("CALL sp_encolar_whatsapp(?, ?, ?)", [idPaciente, mensaje, cuando]);
  });
  res.status(201).json({ ok: true });
});

/** PATCH /api/recepcion/whatsapp/:id { estado: "Enviado" | "Fallido" | "Cancelado" } - modo manual: Recepción confirma lo que hizo. */
receptionRouter.patch("/whatsapp/:id", async (req, res) => {
  const id = idPositivo(req.params.id, "El mensaje");
  const estado = (req.body ?? {}).estado;
  if (!["Enviado", "Fallido", "Cancelado"].includes(estado)) throw new HttpError(400, "Estado no válido.", "DATOS_INVALIDOS");
  const afectadas = await withConnection("Recepcionista", req.user!.id, async (conn) => {
    const [r] = await conn.query<ResultSetHeader>(
      "UPDATE WHATSAPP_COLA SET estado = ?, fecha_envio = IF(? = 'Enviado', NOW(), fecha_envio) WHERE id_wa = ? AND estado IN ('Pendiente','Fallido')",
      [estado, estado, id],
    );
    return r.affectedRows;
  });
  if (afectadas === 0) throw new HttpError(409, "El mensaje ya no está pendiente.", "ESTADO_INVALIDO");
  res.json({ ok: true });
});
