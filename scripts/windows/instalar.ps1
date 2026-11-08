# =====================================================================
# BioLab - instalacion completa en Windows 10/11
#   Instala (si faltan): Node.js LTS y MySQL 8.4 (version portable, dentro de
#   la carpeta database\runtime, sin servicios ni Docker), las dependencias
#   del proyecto, crea la base de datos y el archivo backend\.env.
#
#   Uso: doble clic en INSTALAR-WINDOWS.bat
#   Opciones (desde PowerShell):
#     -SoloApp         no instala Node ni MySQL (ya los tienes)
#     -ReinstalarBd    BORRA la base 'biolab' y la crea de nuevo
#     -PuertoDb 3307   puerto de MySQL (por defecto 3307, para no chocar con un 3306 existente)
#     -MySqlZipUrl URL descarga MySQL desde esta direccion (zip "winx64" de MySQL 8.4)
# =====================================================================
param(
  [int]$PuertoDb = 3307,
  [switch]$SoloApp,
  [switch]$ReinstalarBd,
  [string]$MySqlZipUrl = ""
)

$ErrorActionPreference = "Continue"   # los errores se revisan a mano ($LASTEXITCODE / throw)
$ProgressPreference = "SilentlyContinue"
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch { }

$Raiz      = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$DbDir     = Join-Path $Raiz "database\runtime"
$MySqlHome = Join-Path $DbDir "mysql"
$DataDir   = Join-Path $DbDir "data"
$IniFile   = Join-Path $DbDir "my.ini"
$PwdFile   = Join-Path $DbDir "root-password.txt"
$script:Paso = 0
$script:MysqlExe = $null
$script:RootPwd = ""

function Paso($t)  { $script:Paso++; Write-Host ""; Write-Host ("[{0}] {1}" -f $script:Paso, $t) -ForegroundColor Cyan }
function Ok($t)    { Write-Host ("    OK  " + $t) -ForegroundColor Green }
function Aviso($t) { Write-Host ("    !   " + $t) -ForegroundColor Yellow }
function Falla($t) { throw $t }

function Actualizar-Path {
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
}

function Node-Valido {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { return $false }
  $v = $null
  try { $v = [version](& node -p "process.versions.node") } catch { return $false }
  # Vite 8 exige Node 20.19+ o 22.12+
  return (($v.Major -ge 23) -or ($v.Major -eq 22 -and $v.Minor -ge 12) -or ($v.Major -eq 20 -and $v.Minor -ge 19))
}

function Puerto-Abierto([int]$puerto) {
  $c = New-Object System.Net.Sockets.TcpClient
  try {
    $r = $c.BeginConnect("127.0.0.1", $puerto, $null, $null)
    if ($r.AsyncWaitHandle.WaitOne(700) -and $c.Connected) { return $true }
    return $false
  } catch { return $false } finally { $c.Close() }
}

function Nueva-Clave {
  $chars = (48..57) + (65..90) + (97..122)
  -join (1..24 | ForEach-Object { [char]($chars | Get-Random) })
}

# Ejecuta un programa y devuelve su codigo de salida (sin que PowerShell trate stderr como error)
function Ejecutar([string]$exe, [string]$argumentos) {
  $p = Start-Process -FilePath $exe -ArgumentList $argumentos -Wait -PassThru -NoNewWindow
  return $p.ExitCode
}

# mysql.exe con un archivo .sql como entrada (el "<" lo resuelve cmd)
function Mysql-Archivo([string]$archivo) {
  $linea = '/c ""' + $script:MysqlExe + '" -u root --protocol=tcp --port=' + $PuertoDb + ' --default-character-set=utf8mb4 < "' + $archivo + '""'
  $env:MYSQL_PWD = $script:RootPwd
  try { return (Ejecutar "cmd.exe" $linea) } finally { Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue }
}

function Mysql-Consulta([string]$sql) {
  $env:MYSQL_PWD = $script:RootPwd
  try {
    $r = & $script:MysqlExe "-u" "root" "--protocol=tcp" "--port=$PuertoDb" "-N" "-B" "-e" $sql 2>$null
    return (($r | Out-String).Trim())
  } finally { Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue }
}

function Npm([string]$carpeta, [string[]]$argumentos) {
  Push-Location $carpeta
  try {
    & npm.cmd @argumentos
    if ($LASTEXITCODE -ne 0) { Falla ("Fallo 'npm " + ($argumentos -join " ") + "' en " + $carpeta) }
  } finally { Pop-Location }
}

