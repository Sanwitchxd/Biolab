# BioLab - instalación en Windows (MySQL 8.x nativo ya instalado)
# Uso (PowerShell):  .\instalar_windows.ps1
#   Si PowerShell bloquea el script:  Set-ExecutionPolicy -Scope Process Bypass
param([string]$MySqlBin = "C:\Program Files\MySQL\MySQL Server 8.4\bin")

$mysql = Join-Path $MySqlBin "mysql.exe"
if (-not (Test-Path $mysql)) {
  $cmd = Get-Command mysql -ErrorAction SilentlyContinue
  if ($cmd) { $mysql = $cmd.Source } else { throw "No se encontró mysql.exe. Use -MySqlBin 'ruta\bin'" }
}
$sql = Join-Path $PSScriptRoot "biolab_completo.sql"
$sec = Read-Host "Contraseña de root de MySQL" -AsSecureString
$env:MYSQL_PWD = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
                 [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
try {
  cmd /c "`"$mysql`" -u root --default-character-set=utf8mb4 < `"$sql`""
  if ($LASTEXITCODE -eq 0) { Write-Host "BioLab instalada correctamente." -ForegroundColor Green }
  else { Write-Host "Error al instalar (código $LASTEXITCODE)." -ForegroundColor Red }
} finally { Remove-Item Env:MYSQL_PWD }
