/**
 * Comprueba contra la base REAL que cada cuenta de MySQL solo puede lo que dice PERMISOS.md.
 * Es de solo lectura: las pruebas de escritura usan ids inexistentes (-1) y deben ser rechazadas.
 * Uso:  npm run verificar
 */
import { closePools, withConnection } from "../database/db.js";
import { ROLES, type Rol } from "../auth/roles.js";

interface Prueba {
  rol: Rol;
  descripcion: string;
  sql: string;
  /** "ok" = debe funcionar; lista de errno = debe ser rechazada con alguno de esos códigos */
  espera: "ok" | number[];
}

const NEGADO_TABLA = 1142;
const NEGADO_COLUMNA = 1143;
const NEGADO_PROC = 1370;

const pruebas: Prueba[] = [
  // ---- Gerente ----
  { rol: "Gerente", descripcion: "lee vw_bitacora", sql: "SELECT COUNT(*) FROM vw_bitacora", espera: "ok" },
  { rol: "Gerente", descripcion: "lee USUARIO (sin hash)", sql: "SELECT id_usuario, nombre_usuario, rol, estado FROM USUARIO", espera: "ok" },
  { rol: "Gerente", descripcion: "lee vw_corte_caja", sql: "SELECT COUNT(*) FROM vw_corte_caja", espera: "ok" },
  { rol: "Gerente", descripcion: "NO lee contrasena_hash", sql: "SELECT contrasena_hash FROM USUARIO", espera: [NEGADO_COLUMNA] },
  { rol: "Gerente", descripcion: "NO borra la bitácora", sql: "DELETE FROM BITACORA WHERE id_bitacora = -1", espera: [NEGADO_TABLA] },
  { rol: "Gerente", descripcion: "NO modifica la bitácora", sql: "UPDATE BITACORA SET detalle = 'x' WHERE id_bitacora = -1", espera: [NEGADO_TABLA] },
  { rol: "Gerente", descripcion: "NO inserta en la bitácora", sql: "INSERT INTO BITACORA (id_usuario, accion) VALUES (-1, 'PRUEBA')", espera: [NEGADO_TABLA] },
  { rol: "Gerente", descripcion: "NO borra pagos", sql: "DELETE FROM PAGO WHERE id_pago = -1", espera: [NEGADO_TABLA] },
  // ---- Recepcionista ----
  { rol: "Recepcionista", descripcion: "lee PACIENTE", sql: "SELECT COUNT(*) FROM PACIENTE", espera: "ok" },
  { rol: "Recepcionista", descripcion: "lee ESTUDIO con precio", sql: "SELECT clave, nombre, precio FROM ESTUDIO", espera: "ok" },
  { rol: "Recepcionista", descripcion: "lee vw_saldo_orden", sql: "SELECT COUNT(*) FROM vw_saldo_orden", espera: "ok" },
  { rol: "Recepcionista", descripcion: "NO lee vw_bitacora", sql: "SELECT * FROM vw_bitacora", espera: [NEGADO_TABLA] },
  { rol: "Recepcionista", descripcion: "NO lee BITACORA", sql: "SELECT * FROM BITACORA", espera: [NEGADO_TABLA] },
  { rol: "Recepcionista", descripcion: "NO lee USUARIO", sql: "SELECT * FROM USUARIO", espera: [NEGADO_TABLA] },
  { rol: "Recepcionista", descripcion: "NO lee RESULTADO directo", sql: "SELECT * FROM RESULTADO", espera: [NEGADO_TABLA] },
  { rol: "Recepcionista", descripcion: "NO lee vw_corte_caja", sql: "SELECT * FROM vw_corte_caja", espera: [NEGADO_TABLA] },
  { rol: "Recepcionista", descripcion: "NO inserta en la bitácora", sql: "INSERT INTO BITACORA (id_usuario, accion) VALUES (-1, 'PRUEBA')", espera: [NEGADO_TABLA] },
  // ---- Químico ----
  { rol: "Químico", descripcion: "lee ESTUDIO sin precio", sql: "SELECT clave, nombre FROM ESTUDIO", espera: "ok" },
  { rol: "Químico", descripcion: "lee ORDEN (columnas permitidas)", sql: "SELECT id_orden, folio, estado FROM ORDEN", espera: "ok" },
  { rol: "Químico", descripcion: "lee RESULTADO", sql: "SELECT COUNT(*) FROM RESULTADO", espera: "ok" },
  { rol: "Químico", descripcion: "NO ve ESTUDIO.precio", sql: "SELECT precio FROM ESTUDIO", espera: [NEGADO_COLUMNA] },
  { rol: "Químico", descripcion: "NO ve precio_aplicado", sql: "SELECT precio_aplicado FROM DETALLE_ORDEN", espera: [NEGADO_COLUMNA] },
  { rol: "Químico", descripcion: "NO ve teléfono del paciente", sql: "SELECT telefono FROM PACIENTE", espera: [NEGADO_COLUMNA] },
  { rol: "Químico", descripcion: "NO ve fecha_cita", sql: "SELECT fecha_cita FROM ORDEN", espera: [NEGADO_COLUMNA] },
  { rol: "Químico", descripcion: "NO lee PAGO", sql: "SELECT * FROM PAGO", espera: [NEGADO_TABLA] },
  { rol: "Químico", descripcion: "NO lee vw_saldo_orden", sql: "SELECT * FROM vw_saldo_orden", espera: [NEGADO_TABLA] },
  { rol: "Químico", descripcion: "NO lee vw_corte_caja", sql: "SELECT * FROM vw_corte_caja", espera: [NEGADO_TABLA] },
  { rol: "Químico", descripcion: "NO lee USUARIO", sql: "SELECT * FROM USUARIO", espera: [NEGADO_TABLA] },
  { rol: "Químico", descripcion: "NO lee NOTIFICACION", sql: "SELECT * FROM NOTIFICACION", espera: [NEGADO_TABLA] },
  { rol: "Químico", descripcion: "NO lee vw_bitacora", sql: "SELECT * FROM vw_bitacora", espera: [NEGADO_TABLA] },
  { rol: "Químico", descripcion: "NO lee BITACORA", sql: "SELECT * FROM BITACORA", espera: [NEGADO_TABLA] },
  { rol: "Químico", descripcion: "NO ejecuta sp_crear_orden", sql: "CALL sp_crear_orden(-1, -1, NULL, NULL, @o, @f)", espera: [NEGADO_PROC] },
];

