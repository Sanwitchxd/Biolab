# BioLab

Sistema web para laboratorio clínico: **Recepción**, **Laboratorio** y **Gerencia**.

## Instalar en una computadora nueva (un solo paso)

Copia esta carpeta completa a la otra computadora y ejecuta **un** archivo. Instala Node.js, el gestor de base de datos (MySQL 8.4), las dependencias, crea la base de datos y la configuración.

| Sistema | Instalar | Iniciar |
|---|---|---|
| **Windows 10/11** | doble clic en **`INSTALAR-WINDOWS.bat`** | doble clic en **`INICIAR-WINDOWS.bat`** |
| **Debian / Ubuntu** | `bash INSTALAR-DEBIAN.sh` | `bash INICIAR-DEBIAN.sh` |

Después abre **http://localhost:8443** e inicia sesión con las cuentas de `database/CREDENCIALES.txt`.

Necesitas internet durante la instalación (descarga unos 400 MB). En Windows se usa `winget` (incluido en Windows 10/11 actualizados); en Debian/Ubuntu hace falta `sudo`.
La instalación se puede repetir sin riesgo: no vuelve a crear ni borra una base de datos existente.

## Estructura

```
biolab/
├── INSTALAR-WINDOWS.bat   INICIAR-WINDOWS.bat
├── INSTALAR-DEBIAN.sh     INICIAR-DEBIAN.sh
├── LEEME.md
├── frontend/   página web (React + Vite + Tailwind)
│   └── src/
│       ├── styles/        tema y colores (index.css)  ← aquí se cambia la apariencia
│       ├── services/      conexión con el backend (api, sesión, notificaciones)
│       ├── components/    layout/ (Shell) y ui/ (tarjetas, formularios, modal)
│       ├── utils/         formato de fechas/moneda, impresión
│       └── pages/         login/  reception/  laboratory/  management/
├── backend/    API (Node + Express + MySQL): config, database, auth, middleware, routes
├── database/   schema/ (SQL), seeds/, credenciales, permisos, docker-compose
└── scripts/    lo que ejecutan los instaladores (windows/ y debian/)
```

## Apariencia
Los tres roles comparten el mismo estilo. Los colores base están en `frontend/src/styles/index.css`
y las tarjetas de inicio de cada módulo son un único componente: `frontend/src/components/ui/ModuleCard.tsx`.

## Opciones avanzadas
- Reinstalar la base de datos desde cero (**borra los datos**): `INSTALAR-WINDOWS.bat -ReinstalarBd` · `bash INSTALAR-DEBIAN.sh --reinstalar-bd`
- Ya tengo Node y MySQL: `INSTALAR-WINDOWS.bat -SoloApp` · `bash INSTALAR-DEBIAN.sh --solo-app`
- Usar Docker para la base de datos: ver `database/README.md`.
- API, endpoints y roles: `backend/README.md` · permisos de la base: `database/PERMISOS.md`.

## Seguridad
Cambia las contraseñas de `database/CREDENCIALES.txt` antes de usar datos reales. No subas ese archivo ni los `.env` a un repositorio.

## Novedades de esta versión

* **Actualizar una instalación existente:** copia esta carpeta encima de la anterior (conserva `backend/.env`) y vuelve a ejecutar
  `INSTALAR-WINDOWS.bat` / `INSTALAR-DEBIAN.sh`. Detecta que falta `database/schema/05_mejoras.sql`, lo aplica **sin borrar datos** y
  carga el catálogo ampliado (32 estudios con valores de referencia). Haz un respaldo de la base antes, por prudencia.
* **Gerencia → Gestión de usuarios:** en el detalle de cada empleado se define su sueldo y periodicidad, y se ve el próximo pago,
  el último pago, si se le debe algo y se registra cada pago.
* **Mensajes:** chat interno entre gerente, recepcionista y químico (aparece un contador de no leídos).
* **Recepción → Pacientes:** columna de estado (cita programada / en proceso / en espera de resultados / entregado), «Debe $X» o «Pagado»,
  datos bloqueados tras validar resultados y botón de WhatsApp.
* **Recepción → Nueva cita:** atajos «Ahora / Mañana», varios servicios y, si el paciente acepta WhatsApp, preparación, recordatorio
  (hora a elegir) y aviso de resultados.
* **WhatsApp:** por defecto es **manual** (el sistema deja el mensaje listo y se abre WhatsApp Web con un clic; no necesita internet del
  servidor). Para envío automático use `WHATSAPP_PROVIDER=cloudapi` con token de Meta (ver `backend/.env.example`); eso **sí requiere
  internet** y Meta limita el texto libre a 24 h desde el último mensaje del paciente.
* **Laboratorio:** lista de muestras activas en incidencias, captura con opciones/rangos por estudio y semáforo alto/bajo.

## Cambios de la revisión de validaciones y catálogo

* **Gerencia → Catálogo de estudios (nuevo):** alta y edición de estudios (clave, nombre, precio, externo, activo) y de sus parámetros
  (unidad, rango de referencia, opciones). Con búsqueda y filtros por tipo (Sangre, Orina, Heces, Otros, Externo).
* **Recepción → Nueva cita:** el teléfono ya es opcional; solo admite números (máx. 10). La opción de WhatsApp aparece solo si hay un teléfono
  completo. Los estudios se buscan por nombre/clave y se filtran por tipo. Validación de nombre, horario, fecha y abono (también en el servidor).
* **Recepción → Pacientes:** mismas reglas al editar (teléfono opcional, sin WhatsApp si no hay teléfono).
* **Gerencia → Usuarios y sueldos:** validación de nombre, usuario único, contraseña (8+ con letras y números) y montos.
* **Actualización automática:** los tres perfiles se refrescan solos cada 8–12 s (y al volver a la pestaña); ya no hace falta recargar.
* No se cambió la base de datos: no hay que reinstalarla. Solo reinicia el backend y el frontend.
