# BioLab

Sistema web para laboratorio de análisis clínicos. Esta entrega (U3-E1) presenta el módulo de **Recepción** con su **bitácora** de movimientos.

**Equipo 11:** Arismendi Vazquez Marcos · Nogueron Rojas Cesar Uriel  
**Stack:** TypeScript 5.7 · React 19 + Vite 8 + Tailwind CSS 4 · Node.js + Express 5 · mysql2 · MySQL 8.4 (MariaDB no es compatible)  
**Estado E1:** entorno y base de datos preparados; el módulo de Recepción funciona y sus casos de uso (U1 a U8 y U14) se integran en E2.

## Instalar en una computadora nueva (un solo paso)

Clona el repositorio y ejecuta **un** archivo. Instala Node.js, el gestor de base de datos (MySQL 8.4), las dependencias, crea la base de datos y la configuración.

```
git clone https://github.com/Sanwitchxd/Biolab.git
```

| Sistema | Instalar | Iniciar |
|---|---|---|
| **Windows 10/11** | doble clic en **`INSTALAR-WINDOWS.bat`** | doble clic en **`INICIAR-WINDOWS.bat`** |
| **Debian / Ubuntu** | `bash INSTALAR-DEBIAN.sh` | `bash INICIAR-DEBIAN.sh` |

Después abre **http://localhost:8443** e inicia sesión con el usuario de Recepción (ver [Usuario y contraseña](#usuario-y-contraseña)).

Necesitas internet durante la instalación (descarga unos 400 MB). En Windows se usa `winget` (incluido en Windows 10/11 actualizados); en Debian/Ubuntu hace falta `sudo`.
La instalación se puede repetir sin riesgo: no vuelve a crear ni borra una base de datos existente. Al terminar debe decir **«Todo correcto»**.
Al iniciar se abren las ventanas `BioLab-Backend` y `BioLab-Frontend` (y la de MySQL, minimizada): **no las cierres mientras uses el sistema**.

## Qué hace el instalador

1. Instala Node.js si falta y MySQL 8.4 (en Windows, portable dentro de `database\runtime`, puerto **3307**; en Debian, puerto **3306**).
2. **Crea la base de datos** `biolab` ejecutando en orden los scripts de `database/schema/` (01 a 05).
3. Genera `backend/.env` con la configuración de conexión.
4. Instala las dependencias de `backend/` y `frontend/` y carga el catálogo de estudios (`database/seeds/`).
5. Verifica los permisos de la base de datos.

No se usa un framework de migraciones: el procedimiento válido de creación son los scripts SQL numerados.

## Usuario y contraseña

El usuario del módulo de Recepción es **`recepcion01`**. Sus datos de ejemplo, junto con las cuentas de la base de datos, están en **`database/CREDENCIALES.txt`** (viene en el repositorio y el instalador lo usa para generar `backend/.env`).

> Son credenciales **de ejemplo**, iguales para todas las instalaciones. **Cámbialas** antes de usar datos reales.

Para cambiar la contraseña de un usuario de la aplicación:

1. Genera el hash de la nueva contraseña (desde la carpeta `backend`, después de `npm install`):
   ```
   node --input-type=module -e "import b from 'bcryptjs'; console.log(b.hashSync(process.argv[1], 12))" "TuNuevaClave"
   ```
2. Entra a MySQL como administrador (en Windows la contraseña de root está en `database\runtime\root-password.txt`):
   ```
   $env:MYSQL_PWD = (Get-Content database\runtime\root-password.txt -Raw).Trim()
   database\runtime\mysql\bin\mysql.exe -u root --protocol=tcp --port=3307 biolab
   ```
3. Guarda el hash (para cambiar el nombre de usuario, modifica `nombre_usuario` de la misma forma):
   ```
   UPDATE USUARIO SET contrasena_hash = 'PEGA_AQUÍ_EL_HASH' WHERE nombre_usuario = 'recepcion01';
   ```

## Estructura

