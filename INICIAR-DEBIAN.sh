#!/usr/bin/env bash
# BioLab - INICIAR el sistema en Debian / Ubuntu.
#   Uso:  bash INICIAR-DEBIAN.sh
exec bash "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/scripts/debian/iniciar.sh" "$@"
