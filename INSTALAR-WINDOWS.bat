@echo off
rem BioLab - INSTALACION en Windows 10/11 (instala Node.js, MySQL y todo lo necesario).
rem Doble clic para ejecutar. Opciones extra: INSTALAR-WINDOWS.bat -SoloApp   o   -ReinstalarBd
title BioLab - Instalacion
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\instalar.ps1" %*
set RESULTADO=%errorlevel%
echo.
if not "%RESULTADO%"=="0" echo La instalacion NO termino. Lee el mensaje de error de arriba.
pause
exit /b %RESULTADO%
