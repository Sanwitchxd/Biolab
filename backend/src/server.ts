import { createApp } from "./app.js";
import { getConfig } from "./config/config.js";
import { closePools, withConnection } from "./database/db.js";
import { ROLES } from "./auth/roles.js";
import { iniciarEnvioWhatsApp } from "./services/whatsapp.js";

const cfg = (() => {
  try {
    return getConfig();
  } catch (err) {
    console.error(`\n[CONFIGURACIÓN] ${(err as Error).message}\n`);
    return process.exit(1);
  }
})();

const app = createApp();
const server = app.listen(cfg.port, cfg.host, () => {
  console.log(`BioLab API escuchando en http://${cfg.host}:${cfg.port}  (MySQL ${cfg.db.host}:${cfg.db.port}/${cfg.db.name})`);
  void comprobarBaseDeDatos();
  detenerWhatsApp = iniciarEnvioWhatsApp();
});
let detenerWhatsApp: () => void = () => undefined;

/** Aviso temprano si alguna cuenta de MySQL no responde (no se imprimen usuarios ni contraseñas). */
async function comprobarBaseDeDatos(): Promise<void> {
  for (const rol of ROLES) {
    try {
      await withConnection(rol, null, async (conn) => {
        if (rol === "Gerente") {
          const [filas] = await conn.query("SELECT @@global.event_scheduler AS ev");
          const ev = (filas as { ev: string }[])[0]?.ev;
          if (ev !== "ON") console.warn("[AVISO] event_scheduler no está ON: los recordatorios de las 17:00 no se generarán.");
        } else {
          await conn.query("SELECT 1");
        }
      });
      console.log(`  MySQL (${rol}): conexión OK`);
    } catch (err) {
      const e = err as { code?: string; errno?: number };
      console.error(`  MySQL (${rol}): NO se pudo conectar (${e.code ?? e.errno ?? "error"}). Revisa DB_HOST, DB_PORT y las cuentas en backend/.env`);
    }
  }
}

async function apagar(): Promise<void> {
  detenerWhatsApp();
  server.close();
  await closePools();
  process.exit(0);
}
process.on("SIGINT", () => void apagar());
process.on("SIGTERM", () => void apagar());
