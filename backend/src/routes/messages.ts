import { Router } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { authenticate } from "../auth/auth.js";
import { withConnection } from "../database/db.js";
import { HttpError } from "../middleware/errors.js";

/**
 * /api/mensajes/*  - chat interno entre Gerente, Recepcionista y Químico.
 * La privacidad la impone MySQL: cada cuenta solo lee vw_mis_mensajes (mensajes donde participa la sesión)
 * y solo escribe con sp_enviar_mensaje (el remitente es siempre el usuario de la sesión).
 */
export const messagesRouter = Router();
messagesRouter.use(authenticate);

function idPositivo(valor: unknown, que = "El contacto"): number {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `${que} no es válido.`, "DATOS_INVALIDOS");
  return n;
}

/** GET /api/mensajes/resumen - contactos activos con su último mensaje y los no leídos de cada uno. */
messagesRouter.get("/resumen", async (req, res) => {
  const yo = req.user!;
  const filas = await withConnection(yo.rol, yo.id, async (conn) => {
    const [r] = await conn.query<RowDataPacket[]>(
      `SELECT c.id_usuario, c.nombre_completo, c.rol,
              (SELECT m.cuerpo     FROM vw_mis_mensajes m WHERE (m.id_remitente = c.id_usuario OR m.id_destinatario = c.id_usuario) ORDER BY m.id_mensaje DESC LIMIT 1) AS ultimo,
              (SELECT m.fecha_hora FROM vw_mis_mensajes m WHERE (m.id_remitente = c.id_usuario OR m.id_destinatario = c.id_usuario) ORDER BY m.id_mensaje DESC LIMIT 1) AS ultima_fecha,
              (SELECT COUNT(*)     FROM vw_mis_mensajes m WHERE m.id_remitente = c.id_usuario AND m.id_destinatario = ? AND m.leido_en IS NULL) AS no_leidos
         FROM vw_contactos c
        WHERE c.id_usuario <> ?
        ORDER BY (ultima_fecha IS NULL), ultima_fecha DESC, c.nombre_completo`,
      [yo.id, yo.id],
    );
    return r;
  });
  res.json({
    contactos: filas.map((f) => ({ ...f, no_leidos: Number(f.no_leidos) })),
    no_leidos: filas.reduce((s, f) => s + Number(f.no_leidos), 0),
  });
});

/** GET /api/mensajes/conversacion/:id?desde=<id_mensaje> - los últimos 200 mensajes con ese contacto; marca los recibidos como leídos. */
messagesRouter.get("/conversacion/:id", async (req, res) => {
  const yo = req.user!;
  const otro = idPositivo(req.params.id);
  const mensajes = await withConnection(yo.rol, yo.id, async (conn) => {
    await conn.query("CALL sp_marcar_leidos(?)", [otro]);
    const [r] = await conn.query<RowDataPacket[]>(
      `SELECT * FROM (
         SELECT id_mensaje, id_remitente, cuerpo, fecha_hora, leido_en
           FROM vw_mis_mensajes
          WHERE (id_remitente = ? AND id_destinatario = ?) OR (id_remitente = ? AND id_destinatario = ?)
          ORDER BY id_mensaje DESC LIMIT 200
       ) t ORDER BY id_mensaje`,
      [yo.id, otro, otro, yo.id],
    );
    return r;
  });
  res.json({ mensajes: mensajes.map((m) => ({ ...m, id_mensaje: Number(m.id_mensaje), mio: m.id_remitente === yo.id })) });
});

/** POST /api/mensajes { para, texto } */
messagesRouter.post("/", async (req, res) => {
  const yo = req.user!;
  const b = (req.body ?? {}) as Record<string, unknown>;
  const para = idPositivo(b.para, "El destinatario");
  const texto = typeof b.texto === "string" ? b.texto.trim() : "";
  if (!texto) throw new HttpError(400, "Escribe un mensaje.", "DATOS_INVALIDOS");
  if (texto.length > 1000) throw new HttpError(400, "El mensaje es demasiado largo (máximo 1000 caracteres).", "DATOS_INVALIDOS");
  await withConnection(yo.rol, yo.id, async (conn) => {
    await conn.query<ResultSetHeader>("CALL sp_enviar_mensaje(?, ?)", [para, texto]);
  });
  res.status(201).json({ ok: true });
});
