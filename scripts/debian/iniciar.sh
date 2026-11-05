#!/usr/bin/env bash
# BioLab - arranca base de datos, API y página web en Debian / Ubuntu.
# Uso:  bash INICIAR-DEBIAN.sh        (Ctrl+C para detener)
set -euo pipefail
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

[ -f "$RAIZ/backend/.env" ] && [ -d "$RAIZ/backend/node_modules" ] && [ -d "$RAIZ/frontend/node_modules" ] \
  || { echo "Falta instalar el proyecto. Ejecuta primero:  bash INSTALAR-DEBIAN.sh"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Falta Node.js. Ejecuta:  bash INSTALAR-DEBIAN.sh"; exit 1; }

# Base de datos (servicio del sistema)
if command -v systemctl >/dev/null 2>&1 && ! systemctl is-active --quiet mysql 2>/dev/null; then
  echo "[1/3] Iniciando MySQL..."
  if [ "$(id -u)" -eq 0 ]; then systemctl start mysql; else sudo systemctl start mysql; fi
else
  echo "[1/3] MySQL activo."
fi

echo "[2/3] Iniciando la API (backend)..."
cd "$RAIZ/backend"
setsid npm run dev &
BACK=$!
cleanup() { kill -- "-$BACK" 2>/dev/null || kill "$BACK" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

echo "[3/3] Iniciando la página web (frontend). Abre http://localhost:8443"
echo "      Para detener todo: Ctrl+C"
cd "$RAIZ/frontend"
npm run dev
