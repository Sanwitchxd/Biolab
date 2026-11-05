#!/usr/bin/env bash
# =====================================================================
# BioLab - instalación completa en Debian / Ubuntu
#   Instala (si faltan): Node.js 22, MySQL 8.4, dependencias del backend y
#   del frontend; crea la base de datos, el archivo backend/.env y carga el
#   catálogo de estudios de ejemplo.
#
#   Uso (desde la carpeta del proyecto):   bash INSTALAR-DEBIAN.sh
#   Opciones:
#     --solo-app        no toca el sistema (Node/MySQL ya instalados); solo
#                       base de datos + dependencias del proyecto
#     --reinstalar-bd   BORRA la base 'biolab' y la crea de nuevo
# =====================================================================
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOLO_APP=0
REINSTALAR_BD=0
for arg in "$@"; do
  case "$arg" in
    --solo-app) SOLO_APP=1 ;;
    --reinstalar-bd) REINSTALAR_BD=1 ;;
    -h|--help) sed -n '2,13p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Opción desconocida: $arg (usa --help)"; exit 1 ;;
  esac
done

n=0
paso()  { n=$((n+1)); printf '\n\033[1;34m[%s] %s\033[0m\n' "$n" "$*"; }
ok()    { printf '    \033[32m✔\033[0m %s\n' "$*"; }
aviso() { printf '    \033[33m!\033[0m %s\n' "$*"; }
falla() { printf '\n\033[1;31m✘ %s\033[0m\n' "$*" >&2; exit 1; }

# ---- Permisos: los paquetes del sistema se instalan con sudo; el proyecto, con TU usuario ----
if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
  APP_USER="${SUDO_USER:-root}"
else
  command -v sudo >/dev/null 2>&1 || falla "Se necesita 'sudo' (o ejecuta este script como root)."
  SUDO="sudo"
  APP_USER="$(id -un)"
fi
como_usuario() {
  if [ "$(id -u)" -eq 0 ] && [ "$APP_USER" != "root" ]; then sudo -u "$APP_USER" -H "$@"; else "$@"; fi
}
apt_instalar() { $SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y "$@"; }

# npm ci (exacto según package-lock.json); si el lock no coincide, cae a npm install
npm_dependencias() {
  if [ -f package-lock.json ] && como_usuario npm ci --no-audit --no-fund; then return 0; fi
  [ -f package-lock.json ] && aviso "npm ci no pudo; reintentando con npm install"
  como_usuario npm install --no-audit --no-fund
}

node_valido() {
  command -v node >/dev/null 2>&1 || return 1
  local v major minor
  v="$(node -p 'process.versions.node')"; major="${v%%.*}"; minor="${v#*.}"; minor="${minor%%.*}"
  # Vite 8 exige Node 20.19+ o 22.12+
  [ "$major" -ge 23 ] || { [ "$major" -eq 22 ] && [ "$minor" -ge 12 ]; } || { [ "$major" -eq 20 ] && [ "$minor" -ge 19 ]; }
}

PUERTO_DB=3306

