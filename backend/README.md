# BioLab – Backend (API)

Node.js + Express + mysql2 + TypeScript. Conecta el frontend con MySQL respetando los roles de
`database/PERMISOS.md`. **Las reglas de negocio viven en MySQL** (triggers, procedimientos, CHECK);
el backend solo las invoca y traduce sus mensajes de rechazo.

## Cómo funciona la seguridad (doble protección)

1. `POST /api/auth/login` ejecuta `CALL sp_login_usuario`, compara con **bcrypt**, exige `estado = 'Activo'`
   y entrega un **JWT** firmado que lleva el `id` y el `rol`. Límite de intentos fallidos (por usuario y por IP).
2. Cada ruta pasa por `authenticate` (verifica el JWT y que la cuenta siga activa y con el mismo rol) y por
   `requireRole(...)`, que responde **403** si el rol no corresponde.
3. Hay **tres pools** (uno por cuenta de MySQL). Una petición usa **solo** el pool del rol del token, nunca algo que
   mande el cliente. Si una ruta intentara algo no permitido, **MySQL lo rechaza** y la API responde 403.
4. En cada conexión se ejecuta `SET @app_usuario_id = <id del token>` (y la zona horaria `-06:00`) y se limpia al liberarla.
5. Consultas siempre parametrizadas. Las contraseñas solo existen en `backend/.env`; no se escriben en código, logs ni frontend.

> El inicio de sesión del **Gerente** no se registra en la bitácora porque su cuenta de MySQL no tiene `EXECUTE`
> sobre `sp_registrar_bitacora` (ver PERMISOS.md). No se amplió ningún permiso.

## Configuración

Requisitos: Node.js 20 o superior y la base `biolab` ya instalada.
**Lo más fácil:** ejecuta `INSTALAR-WINDOWS.bat` o `bash INSTALAR-DEBIAN.sh` en la carpeta raíz; hacen todo esto por ti.

```powershell
cd backend
npm install
npm run crear-env      # crea backend/.env leyendo database/CREDENCIALES.txt (no muestra contraseñas)
```

`npm run crear-env` deja MySQL en `127.0.0.1:3307`. Si usas otro puerto o servidor, edita `DB_HOST` / `DB_PORT` en
`backend/.env`. También puedes copiar `.env.example` a `.env` y llenarlo a mano. Todo se configura **solo** con `.env`
(sirve igual en Windows, Docker y Debian; en Docker define las mismas variables como entorno y usa `HOST=0.0.0.0`).

| Variable | Para qué sirve |
|---|---|
| `HOST`, `PORT` | Dónde escucha la API (por defecto `127.0.0.1:3001`) |
| `CORS_ORIGIN` | Orígenes permitidos (con el proxy de Vite no se usa en desarrollo) |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_TIMEZONE`, `DB_POOL_LIMIT` | Conexión a MySQL |
| `DB_GERENTE_*`, `DB_RECEPCION_*`, `DB_QUIMICO_*` | Una cuenta de MySQL por rol |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Firma y duración de la sesión (8 h por defecto) |
| `LOGIN_MAX_ATTEMPTS`, `LOGIN_WINDOW_MINUTES` | Límite de intentos fallidos (5 en 15 min) |
| `TRUST_PROXY` | Solo si hay un proxy inverso delante |

## Arranque

```powershell
npm run dev        # desarrollo (se reinicia al guardar)
npm run build; npm start   # producción
```
Al arrancar muestra si cada una de las 3 cuentas de MySQL conecta. `GET http://localhost:3001/api/health` hace lo mismo.

## Pruebas

```powershell
npm test             # lógica propia (límite de intentos, traducción de errores, roles, configuración)
npm run verificar    # contra la BASE REAL: cada cuenta de MySQL solo puede lo que dice PERMISOS.md
npm run cargar-catalogo   # carga los estudios de ejemplo (database/seeds/05) con la cuenta del Gerente
```

## Endpoints

