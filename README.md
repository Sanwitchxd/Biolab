# BioLab

Sistema web para un laboratorio de análisis clínicos. Administra pacientes y citas, cobros y tickets, muestras, captura y validación de resultados, avisos por WhatsApp, usuarios, nómina, catálogo de estudios, corte de caja y una **bitácora inmutable** de todos los movimientos.

**Equipo 11:** Arismendi Vazquez Marcos · Nogueron Rojas Cesar Uriel  
**Stack:** TypeScript 5.7 · React 19 + Vite 8 + Tailwind CSS 4 · Node.js + Express 5 · mysql2 · MySQL 8.4 (MariaDB no es compatible)  
**Tipo de aplicación:** web local; se aloja en el servidor de la sucursal y no se expone a internet (RNF-01).  
**Estado E2:** los tres módulos (Recepción, Laboratorio y Gerencia) están integrados y funcionan con la base de datos. Los pendientes conocidos están en [Pendientes](#pendientes-conocidos).

## Instalar en una computadora nueva (un solo paso)

Clona el repositorio y ejecuta **un** archivo. Instala Node.js, el gestor de base de datos (MySQL 8.4), las dependencias, crea la base de datos y la configuración.

```
git clone https://github.com/Sanwitchxd/Biolab.git
```

| Sistema | Instalar | Iniciar |
|---|---|---|
| **Windows 10/11** | doble clic en **`INSTALAR-WINDOWS.bat`** | doble clic en **`INICIAR-WINDOWS.bat`** |
| **Debian / Ubuntu** | `bash INSTALAR-DEBIAN.sh` | `bash INICIAR-DEBIAN.sh` |

Después abre **http://localhost:8443** e inicia sesión (ver [Usuarios y contraseñas](#usuarios-y-contraseñas)).

Necesitas internet durante la instalación (descarga unos 400 MB). En Windows se usa `winget` (incluido en Windows 10/11 actualizados); en Debian/Ubuntu hace falta `sudo`.
La instalación se puede repetir sin riesgo: no vuelve a crear ni borra una base de datos existente. Al terminar debe decir **«Todo correcto»**.
Al iniciar se abren las ventanas `BioLab-Backend` y `BioLab-Frontend` (y la de MySQL, minimizada): **no las cierres mientras uses el sistema**.

## Qué hace el instalador

1. Instala Node.js si falta y MySQL 8.4 (en Windows, portable dentro de `database\runtime`, puerto **3307**; en Debian, puerto **3306**).
2. **Crea la base de datos** `biolab` ejecutando en orden los scripts de `database/schema/` (01 a 05). Si la base ya existe, no toca sus datos y solo aplica `05_mejoras.sql` cuando falta.
3. Genera `backend/.env` con la configuración de conexión (y lo regenera si está incompleto).
4. Instala las dependencias de `backend/` y `frontend/` y carga el catálogo de estudios (`database/seeds/`).
5. Verifica los permisos de la base de datos (33 comprobaciones).

No se usa un framework de migraciones: el procedimiento válido de creación son los scripts SQL numerados.

## Usuarios y contraseñas

| Rol | Usuario | Qué puede hacer |
|---|---|---|
| Recepcionista | `recepcion01` | pacientes, citas, cobros, entrega de resultados, WhatsApp, mensajes |
| Químico | `quimico01` | muestras, incidencias, captura y validación de resultados, mensajes |
| Gerente | `gerente01` | usuarios y nómina, catálogo de estudios, bitácora, corte de caja, estadísticas, mensajes |

Las contraseñas iniciales y las cuentas de la base de datos están en **`database/CREDENCIALES.txt`** (viene en el repositorio y el instalador lo usa para generar `backend/.env`).

> Son credenciales **de ejemplo**, iguales para todas las instalaciones. **Cámbialas** antes de usar datos reales.

Para cambiar una contraseña:

- **Desde la aplicación:** cada usuario puede cambiar la suya, y el Gerente restablece las de los demás en **Gerencia → Gestión de usuarios**.
- **Desde la base de datos** (por ejemplo, si olvidaste la del Gerente):
  1. Genera el hash (desde la carpeta `backend`, después de `npm install`):
     ```
     node --input-type=module -e "import b from 'bcryptjs'; console.log(b.hashSync(process.argv[1], 12))" "TuNuevaClave"
     ```
  2. Entra a MySQL como administrador (en Windows la contraseña de root está en `database\runtime\root-password.txt`):
     ```
     $env:MYSQL_PWD = (Get-Content database\runtime\root-password.txt -Raw).Trim()
     database\runtime\mysql\bin\mysql.exe -u root --protocol=tcp --port=3307 biolab
     ```
  3. Guarda el hash:
     ```
     UPDATE USUARIO SET contrasena_hash = 'PEGA_AQUÍ_EL_HASH' WHERE nombre_usuario = 'gerente01';
     ```

## Módulos y requisitos que cubren

| Módulo | Pantallas | Requisitos |
|---|---|---|
| **Recepción** | Pacientes (consulta, edición y cancelación), Citas (registro con folio y abono), Cobros (saldo y ticket), WhatsApp, Mensajes | RF-01, RF-03, RF-07, RF-09, RF-13 a RF-16 |
| **Laboratorio** | Recepción de muestras, Registro de incidencias, Captura de resultados (con rangos de referencia y PDF externo), Validación médica, Mensajes | RF-02, RF-04, RF-11, RF-12, RF-17, RF-18 |
| **Gerencia** | Gestión de usuarios (con sueldos y nómina), Catálogo de estudios, Bitácora, Corte de caja, Estadísticas globales, Mensajes | RF-05, RF-06, RF-19, RF-20, RF-21 |

RF-01 a RF-15 son los de la especificación E2.2; RF-16 a RF-21 se agregaron en U2-E2; las ampliaciones (nómina, mensajería, cola de WhatsApp, estado del paciente y catálogo ampliado) se proponen como RF-22 a RF-26. La trazabilidad completa está en el documento U3-E2.

Reglas que hace cumplir la base de datos (no solo la pantalla): la bitácora no se modifica ni se borra (RF-06), nada se elimina físicamente (RN-02), el informe clínico no lleva precios (RN-01), el paciente no se edita después de validar sus resultados (RN-03) y no se entregan resultados con saldo pendiente (RN-05).

## Estructura

```
biolab/
├── INSTALAR-WINDOWS.bat   INICIAR-WINDOWS.bat
├── INSTALAR-DEBIAN.sh     INICIAR-DEBIAN.sh
├── README.md   LEEME.md
├── docs/       documentos de la Unidad 2 (arquitectura 4+1 y modelo de datos)
├── frontend/   página web (React + Vite + Tailwind)
│   └── src/
│       ├── pages/         login/, reception/, laboratory/, management/
│       ├── components/    layout/ (Shell), ui/ (tarjetas, formularios, modal), chat/
│       ├── services/      api, sesión, notificaciones, chat, actualización automática
│       ├── utils/         validaciones, formato, impresión, rangos de referencia
│       └── styles/        tema y colores
├── backend/    API (Node + Express + MySQL)
│   ├── src/auth/          JWT, roles y permisos
│   ├── src/config/        lee y valida backend/.env
│   ├── src/database/      db.ts: pools de mysql2 (uno por rol), withConnection y withTransaction
│   ├── src/middleware/    errores y límite de intentos
│   ├── src/routes/        auth, reception, laboratory, management, messages, health
│   ├── src/services/      nómina y envío de WhatsApp
│   ├── src/scripts/       cargar-catalogo y verificar-permisos
│   └── tests/             pruebas automáticas
├── database/   schema/ (SQL numerado 01 a 05), seeds/ (catálogo), PERMISOS.md, CREDENCIALES.txt, docker-compose.yml
└── scripts/    lo que ejecutan los instaladores (windows/ y debian/)
```

## Base de datos

MySQL 8.4 con 17 tablas: las 13 del diseño U2 (`USUARIO`, `PACIENTE`, `ESTUDIO`, `PARAMETRO_ESTUDIO`, `ORDEN`, `DETALLE_ORDEN`, `MUESTRA`, `INCIDENCIA_MUESTRA`, `RESULTADO`, `VALOR_RESULTADO`, `PAGO`, `NOTIFICACION`, `BITACORA`) y 4 de la versión 2 (`SUELDO_USUARIO`, `PAGO_NOMINA`, `MENSAJE`, `WHATSAPP_COLA`).

| Script | Contenido |
|---|---|
| `schema/01_esquema.sql` | tablas, claves y restricciones |
| `schema/02_logica.sql` | triggers, procedimientos, vistas y evento de recordatorios |
| `schema/03_roles_permisos.sql` | cuentas y privilegios por rol (ver `database/PERMISOS.md`) |
| `schema/04_usuarios_iniciales.sql` | los tres usuarios de la aplicación |
| `schema/05_mejoras.sql` | nómina, mensajería, cola de WhatsApp, rangos de referencia (se ejecuta una sola vez) |
| `seeds/05_catalogo_ejemplo.sql`, `seeds/06_catalogo_ampliado.sql` | 32 estudios de ejemplo con parámetros y rangos (los carga `npm run cargar-catalogo`) |

Cada rol se conecta con su propia cuenta de MySQL de mínimo privilegio: ningún rol tiene `DELETE`, `DROP` ni `ALTER`.

## Configuración (`backend/.env`)

El archivo `backend/.env` **no se sube a GitHub**; el repositorio incluye `backend/.env.example` con los nombres de las variables. El backend lo carga con `dotenv` desde `backend/src/config/config.ts` y, si falta alguna variable, no arranca y dice cuál.

- Conexión: `DB_HOST`, `DB_PORT`, `DB_NAME`; una cuenta de MySQL por rol (`DB_GERENTE_*`, `DB_RECEPCION_*`, `DB_QUIMICO_*`) y `JWT_SECRET`.
- WhatsApp: `WHATSAPP_PROVIDER=manual` (por defecto, el recepcionista envía con un clic desde WhatsApp Web, sin internet en el servidor) o `cloudapi` (envío automático con Meta; requiere internet y token).
- Para generarlo: `cd backend` y `npm run crear-env` (usa `-- --force --puerto=3307` para regenerarlo). Toma las cuentas de `database/CREDENCIALES.txt` (o, si no existe, de `database/schema/03_roles_permisos.sql`).

## Demostración técnica (aplicación ↔ base de datos)

1. Inicia sesión como `recepcion01`.
2. En **Citas**, registra un paciente de prueba con un estudio y un abono; aparece el folio `LMT-AAAAMMDD-001` y el ticket.
3. Con `quimico01`: **Recepción de muestras** → recibir; **Captura de resultados** → capturar; **Validación médica** → validar. Recepción recibe la notificación.
4. Con `gerente01`: **Bitácora** muestra cada movimiento con usuario, módulo, paciente y folio.
5. Comprueba en la base de datos (terminal de MySQL del apartado anterior):
   ```
   SELECT id_paciente, nombre_completo, telefono FROM PACIENTE ORDER BY id_paciente DESC LIMIT 3;
   SELECT id_orden, folio, estado FROM ORDEN ORDER BY id_orden DESC LIMIT 3;
   SELECT id_bitacora, accion, detalle, fecha_hora FROM BITACORA ORDER BY id_bitacora DESC LIMIT 10;
   ```
6. La conexión está en `backend/src/database/db.ts`; las operaciones, en `backend/src/routes/` (`reception.ts`, `laboratory.ts`, `management.ts`).

## Opciones avanzadas

- Reinstalar la base de datos desde cero (**borra los datos**): `INSTALAR-WINDOWS.bat -ReinstalarBd` · `bash INSTALAR-DEBIAN.sh --reinstalar-bd`
- Ya tengo Node y MySQL: `INSTALAR-WINDOWS.bat -SoloApp` · `bash INSTALAR-DEBIAN.sh --solo-app`
- Instalación manual con un MySQL 8 propio: ejecuta en orden los scripts de `database/schema/` (una sola vez cada uno; `05_mejoras.sql` no se puede repetir), y luego `cd backend` → `npm install`, `npm run crear-env`, `npm run cargar-catalogo`, `npm run dev`; en otra terminal `cd frontend` → `npm install`, `npm run dev`.
- Usar Docker para la base de datos: ver `database/README.md`.
- Pruebas: `cd backend` → `npm test`. Permisos de la base de datos: `npm run verificar`.

## Pendientes conocidos

- **RF-08:** la impresión de etiquetas autoadhesivas para los tubos no está implementada (la muestra sí se registra).
- **RF-02:** la alerta a recepción es un contador rojo en la campana de notificaciones; no parpadea.
- **RF-01 y RF-03:** el envío por WhatsApp es manual (enlace `wa.me`). El modo `cloudapi` existe, pero no se probó y exige internet.
- RNF-03 (tiempos de carga) y RNF-05 (disponibilidad) no se midieron. Las pruebas automáticas cubren solo el backend.
- Los rangos de referencia del catálogo son genéricos para adultos; deben ajustarse al método de cada laboratorio.

## Problemas frecuentes

- **`ECONNREFUSED` al iniciar sesión:** el backend no está encendido. Revisa la ventana `BioLab-Backend` o ejecuta `cd backend` y `npm run dev`.
- **«Faltan variables en backend/.env»:** `cd backend` y `npm run crear-env -- --force`.
- **El instalador pide la contraseña de root de un MySQL:** ya hay un servidor en el puerto 3307; ciérralo o reinicia el equipo y vuelve a ejecutarlo.
- **MySQL no arranca:** revisa la ventana minimizada de `mysqld`.

## Seguridad

No subas `backend/.env` ni `database/runtime/` (el `.gitignore` ya los excluye). `database/CREDENCIALES.txt` contiene cuentas de ejemplo: cámbialas antes de usar datos reales. Los datos de demostración deben ser ficticios.
