# Cine Downloader — instalador automático (Windows)
# Baixa yt-dlp e ffmpeg, ativa o modo de depuração do CEP e instala a extensão para o Premiere.
param([switch]$Uninstall)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$src  = $PSScriptRoot
$dest = Join-Path $env:APPDATA 'Adobe\CEP\extensions\cine-downloader'
$bin  = Join-Path $src 'bin'

function Step($m) { Write-Host "`n==> $m" -ForegroundColor Magenta }

if (Get-Process -Name 'Adobe Premiere Pro' -ErrorAction SilentlyContinue) {
  Write-Host 'Feche o Premiere Pro antes de continuar (ele precisa reiniciar para carregar o painel).' -ForegroundColor Yellow
  Read-Host 'Pressione Enter depois de fechar'
}

if ($Uninstall) {
  Step 'Removendo a extensão'
  if (Test-Path $dest) { Remove-Item $dest -Recurse -Force; Write-Host 'Removido.' } else { Write-Host 'Nada instalado.' }
  return
}

Step 'Preparando a pasta bin'
New-Item -ItemType Directory -Force -Path $bin | Out-Null

# Reaproveita o ffmpeg de uma instalação anterior (evita baixar de novo)
$oldFfmpeg = Join-Path $dest 'bin\ffmpeg.exe'
if ((Test-Path $oldFfmpeg) -and -not (Test-Path (Join-Path $bin 'ffmpeg.exe'))) { Copy-Item $oldFfmpeg $bin -Force }
$oldDeno = Join-Path $dest 'bin\deno.exe'
if ((Test-Path $oldDeno) -and -not (Test-Path (Join-Path $bin 'deno.exe'))) { Copy-Item $oldDeno $bin -Force }

$ytdlp = Join-Path $bin 'yt-dlp.exe'
Step 'Baixando yt-dlp (última versão)'
Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile $ytdlp
Write-Host ('yt-dlp ' + (& $ytdlp --version))

$ffmpeg = Join-Path $bin 'ffmpeg.exe'
if (-not (Test-Path $ffmpeg)) {
  Step 'Baixando ffmpeg (pode levar alguns minutos)'
  $zip = Join-Path $env:TEMP 'cine-ffmpeg.zip'
  $tmp = Join-Path $env:TEMP 'cine-ffmpeg'
  Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip' -OutFile $zip
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  $found = Get-ChildItem -Path $tmp -Recurse -Filter 'ffmpeg.exe' | Select-Object -First 1
  Copy-Item $found.FullName $ffmpeg -Force
  Remove-Item $zip, $tmp -Recurse -Force
} else { Write-Host 'ffmpeg já presente, mantido.' }

$deno = Join-Path $bin 'deno.exe'
if (-not (Test-Path $deno)) {
  Step 'Baixando deno (runtime JavaScript exigido pelo yt-dlp para o YouTube)'
  $dz = Join-Path $env:TEMP 'cine-deno.zip'
  Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip' -OutFile $dz
  Expand-Archive -Path $dz -DestinationPath $bin -Force
  Remove-Item $dz -Force
} else { Write-Host 'deno já presente, mantido.' }

Step 'Ativando o modo de depuração do CEP (CSXS 9 a 12)'
foreach ($v in 9..12) {
  $key = "HKCU:\Software\Adobe\CSXS.$v"
  if (-not (Test-Path $key)) { New-Item -Path $key -Force | Out-Null }
  Set-ItemProperty -Path $key -Name 'PlayerDebugMode' -Value '1' -Type String
}

Step 'Instalando a extensão'
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Get-ChildItem -Path $src -Force | Where-Object { $_.Name -notin @('install.ps1','install.bat','uninstall.bat','.github','scripts','.git','.gitignore') } |
  ForEach-Object { Copy-Item $_.FullName -Destination $dest -Recurse -Force }

Write-Host "`nPronto! Abra o Premiere Pro: Janela > Extensões > Cine Downloader." -ForegroundColor Green