if [ "$SOLO_APP" -eq 0 ]; then
  # ------------------------------------------------------------------
  paso "Comprobando el sistema"
  [ -r /etc/os-release ] || falla "No se pudo identificar la distribución."
  # shellcheck disable=SC1091
  . /etc/os-release
  case "${ID:-} ${ID_LIKE:-}" in
    *debian*|*ubuntu*) ok "${PRETTY_NAME:-$ID}" ;;
    *) falla "Este instalador es para Debian/Ubuntu (se detectó: ${PRETTY_NAME:-desconocido})." ;;
  esac
  command -v apt-get >/dev/null 2>&1 || falla "No se encontró apt-get."

  # ------------------------------------------------------------------
  paso "Instalando herramientas base"
  $SUDO apt-get update -y
  apt_instalar ca-certificates curl gnupg lsb-release
  ok "curl, gnupg, certificados"

  # ------------------------------------------------------------------
  paso "Node.js"
  if node_valido; then
    ok "Node $(node -v) ya instalado"
  else
    aviso "Instalando Node.js 22 LTS (repositorio oficial NodeSource)"
    if [ -n "$SUDO" ]; then curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    else curl -fsSL https://deb.nodesource.com/setup_22.x | bash -; fi
    apt_instalar nodejs
    node_valido || falla "No se pudo instalar una versión de Node compatible (se necesita 20.19+ o 22.12+)."
    ok "Node $(node -v) instalado"
  fi

  # ------------------------------------------------------------------
  paso "MySQL 8"
  if dpkg -s mariadb-server >/dev/null 2>&1 || { command -v mysql >/dev/null 2>&1 && mysql --version 2>/dev/null | grep -qi mariadb; }; then
    falla "Hay MariaDB instalada y BioLab necesita MySQL 8 (roles, CHECK y triggers). Desinstálala (sudo apt remove mariadb-server) o usa Docker: ver database/README.md"
  fi
  if dpkg -s mysql-community-server >/dev/null 2>&1 || dpkg -s mysql-server >/dev/null 2>&1; then
    ok "MySQL ya instalado"
  else
    instalar_mysql_oracle() {
      local tmp; tmp="$(mktemp -d)"
      curl -fsSL https://repo.mysql.com/mysql-apt-config.deb -o "$tmp/mysql-apt-config.deb" || return 1
      echo "mysql-apt-config mysql-apt-config/select-server select mysql-8.4-lts" | $SUDO debconf-set-selections
      $SUDO env DEBIAN_FRONTEND=noninteractive dpkg -i "$tmp/mysql-apt-config.deb" || return 1
      $SUDO apt-get update -y || return 1
      # contraseña de root vacía -> root entra solo con sudo (auth_socket); no queda ninguna contraseña débil
      echo "mysql-community-server mysql-community-server/root-pass password" | $SUDO debconf-set-selections
      echo "mysql-community-server mysql-community-server/re-root-pass password" | $SUDO debconf-set-selections
      apt_instalar mysql-server
    }
    aviso "Instalando MySQL 8.4 LTS (repositorio oficial de Oracle)"
    if ! instalar_mysql_oracle; then
      if [ "${ID:-}" = "ubuntu" ]; then
        aviso "El repositorio de Oracle falló; se usa el mysql-server de Ubuntu"
        apt_instalar mysql-server
      else
        falla "No se pudo instalar MySQL desde repo.mysql.com. Revisa tu conexión a internet."
      fi
    fi
    ok "MySQL instalado"
  fi

  # Misma configuración que el contenedor Docker del proyecto: zona horaria de México,
  # eventos activos (recordatorios), utf8mb4 y solo accesible desde este equipo.
  $SUDO mkdir -p /etc/mysql/conf.d
  $SUDO tee /etc/mysql/conf.d/biolab.cnf >/dev/null <<'EOF'
[mysqld]
bind-address=127.0.0.1
default-time-zone='-06:00'
event_scheduler=ON
character-set-server=utf8mb4
collation-server=utf8mb4_0900_ai_ci
EOF
  $SUDO systemctl enable mysql >/dev/null 2>&1 || true
  $SUDO systemctl restart mysql || falla "MySQL no arrancó. Revisa: sudo journalctl -u mysql -n 50"
  for _ in $(seq 1 30); do $SUDO mysqladmin --silent ping >/dev/null 2>&1 && break; sleep 1; done
  $SUDO mysqladmin --silent ping >/dev/null 2>&1 || falla "MySQL no responde."
  ok "Servicio MySQL activo ($(mysqld --version 2>/dev/null | grep -oE 'Ver [0-9.]+' || echo 'versión desconocida'))"
fi

# ----------------------------------------------------------------------
paso "Base de datos 'biolab'"
command -v mysql >/dev/null 2>&1 || falla "No se encontró el cliente 'mysql'."
MYSQL_ROOT=()
if $SUDO mysql -e "SELECT 1" >/dev/null 2>&1; then
  MYSQL_ROOT=($SUDO mysql)
