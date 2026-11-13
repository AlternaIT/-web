# Alterna — publica esta web en el servidor Ubuntu (https://srv.tailbbc6ef.ts.net/)
# Uso, en PowerShell dentro de esta carpeta:
#     powershell -ExecutionPolicy Bypass -File .\publicar.ps1
# La primera vez pide la clave de publicación (Panel del servidor > Web de Alterna) y la guarda
# en tu usuario de Windows (no en el proyecto). No necesita GitHub ni commits.
param(
    [string]$Servidor = "https://srv.tailbbc6ef.ts.net",
    [switch]$CambiarClave
)
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$raiz = $PSScriptRoot
$archivoClave = Join-Path $env:USERPROFILE ".alterna-publicar"

if ($CambiarClave -or -not (Test-Path $archivoClave)) {
    $nueva = Read-Host "Pega la clave de publicación (Panel del servidor > Web de Alterna)"
    if (-not $nueva.Trim()) { Write-Host "No se escribió ninguna clave." -ForegroundColor Red; exit 1 }
    Set-Content -Path $archivoClave -Value $nueva.Trim() -Encoding Ascii -NoNewline
}
$clave = (Get-Content $archivoClave -Raw).Trim()

# Copia limpia de la web: sin .git, funciones de Supabase, notas ni este script
$tmp = Join-Path $env:TEMP ("alterna-web-" + [guid]::NewGuid().ToString("N"))
$zip = "$tmp.zip"
try {
    Write-Host "Preparando la web..." -ForegroundColor Cyan
    robocopy $raiz $tmp /E /XD .git .github .claude .vscode supabase node_modules /XF publicar.ps1 *.md .gitignore .gitattributes /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "No se pudieron copiar los archivos (robocopy $LASTEXITCODE)." }
    if (-not (Test-Path (Join-Path $tmp "index.html"))) { throw "No se encontró index.html en $raiz" }

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::CreateFromDirectory($tmp, $zip)
    $mb = [math]::Round((Get-Item $zip).Length / 1MB, 2)

    Write-Host "Subiendo $mb MB a $Servidor ..." -ForegroundColor Cyan
    try {
        $r = Invoke-WebRequest -Uri "$Servidor/api/web/publicar" -Method Post -InFile $zip `
            -ContentType "application/zip" -Headers @{ "X-Alterna-Clave" = $clave } -UseBasicParsing -TimeoutSec 600
        $d = $r.Content | ConvertFrom-Json
        Write-Host ""
        Write-Host "  Listo: web publicada ($($d.files) archivos)." -ForegroundColor Green
        Write-Host "  $Servidor/" -ForegroundColor Green
        Write-Host "  Recarga la página con Ctrl+F5 para ver los cambios."
    } catch {
        $msg = $_.Exception.Message
        $resp = $_.Exception.Response
        if ($resp) {
            try {
                $txt = (New-Object IO.StreamReader($resp.GetResponseStream())).ReadToEnd()
                $msg = ($txt | ConvertFrom-Json).error
            } catch { }
            if ([int]$resp.StatusCode -eq 401) {
                Remove-Item $archivoClave -ErrorAction SilentlyContinue
                $msg += " Vuelve a ejecutar el script y pega la clave correcta."
            }
        }
        Write-Host "No se pudo publicar: $msg" -ForegroundColor Red
        exit 1
    }
} finally {
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $zip -Force -ErrorAction SilentlyContinue
}
