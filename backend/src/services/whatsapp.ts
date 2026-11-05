import type { RowDataPacket } from "mysql2/promise";
import { getConfig } from "../config/config.js";
import { withConnection } from "../database/db.js";

/**
 * Envío de WhatsApp. Los mensajes los DEJA en WHATSAPP_COLA la base de datos (triggers y evento de las 17:00)
 * o Recepción (mensaje manual). Aquí solo se entregan:
 *   - proveedor "manual":   no se envía nada desde el servidor; Recepción ve la cola y abre WhatsApp con el texto listo.
 *   - proveedor "cloudapi": un proceso revisa la cola cada minuto y envía por la API oficial de WhatsApp Business.
 */

const MAX_INTENTOS = 3;

/** Teléfono de 10 dígitos + código de país, sin signos (formato que pide WhatsApp). */
export function telefonoInternacional(telefono: string): string {
  const digitos = telefono.replace(/\D/g, "");
  return digitos.length === 10 ? `${getConfig().whatsapp.pais}${digitos}` : digitos;
}

/** Enlace que abre WhatsApp (Web o app) con el chat del paciente y el texto ya escrito. */
export function enlaceWhatsApp(telefono: string, texto: string): string {
  return `https://wa.me/${telefonoInternacional(telefono)}?text=${encodeURIComponent(texto)}`;
}

async function enviarCloudApi(telefono: string, texto: string): Promise<void> {
  const { token, phoneId, version } = getConfig().whatsapp;
  const res = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: telefonoInternacional(telefono),
      type: "text",
      text: { preview_url: false, body: texto },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const detalle = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(`WhatsApp respondió ${res.status}${detalle?.error?.message ? `: ${detalle.error.message}` : ""}`);
  }
}

/** Entrega los mensajes vencidos. Devuelve cuántos salieron. */
export async function procesarCola(): Promise<number> {
  if (getConfig().whatsapp.proveedor !== "cloudapi") return 0;
  let enviados = 0;
  await withConnection("Recepcionista", null, async (conn) => {
    const [pendientes] = await conn.query<RowDataPacket[]>(
      `SELECT id_wa, telefono, cuerpo, intentos FROM WHATSAPP_COLA
        WHERE estado = 'Pendiente' AND programado_para <= NOW() AND intentos < ?
        ORDER BY programado_para, id_wa LIMIT 20`,
      [MAX_INTENTOS],
    );
    for (const m of pendientes) {
      try {
        await enviarCloudApi(String(m.telefono), String(m.cuerpo));
        await conn.query("UPDATE WHATSAPP_COLA SET estado = 'Enviado', fecha_envio = NOW(), error = NULL WHERE id_wa = ? AND estado = 'Pendiente'", [m.id_wa]);
        enviados += 1;
      } catch (err) {
        const intentos = Number(m.intentos) + 1;
        const mensaje = (err instanceof Error ? err.message : "Error desconocido").slice(0, 255);
        await conn.query(
          "UPDATE WHATSAPP_COLA SET intentos = ?, error = ?, estado = ? WHERE id_wa = ? AND estado = 'Pendiente'",
          [intentos, mensaje, intentos >= MAX_INTENTOS ? "Fallido" : "Pendiente", m.id_wa],
        );
      }
    }
  });
  return enviados;
}

/** Arranca la revisión periódica (solo con proveedor cloudapi). Devuelve la función para detenerla. */
export function iniciarEnvioWhatsApp(): () => void {
  const cfg = getConfig().whatsapp;
  if (cfg.proveedor !== "cloudapi") return () => undefined;
  let ocupado = false;
  const timer = setInterval(() => {
    if (ocupado) return;
    ocupado = true;
    procesarCola()
      .catch((err: unknown) => console.warn(`[WhatsApp] no se pudo revisar la cola: ${err instanceof Error ? err.message : err}`))
      .finally(() => { ocupado = false; });
  }, cfg.intervaloMs);
  timer.unref();
  console.log(`  WhatsApp: envío automático activo (cada ${cfg.intervaloMs / 1000} s)`);
  return () => clearInterval(timer);
}
