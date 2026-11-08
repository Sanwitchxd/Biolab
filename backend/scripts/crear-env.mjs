// Genera backend/.env a partir de database/CREDENCIALES.txt (sin imprimir ninguna contraseña).
// Uso:  npm run crear-env            (no sobrescribe un .env existente)
//       npm run crear-env -- --force (lo sobrescribe)
//       npm run crear-env -- --credenciales=RUTA  (otro archivo de credenciales)
//       npm run crear-env -- --puerto=3306        (puerto de MySQL; por defecto 3307)
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const backend = path.resolve(aqui, "..");
const destino = path.join(backend, ".env");
const args = process.argv.slice(2);
const forzar = args.includes("--force");
const rutaArg = args.find((a) => a.startsWith("--credenciales="))?.slice("--credenciales=".length);
const puertoArg = args.find((a) => a.startsWith("--puerto="))?.slice("--puerto=".length) ?? "3307";
const origen = rutaArg ? path.resolve(rutaArg) : path.resolve(backend, "..", "database", "CREDENCIALES.txt");

function salir(mensaje) {
  console.error(`\n${mensaje}\n`);
  process.exit(1);
}

if (!/^\d{2,5}$/.test(puertoArg) || Number(puertoArg) > 65535) {
  salir("--puerto debe ser un número entre 1 y 65535.");
}
if (fs.existsSync(destino) && !forzar) {
  salir("Ya existe backend/.env; no lo toqué. Si quieres regenerarlo usa:  npm run crear-env -- --force");
}
// Las cuentas se leen de database/CREDENCIALES.txt; si no existe (p. ej. al clonar el repositorio, donde ese
// archivo no se sube) se toman de las líneas CREATE USER de database/schema/03_roles_permisos.sql.
const cuentas = {};
if (fs.existsSync(origen)) {
  // Filas como: "Gerente       gerente_biolab       <contraseña>      rol_gerente"
  for (const linea of fs.readFileSync(origen, "utf8").split(/\r?\n/)) {
    const m = linea.match(/^\s*(Gerente|Recepcionista|Químico)\s+([A-Za-z0-9_]+_biolab)\s+(\S+)/u);
    if (m) cuentas[m[1]] = { user: m[2], password: m[3] };
  }
} else {
  const sql = path.resolve(backend, "..", "database", "schema", "03_roles_permisos.sql");
  if (!rutaArg && fs.existsSync(sql)) {
    const ROL = { gerente_biolab: "Gerente", recepcion_biolab: "Recepcionista", quimico_biolab: "Químico" };
    for (const m of fs.readFileSync(sql, "utf8").matchAll(/CREATE USER IF NOT EXISTS '([A-Za-z0-9_]+_biolab)'@'[^']*'\s+IDENTIFIED BY '([^']+)'/g)) {
      if (ROL[m[1]]) cuentas[ROL[m[1]]] = { user: m[1], password: m[2] };
    }
  } else {
    salir(`No encuentro ${origen}\nCopia .env.example a .env y complétalo a mano.`);
  }
}
const faltan = ["Gerente", "Recepcionista", "Químico"].filter((r) => !cuentas[r]);
if (faltan.length) salir(`No pude leer las cuentas de: ${faltan.join(", ")}. Revisa el formato de CREDENCIALES.txt.`);

const entre = (valor) => {
  if (/["\\\r\n]/.test(valor)) salir("Una contraseña contiene comillas, diagonal inversa o saltos de línea; escribe el .env a mano.");
  return `"${valor}"`;
};

const secreto = crypto.randomBytes(48).toString("base64url");
const contenido = `# Generado por «npm run crear-env». NO lo subas a un repositorio.
HOST=127.0.0.1
PORT=3001
NODE_ENV=development
TRUST_PROXY=false
CORS_ORIGIN=http://localhost:5173,http://localhost:8443

# Puerto de MySQL: 3307 en Windows, 3306 en Debian/Ubuntu y con Docker (lo fija el instalador)
DB_HOST=127.0.0.1
DB_PORT=${puertoArg}
DB_NAME=biolab
DB_TIMEZONE=-06:00
DB_POOL_LIMIT=10

DB_GERENTE_USER=${cuentas["Gerente"].user}
DB_GERENTE_PASSWORD=${entre(cuentas["Gerente"].password)}
DB_RECEPCION_USER=${cuentas["Recepcionista"].user}
DB_RECEPCION_PASSWORD=${entre(cuentas["Recepcionista"].password)}
DB_QUIMICO_USER=${cuentas["Químico"].user}
DB_QUIMICO_PASSWORD=${entre(cuentas["Químico"].password)}

JWT_SECRET="${secreto}"
JWT_EXPIRES_IN=8h

LOGIN_MAX_ATTEMPTS=5
LOGIN_WINDOW_MINUTES=15
`;

fs.writeFileSync(destino, contenido, { mode: 0o600 });
console.log("Listo: se creó backend/.env con las 3 cuentas de MySQL y un JWT_SECRET nuevo (no se muestran).");
console.log(`Puerto de MySQL configurado: ${puertoArg}. Si tu MySQL usa otro, edita DB_PORT en backend/.env.`);