# npm ci (exacto segun package-lock.json); si el lock no coincide, cae a npm install
function Instalar-Dependencias([string]$carpeta) {
  if (Test-Path (Join-Path $carpeta "package-lock.json")) {
    try { Npm $carpeta @("ci", "--no-audit", "--no-fund"); return } catch { Aviso "npm ci no pudo; reintentando con npm install" }
  }
  Npm $carpeta @("install", "--no-audit", "--no-fund")
}

# Comprueba que una URL responde 200 sin descargar el archivo (se cierra al recibir los encabezados)
function Url-Existe([string]$url) {
  try {
    $req = [Net.HttpWebRequest]::Create($url)
    $req.Method = "GET"; $req.Timeout = 15000; $req.AllowAutoRedirect = $true
    $resp = $req.GetResponse()
    $ok = ([int]$resp.StatusCode -eq 200)
    $resp.Close()
    return $ok
  } catch { return $false }
}

function Descargar-MySql {
  $zip = Join-Path $env:TEMP "mysql-8.4-winx64-biolab.zip"
  $urls = @()
  if ($MySqlZipUrl) { $urls += $MySqlZipUrl }
  else {
    foreach ($n in 60..0) {
      $urls += "https://cdn.mysql.com/Downloads/MySQL-8.4/mysql-8.4.$n-winx64.zip"
      $urls += "https://cdn.mysql.com/archives/mysql-8.4/mysql-8.4.$n-winx64.zip"
    }
  }
  $elegida = $null
  foreach ($u in $urls) {
    if (Url-Existe $u) { $elegida = $u; break }
  }
  if (-not $elegida) { Falla "No pude encontrar el zip de MySQL 8.4. Descargalo de https://dev.mysql.com/downloads/mysql/ (ZIP Archive, Windows x64) y ejecuta: INSTALAR-WINDOWS.bat con -MySqlZipUrl 'ruta o URL'" }
  Aviso ("Descargando " + (Split-Path $elegida -Leaf) + " (unos 250 MB, puede tardar)...")
  Invoke-WebRequest -Uri $elegida -OutFile $zip -UseBasicParsing -ErrorAction Stop
  return $zip
}

