@echo off
REM Instala las dependencias de BioLab. Ejecutar dentro de la carpeta del proyecto.
where pnpm >nul 2>nul
if %errorlevel%==0 (call pnpm install) else (call npm install)
echo Listo. Inicia el proyecto con: npm run dev
pause