| Método y ruta | Rol que puede usarlo |
|---|---|
| `GET /api/health` | Público (solo indica si cada conexión responde) |
| `POST /api/auth/login` | Público (límite de intentos) |
| `GET /api/auth/me` | Cualquier usuario con sesión |
| `POST /api/auth/cambiar-contrasena` | Solo **Gerente** (recepción y químico no tienen UPDATE sobre `USUARIO`; el gerente se la restablece) |
| `GET /api/recepcion/datos` | **Recepcionista** (pacientes, órdenes, estudios, pagos y resultados liberados) |
| `GET /api/recepcion/estudios` | **Recepcionista** (catálogo con precio) |
| `POST /api/recepcion/citas` | **Recepcionista** (paciente + `sp_crear_orden` + estudios + muestra + abono, en una transacción) |
| `POST /api/recepcion/ordenes/:id/pagos` | **Recepcionista** |
| `POST /api/recepcion/ordenes/:id/entregar` | **Recepcionista** (MySQL exige saldo 0 y resultados liberados) |
| `PATCH /api/recepcion/pacientes/:id` | **Recepcionista** (editar nombre, teléfono y WhatsApp; nunca borrar) |
| `POST /api/recepcion/ordenes/:id/cancelar` | **Recepcionista** (motivo obligatorio) |
| `GET /api/recepcion/notificaciones` · `PATCH /api/recepcion/notificaciones/:id` | **Recepcionista** |
| `GET /api/laboratorio/estudios` | **Químico** (catálogo sin precio) |
| `GET /api/laboratorio/datos` | **Químico** (órdenes, muestras, estudios, parámetros, incidencias y resultados; sin precios ni pagos) |
| `POST /api/laboratorio/muestras/:id/recibir` · `/retomada` | **Químico** |
| `POST /api/laboratorio/incidencias` | **Químico** (tipos Hemolizada, Dañada, Otra; el trigger marca la muestra y avisa a Recepción) |
| `POST /api/laboratorio/resultados` | **Químico** (captura o corrige mientras esté Capturado; PDF externo opcional en base64, máx. 10 MB, se guarda en `backend/uploads/`) |
| `GET /api/laboratorio/resultados/:id/pdf` | **Químico** (reporte externo adjunto) |
| `POST /api/laboratorio/resultados/validar` | **Químico** (Capturado → Validado → Liberado; el trigger actualiza la orden y avisa a Recepción) |
| `GET /api/gerencia/usuarios` · `POST /api/gerencia/usuarios` | **Gerente** (lista con último inicio de sesión; alta con contraseña bcrypt) |
| `PATCH /api/gerencia/usuarios/:id/estado` | **Gerente** (Activo/Bloqueado; no puede bloquear su propia cuenta) |
| `POST /api/gerencia/usuarios/:id/contrasena` | **Gerente** (restablecer contraseña) |
| `GET /api/gerencia/bitacora` | **Gerente** (exclusivo, solo lectura; no existe ninguna ruta que la modifique) |
| `GET /api/gerencia/caja` · `GET /api/gerencia/estadisticas` | **Gerente** (pagos reales y estudios solicitados por día) |

### Diferencias entre la pantalla y la base (no se inventaron tablas)

- **Cierre de caja**: no existe tabla de cierres. El "corte" de cada día se calcula en vivo con los pagos (inmutables); se puede descargar el reporte en CSV, pero no se guarda un arqueo de efectivo. Para guardarlo haría falta una tabla nueva (`CORTE_CAJA`) y permisos: no se creó sin tu autorización.
- **Bitácora**: el inicio de sesión del Gerente no se registra (su cuenta no tiene `EXECUTE` sobre `sp_registrar_bitacora`).
- **Laboratorio**: la base no guarda rangos de referencia (no se marca alto/bajo), severidad de incidencias, tipo de muestra, observaciones ni institución del PDF externo. Hay una muestra por orden.
- **Usuarios**: no hay fecha de ingreso, horario ni calendario de pago; no se registra la salida de sesión.
- **Estadísticas**: no hay "área" de estudio; se muestran los estudios más solicitados. Los pagos no tienen estado de conciliación (todos cuentan como registrados).

Las rutas de las fases 3 y 4 (muestras, incidencias, resultados, usuarios, caja…) se agregarán aquí.

Errores: JSON `{ "error": "mensaje claro", "codigo": "..." }`. Códigos: 400 datos, 401 sin sesión o sesión inválida,
403 rol sin permiso (middleware o MySQL), 409 regla de negocio rechazada por MySQL (con su mensaje), 422 dato no válido,
429 demasiados intentos, 503 sin conexión a la base.

## Estructura del código (`src/`)

```
src/
├── server.ts, app.ts     arranque y armado de Express
├── config/               lectura y validación de backend/.env
├── database/             pools de MySQL (una cuenta por rol)
├── auth/                 JWT, login y control de roles
├── middleware/           manejo de errores y límite de intentos de login
├── routes/               endpoints: auth, recepción, laboratorio, gerencia, health
├── scripts/              cargar-catalogo, verificar-permisos
└── types/                ampliaciones de tipos de Express
```