let fallos = 0;
const col = (s: string, n: number) => s.padEnd(n);

for (const rol of ROLES) {
  console.log(`\n== ${rol} ==`);
  for (const p of pruebas.filter((x) => x.rol === rol)) {
    let resultado: string;
    let bien: boolean;
    try {
      await withConnection(rol, null, (conn) => conn.query(p.sql));
      bien = p.espera === "ok";
      resultado = bien ? "permitido" : "¡MYSQL LO PERMITIÓ!";
    } catch (err) {
      const errno = (err as { errno?: number }).errno;
      if (p.espera === "ok") {
        bien = false;
        resultado = `¡FALLÓ! errno=${errno ?? "?"} ${(err as { sqlMessage?: string }).sqlMessage ?? ""}`;
      } else {
        bien = errno !== undefined && p.espera.includes(errno);
        resultado = bien ? `rechazado por MySQL (errno ${errno})` : `¡rechazado por otra causa! errno=${errno ?? "?"}`;
      }
    }
    if (!bien) fallos++;
    console.log(`  ${bien ? "OK   " : "FALLO"} ${col(p.descripcion, 36)} ${resultado}`);
  }
}

// La variable de sesión debe quedar fijada y limpia entre usos de la misma conexión.
console.log("\n== Variable de sesión @app_usuario_id ==");
const leer = (id: number | null) =>
  withConnection("Gerente", id, async (c) => {
    const [f] = await c.query("SELECT @app_usuario_id AS v");
    return (f as { v: number | null }[])[0]!.v;
  });
const a = await leer(7), b = await leer(null);
const okVar = Number(a) === 7 && b === null;
if (!okVar) fallos++;
console.log(`  ${okVar ? "OK   " : "FALLO"} se fija con el id del token y no se arrastra a la siguiente petición`);

await closePools();
console.log(fallos === 0 ? "\nTodo correcto: cada rol solo puede lo que le corresponde." : `\n${fallos} prueba(s) con resultado inesperado. Revisa database/PERMISOS.md.`);
process.exit(fallos === 0 ? 0 : 1);
