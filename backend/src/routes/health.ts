import { Router } from "express";
import { withConnection } from "../database/db.js";
import { ROLES } from "../auth/roles.js";

/** GET /api/health - ¿responde cada una de las 3 cuentas de MySQL? (sin datos sensibles) */
export const healthRouter = Router().get("/", async (_req, res) => {
  const bd: Record<string, boolean> = {};
  await Promise.all(
    ROLES.map(async (rol) => {
      try {
        await withConnection(rol, null, (c) => c.query("SELECT 1"));
        bd[rol] = true;
      } catch {
        bd[rol] = false;
      }
    }),
  );
  const todo = Object.values(bd).every(Boolean);
  res.status(todo ? 200 : 503).json({ estado: todo ? "ok" : "degradado", bd });
});
