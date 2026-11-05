/**
 * Carga el catálogo de EJEMPLO usando la cuenta del Gerente (que tiene INSERT/UPDATE sobre ESTUDIO y
 * PARAMETRO_ESTUDIO): no se amplía ningún permiso.
 *   - database/seeds/05_catalogo_ejemplo.sql   solo si el catálogo está vacío
 *   - database/seeds/06_catalogo_ampliado.sql  siempre (es idempotente: agrega lo que falta, no pisa lo editado)
 * Uso:  npm run cargar-catalogo
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { buscarUsuarioLogin } from "../auth/auth.js";
import { closePools, withTransaction } from "../database/db.js";

const rutaSeed = (archivo: string) => fileURLToPath(new URL(`../../../database/seeds/${archivo}`, import.meta.url));

function sentencias(archivo: string): string[] {
  const ruta = rutaSeed(archivo);
  if (!fs.existsSync(ruta)) throw new Error(`No encuentro ${ruta}`);
  return fs.readFileSync(ruta, "utf8")
    .split(/\r?\n/).filter((l) => !l.trim().startsWith("--")).join("\n")
    .split(";").map((s) => s.trim()).filter((s) => s && !/^USE\s/i.test(s));
}

try {
  const base = sentencias("05_catalogo_ejemplo.sql");
  const ampliado = sentencias("06_catalogo_ampliado.sql");
  const gerente = await buscarUsuarioLogin("Gerente", "gerente01");
  if (!gerente) throw new Error("No existe el usuario gerente01 en la base.");
  await withTransaction("Gerente", gerente.id_usuario, async (conn) => {
    const cuenta = async () => Number(((await conn.query("SELECT COUNT(*) AS n FROM ESTUDIO"))[0] as { n: number }[])[0]!.n);
    const antes = await cuenta();
    if (antes === 0) for (const sql of base) await conn.query(sql);
    for (const sql of ampliado) await conn.query(sql);
    const despues = await cuenta();
    console.log(despues > antes
      ? `Catálogo cargado: ${despues - antes} estudios nuevos (${despues} en total).`
      : `El catálogo ya estaba completo (${despues} estudios). Se completaron referencias faltantes si las había.`);
  });
} catch (err) {
  const e = err as { errno?: number; sqlMessage?: string; message?: string };
  console.error(`No se pudo cargar el catálogo: ${e.sqlMessage ?? e.message ?? err}`);
  if (e.errno === 1054) console.error("Falta actualizar la base de datos (database/schema/05_mejoras.sql). Ejecuta de nuevo el instalador.");
  process.exitCode = 1;
} finally {
  await closePools();
}
