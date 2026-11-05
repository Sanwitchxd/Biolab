import cors from "cors";
import express from "express";
import helmet from "helmet";
import { authenticate } from "./auth/auth.js";
import { getConfig } from "./config/config.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import { createAuthRouter } from "./routes/auth.js";
import { healthRouter } from "./routes/health.js";
import { laboratoryRouter } from "./routes/laboratory.js";
import { managementRouter } from "./routes/management.js";
import { messagesRouter } from "./routes/messages.js";
import { receptionRouter } from "./routes/reception.js";
import { requireRole } from "./auth/roles.js";

export function createApp() {
  const cfg = getConfig();
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", cfg.trustProxy);
  app.use(helmet());
  app.use(
    cors({
      origin: cfg.corsOrigins.length ? cfg.corsOrigins : false,
      methods: ["GET", "POST", "PUT", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
  // La captura de resultados admite un PDF (base64) de hasta 10 MB: solo para sesiones de químico ya autenticadas.
  app.use("/api/laboratorio/resultados", authenticate, requireRole("Químico"), express.json({ limit: "15mb" }));
  app.use(express.json({ limit: "100kb" }));

  app.use("/api/health", healthRouter);
  app.use("/api/auth", createAuthRouter());
  app.use("/api/mensajes", messagesRouter);
  app.use("/api/gerencia", managementRouter);
  app.use("/api/recepcion", receptionRouter);
  app.use("/api/laboratorio", laboratoryRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
