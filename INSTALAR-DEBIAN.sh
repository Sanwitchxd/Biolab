#!/usr/bin/env bash
# BioLab - INSTALACIÓN en Debian / Ubuntu (instala Node.js, MySQL y todo lo necesario).
#   Uso:  bash INSTALAR-DEBIAN.sh
exec bash "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/scripts/debian/instalar.sh" "$@"