else
  aviso "Este MySQL ya tenía contraseña de root."
  read -rsp "    Contraseña de root de MySQL: " MYSQL_PWD </dev/tty; echo
  export MYSQL_PWD
  mysql -u root -e "SELECT 1" >/dev/null 2>&1 || falla "Contraseña de root incorrecta."
  MYSQL_ROOT=(mysql -u root)
fi
PUERTO_DB="$("${MYSQL_ROOT[@]}" -N -B -e 'SELECT @@port')"
db_existe() { [ "$("${MYSQL_ROOT[@]}" -N -B -e "SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='biolab'")" = "1" ]; }

if db_existe && [ "$REINSTALAR_BD" -eq 1 ]; then
  printf '    \033[1;31mSe BORRARÁN todos los datos de la base biolab.\033[0m Escribe BORRAR para continuar: '
  read -r respuesta </dev/tty
  [ "$respuesta" = "BORRAR" ] || falla "Cancelado; no se borró nada."
  "${MYSQL_ROOT[@]}" -e "DROP DATABASE biolab"
fi
if db_existe; then
  ok "La base 'biolab' ya existe: sus datos no se tocan (usa --reinstalar-bd para empezar de cero)"
  # Actualización de una base de una versión anterior: aplica 05_mejoras.sql solo si falta (no borra datos)
  if [ "$("${MYSQL_ROOT[@]}" -N -B -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='biolab' AND TABLE_NAME='MENSAJE'")" = "0" ]; then
    "${MYSQL_ROOT[@]}" --default-character-set=utf8mb4 < "$RAIZ/database/schema/05_mejoras.sql" || falla "Error aplicando 05_mejoras.sql (tus datos no se borraron)"
    ok "05_mejoras.sql aplicado (nómina, mensajería, WhatsApp y valores de referencia)"
  else
    ok "La base ya tiene las mejoras más recientes"
  fi
else
  for f in "$RAIZ"/database/schema/*.sql; do
    "${MYSQL_ROOT[@]}" --default-character-set=utf8mb4 < "$f" || falla "Error ejecutando $(basename "$f")"
    ok "$(basename "$f")"
  done
fi

# ----------------------------------------------------------------------
paso "Backend (API)"
cd "$RAIZ/backend"
npm_dependencias
if [ -f .env ]; then
  ok "backend/.env ya existe: se conserva"
  actual="$(grep -E '^DB_PORT=' .env | cut -d= -f2 | tr -d '"' || true)"
  [ "$actual" = "$PUERTO_DB" ] || aviso "backend/.env usa el puerto ${actual:-?} pero MySQL escucha en $PUERTO_DB. Corrige con: cd backend && npm run crear-env -- --force --puerto=$PUERTO_DB"
else
  como_usuario npm run crear-env -- "--puerto=$PUERTO_DB"
fi
como_usuario npm run cargar-catalogo || aviso "No se pudo cargar el catálogo de ejemplo (puedes hacerlo luego: cd backend && npm run cargar-catalogo)"

# ----------------------------------------------------------------------
paso "Frontend (página web)"
cd "$RAIZ/frontend"
npm_dependencias

# ----------------------------------------------------------------------
paso "Verificación de permisos de la base de datos"
cd "$RAIZ/backend"
if como_usuario npm run --silent verificar >/dev/null 2>&1; then
  ok "Cada rol solo puede lo que le corresponde"
else
  aviso "La verificación reportó diferencias. Detalle: cd backend && npm run verificar"
fi

printf '\n\033[1;32m✔ Instalación terminada.\033[0m\n'
echo "  Iniciar el sistema:   bash INICIAR-DEBIAN.sh"
echo "  Abrir en el navegador: http://localhost:8443"
echo "  Usuarios y contraseñas: database/CREDENCIALES.txt (cámbialas antes de usar datos reales)"
