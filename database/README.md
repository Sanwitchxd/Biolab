# BioLab – Base de datos (MySQL 8.x)

```
database/
├── schema/                 se ejecutan en orden (01 → 04)
│   ├── 01_esquema.sql        13 tablas, PK, FK, UNIQUE y CHECK
│   ├── 02_logica.sql         funciones, procedimientos, triggers, vistas y evento
│   ├── 03_roles_permisos.sql 3 roles MySQL, 3 cuentas y permisos mínimos
│   └── 04_usuarios_iniciales.sql  usuarios de la aplicación (bcrypt) + 1ª entrada de bitácora
├── seeds/05_catalogo_ejemplo.sql  estudios de ejemplo (los carga `npm run cargar-catalogo`)
├── CREDENCIALES.txt        usuarios y contraseñas (BD y aplicación)  ← confidencial
├── PERMISOS.md             matriz de permisos y protección de la bitácora
├── docker-compose.yml      alternativa: MySQL en Docker
└── runtime/                (solo Windows) MySQL portable y sus datos; lo crea el instalador
```

**Requisito:** MySQL **8.0 o 8.4 LTS**. *MariaDB no es compatible*.

## Instalación (recomendada)
Desde la carpeta raíz del proyecto, el instalador se encarga de todo (instala MySQL si falta y ejecuta `schema/`):

| Sistema | Comando |
|---|---|
| Windows 10/11 | doble clic en `INSTALAR-WINDOWS.bat` (MySQL portable, puerto **3307**) |
| Debian / Ubuntu | `bash INSTALAR-DEBIAN.sh` (MySQL 8.4 del repositorio oficial, puerto **3306**) |

Si la base `biolab` ya existe, no la toca. Para empezar de cero (borra los datos): `INSTALAR-WINDOWS.bat -ReinstalarBd` / `bash INSTALAR-DEBIAN.sh --reinstalar-bd`.

## Alternativa: Docker (igual en Windows y Linux)
```bash
cd database
docker compose up -d          # los scripts de schema/ se ejecutan solo en el primer arranque
docker logs biolab-mysql      # esperar "ready for connections" (~30 s)
cd ../backend && npm run crear-env -- --puerto=3306
```
Reinstalar desde cero (borra los datos): `docker compose down -v && docker compose up -d`

## Instalación manual con un MySQL que ya tienes
Ejecuta los cuatro archivos de `schema/` en orden, con una cuenta administradora:
```bash
for f in schema/0[1-4]*.sql; do mysql -u root -p --default-character-set=utf8mb4 < "$f"; done
```
Después: `cd backend && npm run crear-env -- --puerto=<puerto de tu MySQL>`.

## Versión 2 (05_mejoras.sql y seeds/06)

Nómina, mensajería, cola de WhatsApp y rangos de referencia. Los instaladores lo aplican solos; con instalación manual ejecute
`schema/05_mejoras.sql` **una sola vez** tras 01–04 (no es repetible) y luego `cd backend && npm run cargar-catalogo`.

## Seguridad
- Cambia las contraseñas de `CREDENCIALES.txt` (y `database/.env` si usas Docker) antes de usar datos reales.
- No subas `CREDENCIALES.txt` ni `.env` a ningún repositorio (ya están en `.gitignore`).
- Las cuentas de aplicación se crean con host `'%'` (necesario para Docker); el servidor queda limitado a `127.0.0.1` por configuración.
