# Cria o repositório PÚBLICO no GitHub, envia o código e publica a primeira versão.
# Requer o GitHub CLI (gh). Instale com:  winget install GitHub.cli
param([Parameter(Mandatory = $true)][string]$Owner, [string]$Repo = 'cine-downloader')
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw 'GitHub CLI não encontrado. Rode: winget install GitHub.cli' }
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git não encontrado. Rode: winget install Git.Git' }
gh auth status 2>$null
if ($LASTEXITCODE -ne 0) { gh auth login }

# aponta o auto update para este repositório
$vj = Get-Content version.json -Raw | ConvertFrom-Json
$vj.repo = "$Owner/$Repo"
($vj | ConvertTo-Json) | Set-Content version.json -Encoding UTF8
$ver = $vj.version

if (-not (Test-Path .git)) { git init -b main }
git add -A
git commit -m "Cine Downloader v$ver" 2>$null
gh repo create "$Owner/$Repo" --public --source . --remote origin --push `
  --description 'Cine Downloader (by Becine Tools): baixa vídeos de redes sociais e importa direto no Premiere Pro'
git tag "v$ver"
git push origin "v$ver"
Write-Host "`nPronto! https://github.com/$Owner/$Repo  (o Release v$ver será gerado pelo GitHub Actions em ~1 minuto)" -ForegroundColor Green
