#!/usr/bin/env bash
# BioLab - instalación en Debian/Ubuntu (MySQL 8.x ya instalado)
# Uso:  chmod +x instalar_debian.sh && ./instalar_debian.sh
set -euo pipefail
cd "$(dirname "$0")"

command -v mysql >/dev/null || { echo "No se encontró el cliente mysql. Vea README.md (sección Debian)."; exit 1; }
if mysql --version | grep -qi mariadb; then
  echo "Se detectó MariaDB. Estos scripts requieren MySQL 8.x (roles, CHECK y SET DEFAULT ROLE)."
  echo "Instale MySQL 8.4 desde el repositorio oficial o use Docker (README.md)."; exit 1
fi
read -rsp "Contraseña de root de MySQL: " PASS; echo
MYSQL_PWD="$PASS" mysql -u root --default-character-set=utf8mb4 < biolab_completo.sql
echo "BioLab instalada correctamente."
