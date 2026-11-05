@echo off
rem BioLab - INICIAR el sistema en Windows. Doble clic para ejecutar.
title BioLab - Iniciar
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\iniciar.ps1" %*
if errorlevel 1 pause
