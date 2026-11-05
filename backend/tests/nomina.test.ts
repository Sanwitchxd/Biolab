import assert from "node:assert/strict";
import { test } from "node:test";
import { fechaPagable, fechasDePago, resumenNomina } from "../src/services/nomina.js";

const toma = (g: Generator<string>, n: number) => { const r: string[] = []; for (const f of g) { r.push(f); if (r.length >= n) break; } return r; };

test("quincenal: días 15 y último de cada mes (febrero bisiesto incluido)", () => {
  assert.deepEqual(toma(fechasDePago("Quincenal", "2024-02-01"), 4), ["2024-02-15", "2024-02-29", "2024-03-15", "2024-03-31"]);
});
test("mensual: último día; semanal: cada 7 días", () => {
  assert.deepEqual(toma(fechasDePago("Mensual", "2026-01-31"), 3), ["2026-01-31", "2026-02-28", "2026-03-31"]);
  assert.deepEqual(toma(fechasDePago("Semanal", "2026-11-02"), 3), ["2026-11-02", "2026-11-09", "2026-11-16"]);
});
test("quincenal: no genera fechas anteriores a la de inicio", () => {
  assert.equal(toma(fechasDePago("Quincenal", "2026-11-20"), 1)[0], "2026-11-30");
});
test("adeudo = periodos vencidos sin pagar × sueldo", () => {
  const s = { salario: 1000, periodicidad: "Quincenal" as const, fechaInicio: "2026-10-01" };
  const r = resumenNomina(s, new Set(["2026-10-15"]), "2026-11-04");
  assert.deepEqual(r.pendientes, ["2026-10-31"]);
  assert.equal(r.adeudo, 1000);
  assert.equal(r.proximoPago, "2026-11-15");
  assert.equal(r.ultimoPago, "2026-10-15");
});
test("el día de pago ya cuenta como vencido; al corriente no se debe nada", () => {
  const s = { salario: 500, periodicidad: "Mensual" as const, fechaInicio: "2026-10-01" };
  assert.equal(resumenNomina(s, new Set(), "2026-10-31").adeudo, 500);
  assert.equal(resumenNomina(s, new Set(["2026-10-31"]), "2026-11-04").adeudo, 0);
});
test("fechaPagable: solo periodos vencidos o el próximo", () => {
  const s = { periodicidad: "Quincenal" as const, fechaInicio: "2026-10-01" };
  assert.equal(fechaPagable(s, "2026-10-15", "2026-11-15"), true);
  assert.equal(fechaPagable(s, "2026-11-15", "2026-11-15"), true);
  assert.equal(fechaPagable(s, "2026-11-30", "2026-11-15"), false);
  assert.equal(fechaPagable(s, "2026-10-20", "2026-11-15"), false);
});
