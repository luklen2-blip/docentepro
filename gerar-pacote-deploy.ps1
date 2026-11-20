# Script de Geração de Pacote de Deploy Limpo na Área de Trabalho
$ErrorActionPreference = "Stop"

$projectDir = $PSScriptRoot
$desktopDir = [Environment]::GetFolderPath("Desktop")
$zipOutput = Join-Path $desktopDir "DOCENTEPRO_SAAS_DEPLOY.zip"
$tempStaging = Join-Path $env:TEMP "staging_docentepro_deploy"

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "📦 GERANDO PACOTE DE DEPLOY LIMPO DOCENTEPRO" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

# Remove arquivos temporários antigos
if (Test-Path $tempStaging) {
    Remove-Item -Path $tempStaging -Recurse -Force
}
if (Test-Path $zipOutput) {
    Remove-Item -Path $zipOutput -Force
}

New-Item -ItemType Directory -Path $tempStaging | Out-Null

# Lista de arquivos e pastas para incluir
$itemsToCopy = @(
    "package.json",
    "server.js",
    "db.js",
    "pix_utils.js",
    "banco_docentepro.json",
    "render.yaml",
    "Dockerfile",
    ".dockerignore",
    ".gitignore",
    "termos.html",
    "privacidade.html",
    "index.html",
    "README.md",
    "INICIAR_DOCENTEPRO.bat",
    "public",
    "tests"
)

foreach ($item in $itemsToCopy) {
    $src = Join-Path $projectDir $item
    if (Test-Path $src) {
        $dest = Join-Path $tempStaging $item
        Copy-Item -Path $src -Destination $dest -Recurse -Force
        Write-Host "  [+] Incluído: $item" -ForegroundColor Green
    }
}

# Compactação em ZIP
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($tempStaging, $zipOutput)

# Limpeza
Remove-Item -Path $tempStaging -Recurse -Force

Write-Host "`n🎉 Pacote gerado com sucesso!" -ForegroundColor Yellow
Write-Host "📍 Localização: $zipOutput" -ForegroundColor White
Write-Host "Pronto para upload no Render, Railway ou GitHub!`n" -ForegroundColor Green