```
biolab/
├── INSTALAR-WINDOWS.bat   INICIAR-WINDOWS.bat
├── INSTALAR-DEBIAN.sh     INICIAR-DEBIAN.sh
├── README.md
├── frontend/   página web (React + Vite + Tailwind)
│   └── src/
│       ├── styles/        tema y colores (index.css)
│       ├── services/      conexión con el backend (api, sesión)
│       ├── components/    layout/ (Shell) y ui/ (tarjetas, formularios, modal)
│       ├── utils/         formato de fechas/moneda, impresión
│       └── pages/         login/ y reception/
├── backend/    API (Node + Express + MySQL)
│   ├── src/config/        lee y valida backend/.env
│   ├── src/database/      db.ts: conexión con MySQL (pool de mysql2 por rol)
│   ├── src/routes/        auth.ts (inicio de sesión) y reception.ts (pacientes, citas, pagos)
│   └── tests/             pruebas
├── database/   schema/ (SQL numerado), seeds/ (catálogo), PERMISOS.md, docker-compose.yml
└── scripts/    lo que ejecutan los instaladores (windows/ y debian/)
```

## Configuración (`backend/.env`)

El archivo `backend/.env` **no se sube a GitHub**; el repositorio incluye `backend/.env.example` con los nombres de las variables. El backend lo carga con `dotenv` desde `backend/src/config/config.ts` y, si falta alguna variable, no arranca y dice cuál.

- Conexión: `DB_HOST`, `DB_PORT`, `DB_NAME`; una cuenta de MySQL por rol (`DB_RECEPCION_*` para Recepción; las demás variables `DB_*` también son obligatorias) y `JWT_SECRET`.
- WhatsApp: `WHATSAPP_PROVIDER=manual` (por defecto, sin internet) o `cloudapi`.
- Para generarlo: `cd backend` y `npm run crear-env` (usa `-- --force --puerto=3307` para regenerarlo). Toma las cuentas de `database/CREDENCIALES.txt` (o, si no existe, de `database/schema/03_roles_permisos.sql`).

## Demostración técnica (aplicación ↔ base de datos)

1. Inicia sesión como `recepcion01`.
2. En **Nueva cita**, registra un paciente **ficticio** con un estudio; aparece el folio `LMT-AAAAMMDD-001`.
3. En **Pacientes** se ve el paciente (consulta desde la aplicación).
4. Comprueba en la base de datos (terminal de MySQL del apartado anterior):
   ```
   SELECT id_paciente, nombre_completo, telefono FROM PACIENTE ORDER BY id_paciente DESC LIMIT 3;
   SELECT id_orden, folio, estado FROM ORDEN ORDER BY id_orden DESC LIMIT 3;
   SELECT id_bitacora, accion, detalle, fecha_hora FROM BITACORA ORDER BY id_bitacora DESC LIMIT 5;
   ```
5. La conexión está en `backend/src/database/db.ts`; la operación, en `backend/src/routes/reception.ts`.

## Opciones avanzadas

- Reinstalar la base de datos desde cero (**borra los datos**): `INSTALAR-WINDOWS.bat -ReinstalarBd` · `bash INSTALAR-DEBIAN.sh --reinstalar-bd`
- Ya tengo Node y MySQL: `INSTALAR-WINDOWS.bat -SoloApp` · `bash INSTALAR-DEBIAN.sh --solo-app`
- Instalación manual con un MySQL 8 propio: ejecuta en orden los scripts de `database/schema/` (una sola vez cada uno; `05_mejoras.sql` no se puede repetir), y luego `cd backend` → `npm install`, `npm run crear-env`, `npm run cargar-catalogo`, `npm run dev`; en otra terminal `cd frontend` → `npm install`, `npm run dev`.
- Usar Docker para la base de datos: ver `database/README.md`.
- Pruebas: `cd backend` → `npm test`. Permisos de la base de datos: `npm run verificar`.

## Problemas frecuentes

- **`ECONNREFUSED` al iniciar sesión:** el backend no está encendido. Revisa la ventana `BioLab-Backend` o ejecuta `cd backend` y `npm run dev`.
- **«Faltan variables en backend/.env»:** `cd backend` y `npm run crear-env -- --force`.
- **El instalador pide la contraseña de root de un MySQL:** ya hay un servidor en el puerto 3307; ciérralo o reinicia el equipo y vuelve a ejecutarlo.
- **MySQL no arranca:** revisa la ventana minimizada de `mysqld`.

## Seguridad

No subas `backend/.env` ni `database/runtime/` (el `.gitignore` ya los excluye). `database/CREDENCIALES.txt` contiene cuentas de ejemplo: cámbialas antes de usar datos reales. Los datos de demostración deben ser ficticios.
