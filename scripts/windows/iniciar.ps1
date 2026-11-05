# BioLab - arranca base de datos, API y pagina web en Windows.
# Uso: doble clic en INICIAR-WINDOWS.bat
param([int]$PuertoDb = 3307)

$ErrorActionPreference = "Continue"
$Raiz      = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$DbDir     = Join-Path $Raiz "database\runtime"
$MySqlHome = Join-Path $DbDir "mysql"
$IniFile   = Join-Path $DbDir "my.ini"

function Puerto-Abierto([int]$puerto) {
  $c = New-Object System.Net.Sockets.TcpClient
  try {
    $r = $c.BeginConnect("127.0.0.1", $puerto, $null, $null)
    if ($r.AsyncWaitHandle.WaitOne(700) -and $c.Connected) { return $true }
    return $false
  } catch { return $false } finally { $c.Close() }
}

try {
  if (-not (Test-Path (Join-Path $Raiz "backend\.env")) -or -not (Test-Path (Join-Path $Raiz "backend\node_modules")) -or -not (Test-Path (Join-Path $Raiz "frontend\node_modules"))) {
    throw "Falta instalar el proyecto. Ejecuta primero INSTALAR-WINDOWS.bat"
  }
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "No se encuentra Node.js. Ejecuta INSTALAR-WINDOWS.bat" }

  Write-Host "[1/3] Base de datos..." -ForegroundColor Cyan
  $mysqld = Join-Path $MySqlHome "bin\mysqld.exe"
  if (Puerto-Abierto $PuertoDb) {
    Write-Host "      MySQL ya esta en marcha (puerto $PuertoDb)."
  }
  elseif (Test-Path $mysqld) {
    Start-Process -FilePath $mysqld -ArgumentList "--defaults-file=`"$IniFile`" --console" -WindowStyle Minimized
    for ($i = 0; $i -lt 90 -and -not (Puerto-Abierto $PuertoDb); $i++) { Start-Sleep -Seconds 1 }
    if (-not (Puerto-Abierto $PuertoDb)) { throw "MySQL no arranco. Revisa la ventana minimizada de mysqld." }
    Write-Host "      MySQL iniciado (ventana minimizada: no la cierres mientras uses BioLab)."
  }
  else {
    throw "No hay MySQL en el puerto $PuertoDb. Inicia tu servicio MySQL o ejecuta INSTALAR-WINDOWS.bat"
  }

  Write-Host "[2/3] API (backend)..." -ForegroundColor Cyan
  Start-Process -FilePath "cmd.exe" -WorkingDirectory (Join-Path $Raiz "backend") -ArgumentList "/k title BioLab-Backend && npm run dev"

  Write-Host "[3/3] Pagina web (frontend)..." -ForegroundColor Cyan
  Start-Process -FilePath "cmd.exe" -WorkingDirectory (Join-Path $Raiz "frontend") -ArgumentList "/k title BioLab-Frontend && npm run dev"

  for ($i = 0; $i -lt 60 -and -not (Puerto-Abierto 8443); $i++) { Start-Sleep -Seconds 1 }
  Start-Process "http://localhost:8443"

  Write-Host ""
  Write-Host "BioLab esta corriendo en http://localhost:8443" -ForegroundColor Green
  Write-Host "Para detenerlo, cierra las ventanas BioLab-Backend, BioLab-Frontend y la de MySQL (minimizada)."
  exit 0
}
catch {
  Write-Host ""
  Write-Host ("ERROR: " + $_.Exception.Message) -ForegroundColor Red
  exit 1
}
