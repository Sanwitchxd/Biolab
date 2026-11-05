import fs from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import type { Rol } from "./roles.js";

export interface CuentaDb { user: string; password: string }

export interface AppConfig {
  host: string;
  port: number;
  nodeEnv: string;
  trustProxy: boolean | number | string;
  corsOrigins: string[];
  db: {
    host: string;
    port: number;
    name: string;
    timezone: string;
    poolLimit: number;
    cuentas: Record<Rol, CuentaDb>;
  };
  jwt: { secret: string; expiresIn: string };
  login: { maxIntentos: number; ventanaMs: number };
}

/** Carga backend/.env (si existe) sin pisar variables que ya vengan del entorno (Docker, systemd...). */
function cargarArchivoEnv(): void {
  const ruta = fileURLToPath(new URL("../.env", import.meta.url));
  if (!fs.existsSync(ruta)) return;
  const valores = dotenv.parse(fs.readFileSync(ruta));
  for (const [clave, valor] of Object.entries(valores)) {
    if (process.env[clave] === undefined) process.env[clave] = valor;
  }
}

function entero(env: NodeJS.ProcessEnv, nombre: string, defecto: number, min: number, max: number): number {
  const crudo = env[nombre]?.trim();
  if (!crudo) return defecto;
  const n = Number(crudo);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`La variable ${nombre} debe ser un entero entre ${min} y ${max}.`);
  }
  return n;
}

/** Valida y arma la configuración. Solo menciona NOMBRES de variables, nunca sus valores. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const obligatorias = [
    "DB_GERENTE_USER", "DB_GERENTE_PASSWORD",
    "DB_RECEPCION_USER", "DB_RECEPCION_PASSWORD",
    "DB_QUIMICO_USER", "DB_QUIMICO_PASSWORD",
    "JWT_SECRET",
  ];
  const faltan = obligatorias.filter((n) => !env[n]?.trim());
  if (faltan.length) {
    throw new Error(
      `Faltan variables en backend/.env: ${faltan.join(", ")}. ` +
        "Ejecuta «npm run crear-env» o copia .env.example a .env y complétalo.",
    );
  }

  const secreto = env.JWT_SECRET!;
  if (secreto.length < 32 || secreto.toUpperCase().includes("CAMBIAR")) {
    throw new Error("JWT_SECRET debe ser una cadena aleatoria de al menos 32 caracteres (usa «npm run crear-env»).");
  }

  const timezone = env.DB_TIMEZONE?.trim() || "-06:00";
  if (!/^[+-]\d{2}:\d{2}$/.test(timezone)) throw new Error("DB_TIMEZONE debe verse como -06:00.");

  const proxy = (env.TRUST_PROXY ?? "false").trim();
  const trustProxy: AppConfig["trustProxy"] =
    proxy === "false" || proxy === "" ? false : proxy === "true" ? true : /^\d+$/.test(proxy) ? Number(proxy) : proxy;

  return {
    host: env.HOST?.trim() || "127.0.0.1",
    port: entero(env, "PORT", 3001, 1, 65535),
    nodeEnv: env.NODE_ENV?.trim() || "development",
    trustProxy,
    corsOrigins: (env.CORS_ORIGIN ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    db: {
      host: env.DB_HOST?.trim() || "127.0.0.1",
      port: entero(env, "DB_PORT", 3307, 1, 65535),
      name: env.DB_NAME?.trim() || "biolab",
      timezone,
      poolLimit: entero(env, "DB_POOL_LIMIT", 10, 1, 100),
      cuentas: {
        Gerente: { user: env.DB_GERENTE_USER!.trim(), password: env.DB_GERENTE_PASSWORD! },
        Recepcionista: { user: env.DB_RECEPCION_USER!.trim(), password: env.DB_RECEPCION_PASSWORD! },
        Químico: { user: env.DB_QUIMICO_USER!.trim(), password: env.DB_QUIMICO_PASSWORD! },
      },
    },
    jwt: { secret: secreto, expiresIn: env.JWT_EXPIRES_IN?.trim() || "8h" },
    login: {
      maxIntentos: entero(env, "LOGIN_MAX_ATTEMPTS", 5, 1, 100),
      ventanaMs: entero(env, "LOGIN_WINDOW_MINUTES", 15, 1, 1440) * 60_000,
    },
  };
}

let cache: AppConfig | null = null;
export function getConfig(): AppConfig {
  if (!cache) {
    cargarArchivoEnv();
    cache = loadConfig(process.env);
  }
  return cache;
}
