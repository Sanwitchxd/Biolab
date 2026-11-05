#!/usr/bin/env bash
# Instala las dependencias de BioLab. Ejecutar dentro de la carpeta del proyecto.
set -e
if command -v pnpm >/dev/null 2>&1; then
  pnpm install
else
  npm install
fi
echo "Listo. Inicia el proyecto con: npm run dev"