function Instalar-MySqlPortable {
  New-Item -ItemType Directory -Force -Path $DbDir | Out-Null
  Aviso "Instalando el componente de Microsoft que MySQL necesita (Visual C++)..."
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    & winget install -e --id Microsoft.VCRedist.2015+.x64 --silent --accept-package-agreements --accept-source-agreements | Out-Null
  }
  $zip = Descargar-MySql
  $tmp = Join-Path $env:TEMP "mysql-biolab-extract"
  if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
  New-Item -ItemType Directory -Force -Path $tmp | Out-Null
  Aviso "Descomprimiendo..."
  if (Get-Command tar.exe -ErrorAction SilentlyContinue) { & tar.exe -xf $zip -C $tmp } else { Expand-Archive -Path $zip -DestinationPath $tmp -Force }
  $carpeta = Get-ChildItem $tmp -Directory | Where-Object { Test-Path (Join-Path $_.FullName "bin\mysqld.exe") } | Select-Object -First 1
  if (-not $carpeta) { Falla "El zip descargado no contiene bin\mysqld.exe." }
  if (Test-Path $MySqlHome) { Remove-Item -Recurse -Force $MySqlHome }
  Move-Item $carpeta.FullName $MySqlHome
  Remove-Item -Force $zip -ErrorAction SilentlyContinue
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue

  $b = $MySqlHome.Replace("\", "/"); $d = $DataDir.Replace("\", "/")
  $ini = @"
[mysqld]
basedir=$b
datadir=$d
port=$PuertoDb
bind-address=127.0.0.1
mysqlx=OFF
default-time-zone='-06:00'
event_scheduler=ON
character-set-server=utf8mb4
collation-server=utf8mb4_0900_ai_ci

[client]
port=$PuertoDb
default-character-set=utf8mb4
"@
  [IO.File]::WriteAllText($IniFile, $ini, (New-Object System.Text.UTF8Encoding($false)))

  Aviso "Inicializando la base de datos (primera vez)..."
  $code = Ejecutar (Join-Path $MySqlHome "bin\mysqld.exe") ("--defaults-file=`"$IniFile`" --initialize-insecure --console")
  if ($code -ne 0) { Falla "mysqld --initialize fallo (codigo $code). Si ya habia datos en database\runtime\data, borra esa carpeta y reintenta." }
}

function Iniciar-MySqlPortable {
  if (Puerto-Abierto $PuertoDb) { return }
  Start-Process -FilePath (Join-Path $MySqlHome "bin\mysqld.exe") -ArgumentList "--defaults-file=`"$IniFile`" --console" -WindowStyle Minimized
  for ($i = 0; $i -lt 90; $i++) { Start-Sleep -Seconds 1; if (Puerto-Abierto $PuertoDb) { return } }
  Falla "MySQL no arranco en 90 segundos. Revisa la ventana minimizada de mysqld para ver el error."
}

function Buscar-MysqlExe {
  $c = Get-Command mysql.exe -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  $f = Get-ChildItem "C:\Program Files\MySQL\MySQL Server *\bin\mysql.exe" -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
  if ($f) { return $f.FullName }
  return $null
}

try {
  Write-Host "=================================================" -ForegroundColor Cyan
  Write-Host "  BioLab - instalacion automatica para Windows" -ForegroundColor Cyan
  Write-Host "=================================================" -ForegroundColor Cyan

  if (-not $SoloApp) {
    # ---------------------------------------------------------------
    Paso "Node.js"
    if (Node-Valido) { Ok ("Node " + (& node -v) + " ya instalado") }
    else {
      if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        Falla "No se encontro 'winget'. Actualiza 'Instalador de aplicacion' desde Microsoft Store, o instala Node.js LTS a mano desde https://nodejs.org y vuelve a ejecutar."
      }
      Aviso "Instalando Node.js LTS con winget..."
      & winget install -e --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
      Actualizar-Path
      if (-not (Node-Valido)) {
        & winget upgrade -e --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
        Actualizar-Path
      }
      if (-not (Node-Valido)) { Falla "No se pudo dejar Node.js 20.19+ / 22.12+ listo. Cierra esta ventana, abre el instalador de nuevo; si persiste, instala Node.js LTS desde https://nodejs.org" }
      Ok ("Node " + (& node -v) + " instalado")
    }
  } else {
    if (-not (Node-Valido)) { Falla "Node.js 20.19+ / 22.12+ no esta instalado (quita -SoloApp para instalarlo)." }
  }

  # -----------------------------------------------------------------
  Paso "MySQL 8.4"
  $portable = Test-Path (Join-Path $MySqlHome "bin\mysqld.exe")
  if ($portable) {
    Iniciar-MySqlPortable
    $script:MysqlExe = Join-Path $MySqlHome "bin\mysql.exe"
    if (Test-Path $PwdFile) { $script:RootPwd = (Get-Content $PwdFile -Raw).Trim() }
    Ok "MySQL portable en marcha (puerto $PuertoDb)"
  }
  elseif (Puerto-Abierto $PuertoDb) {
    Aviso "Ya hay un servidor escuchando en el puerto ${PuertoDb}: se usara ese (debe ser MySQL 8.x)."
    $script:MysqlExe = Buscar-MysqlExe
    if (-not $script:MysqlExe) { Falla "Hay un servidor en el puerto $PuertoDb pero no encuentro mysql.exe. Agrega la carpeta bin de MySQL al PATH o usa -PuertoDb con otro puerto." }
    $sec = Read-Host "    Contrasena de root de ese MySQL (Enter si no tiene)" -AsSecureString
    $script:RootPwd = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
    if ((Mysql-Consulta "SELECT 1") -ne "1") { Falla "No se pudo entrar a MySQL como root con esa contrasena." }
    $ver = Mysql-Consulta "SELECT VERSION()"
    if ($ver -match "MariaDB") { Falla "Ese servidor es MariaDB; BioLab necesita MySQL 8." }
    Ok "Usando MySQL existente ($ver)"
  }
  else {
    if ($SoloApp) { Falla "No hay ningun MySQL en el puerto $PuertoDb (quita -SoloApp para instalar uno)." }
    Instalar-MySqlPortable
    Iniciar-MySqlPortable
    $script:MysqlExe = Join-Path $MySqlHome "bin\mysql.exe"
    # Se cambia la contrasena vacia de root por una aleatoria que queda guardada solo para este usuario de Windows
    $nueva = Nueva-Clave
    $code = Ejecutar $script:MysqlExe ("-u root --protocol=tcp --port=$PuertoDb -e `"ALTER USER 'root'@'localhost' IDENTIFIED BY '$nueva'`"")
    if ($code -ne 0) { Falla "No se pudo asegurar la cuenta root de MySQL." }
    [IO.File]::WriteAllText($PwdFile, $nueva, (New-Object System.Text.UTF8Encoding($false)))
    try { & icacls.exe $PwdFile /inheritance:r /grant:r ($env:USERNAME + ":(R,W)") | Out-Null } catch { }
    $script:RootPwd = $nueva
    Ok "MySQL portable instalado (puerto $PuertoDb). Clave de root guardada en database\runtime\root-password.txt"
  }

  # -----------------------------------------------------------------
  Paso "Base de datos 'biolab'"
  $consultaExiste = "SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='biolab'"
  $existe = ((Mysql-Consulta $consultaExiste) -eq "1")
  if ($existe -and $ReinstalarBd) {
    $r = Read-Host "    Se BORRARAN todos los datos de biolab. Escribe BORRAR para continuar"
    if ($r -cne "BORRAR") { Falla "Cancelado; no se borro nada." }
    Mysql-Consulta "DROP DATABASE biolab" | Out-Null
    $existe = $false
  }
  if ($existe) {
    Ok "La base 'biolab' ya existe: sus datos no se tocan (usa -ReinstalarBd para empezar de cero)"
    # Actualizacion de una base instalada con una version anterior: aplica 05_mejoras.sql solo si falta (no borra datos)
    $tieneMejoras = Mysql-Consulta "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='biolab' AND TABLE_NAME='MENSAJE'"
    if ($tieneMejoras -eq "0") {
      $code = Mysql-Archivo (Join-Path $Raiz "database\schema\05_mejoras.sql")
      if ($code -ne 0) { Falla "Error aplicando 05_mejoras.sql a la base existente. Tus datos no se borraron; revisa el mensaje de MySQL arriba." }
      Ok "05_mejoras.sql aplicado (nomina, mensajeria, WhatsApp y valores de referencia)"
    } else { Ok "La base ya tiene las mejoras mas recientes" }
  }
  else {
    foreach ($f in (Get-ChildItem (Join-Path $Raiz "database\schema") -Filter *.sql | Sort-Object Name)) {
      $code = Mysql-Archivo $f.FullName
      if ($code -ne 0) { Falla ("Error ejecutando " + $f.Name) }
      Ok $f.Name
    }
  }

  # -----------------------------------------------------------------
  Paso "Backend (API)"
  $back = Join-Path $Raiz "backend"
  Instalar-Dependencias $back
  $envFile = Join-Path $back ".env"
  if ((Test-Path $envFile) -and -not (Select-String -Path $envFile -Pattern "^JWT_SECRET=.+" -Quiet)) {
    Aviso "backend\.env existe pero esta incompleto: se vuelve a generar"
    Remove-Item $envFile -Force
  }
  if (Test-Path $envFile) {
    Ok "backend\.env ya existe: se conserva"
    $linea = Select-String -Path $envFile -Pattern "^DB_PORT=" | Select-Object -First 1
    if ($linea -and ($linea.Line -replace "DB_PORT=|`"", "").Trim() -ne "$PuertoDb") {
      Aviso ("backend\.env usa " + $linea.Line + " pero MySQL escucha en $PuertoDb. Corrige con: cd backend && npm run crear-env -- --force --puerto=$PuertoDb")
    }
  } else {
    Npm $back @("run", "crear-env", "--", "--puerto=$PuertoDb")
  }
  try { Npm $back @("run", "cargar-catalogo") } catch { Aviso "No se pudo cargar el catalogo de ejemplo (luego: cd backend && npm run cargar-catalogo)" }

  # -----------------------------------------------------------------
  Paso "Frontend (pagina web)"
  Instalar-Dependencias (Join-Path $Raiz "frontend")

  # -----------------------------------------------------------------
  Paso "Verificacion de permisos de la base de datos"
  try { Npm $back @("run", "--silent", "verificar"); Ok "Cada rol solo puede lo que le corresponde" }
  catch { Aviso "La verificacion reporto diferencias. Detalle: cd backend && npm run verificar" }

  Write-Host ""
  Write-Host "Instalacion terminada." -ForegroundColor Green
  Write-Host "  Iniciar el sistema:      doble clic en INICIAR-WINDOWS.bat"
  Write-Host "  Abrir en el navegador:   http://localhost:8443"
  Write-Host "  Usuarios y contrasenas:  database\CREDENCIALES.txt (cambialas antes de usar datos reales)"
  exit 0
}
catch {
  Write-Host ""
  Write-Host ("ERROR: " + $_.Exception.Message) -ForegroundColor Red
  exit 1
}
