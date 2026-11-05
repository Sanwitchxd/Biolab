import assert from "node:assert/strict";
import { test } from "node:test";
import { loadConfig } from "../src/config/config.js";

const base = {
  DB_GERENTE_USER: "g", DB_GERENTE_PASSWORD: "p1",
  DB_RECEPCION_USER: "r", DB_RECEPCION_PASSWORD: "p2",
  DB_QUIMICO_USER: "q", DB_QUIMICO_PASSWORD: "p3",
  JWT_SECRET: "x".repeat(40),
};

test("valores por defecto: puerto MySQL 3307 y zona horaria de México", () => {
  const c = loadConfig(base);
  assert.equal(c.db.port, 3307);
  assert.equal(c.db.timezone, "-06:00");
  assert.equal(c.db.cuentas["Químico"].user, "q");
});

test("falta de variables: el error nombra variables pero no muestra valores", () => {
  assert.throws(() => loadConfig({ ...base, DB_QUIMICO_PASSWORD: "" }), (e: Error) =>
    e.message.includes("DB_QUIMICO_PASSWORD") && !e.message.includes("p1"));
});

test("JWT_SECRET débil o de plantilla se rechaza", () => {
  assert.throws(() => loadConfig({ ...base, JWT_SECRET: "corto" }));
  assert.throws(() => loadConfig({ ...base, JWT_SECRET: "CAMBIAR".padEnd(40, "x") }));
});

test("WhatsApp: manual por defecto; cloudapi exige token e id; país solo dígitos", () => {
  assert.equal(loadConfig(base).whatsapp.proveedor, "manual");
  assert.throws(() => loadConfig({ ...base, WHATSAPP_PROVIDER: "cloudapi" }));
  assert.equal(loadConfig({ ...base, WHATSAPP_PROVIDER: "cloudapi", WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_ID: "1" }).whatsapp.proveedor, "cloudapi");
  assert.throws(() => loadConfig({ ...base, WHATSAPP_PROVIDER: "otro" }));
  assert.throws(() => loadConfig({ ...base, WHATSAPP_PAIS: "+52" }));
});
