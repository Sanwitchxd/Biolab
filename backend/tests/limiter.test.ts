import assert from "node:assert/strict";
import { test } from "node:test";
import { AttemptLimiter } from "../src/middleware/limiter.js";

test("bloquea al llegar al máximo de fallos y libera al pasar la ventana", () => {
  let t = 0;
  const l = new AttemptLimiter(3, 60_000, () => t);
  for (let i = 0; i < 2; i++) l.registrarFallo("u");
  assert.equal(l.segundosBloqueado("u"), 0);
  l.registrarFallo("u");
  assert.equal(l.segundosBloqueado("u"), 60);
  t = 30_000;
  assert.equal(l.segundosBloqueado("u"), 30);
  t = 60_001;
  assert.equal(l.segundosBloqueado("u"), 0);
});

test("cada clave lleva su propia cuenta y reiniciar la limpia", () => {
  const l = new AttemptLimiter(2, 60_000);
  l.registrarFallo("a"); l.registrarFallo("a");
  assert.ok(l.segundosBloqueado("a") > 0);
  assert.equal(l.segundosBloqueado("b"), 0);
  l.reiniciar("a");
  assert.equal(l.segundosBloqueado("a"), 0);
});
