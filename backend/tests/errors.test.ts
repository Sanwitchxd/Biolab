import assert from "node:assert/strict";
import { test } from "node:test";
import { HttpError, traducirErrorDb } from "../src/middleware/errors.js";
import { requireRole } from "../src/auth/roles.js";

const db = (errno: number, extra: object = {}) => traducirErrorDb({ errno, ...extra });

test("SIGNAL de MySQL (1644) devuelve el mensaje de la base con 409", () => {
  const e = db(1644, { sqlMessage: "RN-05: la orden tiene saldo pendiente" })!;
  assert.equal(e.status, 409);
  assert.equal(e.message, "RN-05: la orden tiene saldo pendiente");
});

test("access denied (1142, 1143, 1370) devuelve 403 sin exponer detalles", () => {
  for (const n of [1142, 1143, 1370]) {
    const e = db(n, { sqlMessage: "SELECT command denied to user 'x'@'y' for table 'BITACORA'" })!;
    assert.equal(e.status, 403);
    assert.ok(!e.message.includes("BITACORA"));
  }
});

test("CHECK, duplicado, conexión caída y credenciales de BD", () => {
  assert.equal(db(3819)!.status, 422);
  assert.equal(db(1062)!.status, 409);
  assert.equal(traducirErrorDb({ code: "ECONNREFUSED", errno: -111 })!.status, 503);
  assert.equal(db(1045)!.status, 503); // no es 401/403: es un problema de configuración
});

test("lo que no es de MySQL no se traduce", () => {
  assert.equal(traducirErrorDb(new Error("x")), null);
  assert.equal(traducirErrorDb(null), null);
});

test("requireRole: 401 sin usuario, 403 con otro rol, pasa con el correcto", () => {
  const mw = requireRole("Gerente");
  const llamar = (user?: { rol: string }) => {
    let recibido: unknown = "no-llamado";
    mw({ user } as never, {} as never, (e?: unknown) => { recibido = e; });
    return recibido;
  };
  assert.equal((llamar() as HttpError).status, 401);
  assert.equal((llamar({ rol: "Químico" }) as HttpError).status, 403);
  assert.equal((llamar({ rol: "Recepcionista" }) as HttpError).status, 403);
  assert.equal(llamar({ rol: "Gerente" }), undefined);
});
