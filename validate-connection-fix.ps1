#!/usr/bin/env pwsh

# Script de Validação: net::ERR_CONNECTION_REFUSED - HML
# Propósito: Verificar se a correção do .env.local foi aplicada corretamente
# Uso: .\validate-connection-fix.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$GREEN = "`e[32m"
$RED = "`e[31m"
$YELLOW = "`e[33m"
$RESET = "`e[0m"

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "🔍 VALIDAÇÃO: Correção ERR_CONNECTION_REFUSED" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

function Write-Check {
    param([string]$Message)
    Write-Host "${GREEN}✓${RESET} $Message" -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "${RED}✗${RESET} $Message" -ForegroundColor Red
}

function Write-Warning-Custom {
    param([string]$Message)
    Write-Host "${YELLOW}⚠${RESET} $Message" -ForegroundColor Yellow
}

# ========== CHECK 1: .env.local ==========
Write-Host ""
Write-Host "📋 CHECK 1: Verificar .env.local" -ForegroundColor Cyan
Write-Host "================================"

if (-not (Test-Path ".env.local")) {
    Write-Error-Custom ".env.local não encontrado"
    exit 1
}

$envContent = Get-Content -Path ".env.local" -Raw

if ($envContent -match "^VITE_API_URL=http://127\.0\.0\.1:3001") {
    Write-Error-Custom "VITE_API_URL=http://127.0.0.1:3001 ainda está ativo em .env.local"
    Write-Host "  Ação: Remova ou comente esta linha"
    exit 1
}
elseif ($envContent -match "^# VITE_API_URL=http://127\.0\.0\.1:3001") {
    Write-Check "VITE_API_URL comentado corretamente em .env.local"
}
else {
    Write-Check "VITE_API_URL não está definido em .env.local (OK)"
}

# ========== CHECK 2: src/lib/api.ts ==========
Write-Host ""
Write-Host "📋 CHECK 2: Verificar detecção de HML em api.ts" -ForegroundColor Cyan
Write-Host "==============================================="

if (-not (Test-Path "src/lib/api.ts")) {
    Write-Error-Custom "src/lib/api.ts não encontrado"
    exit 1
}

$apiContent = Get-Content -Path "src/lib/api.ts" -Raw

if ($apiContent -match 'HML_FRONTEND_HOSTS.*hml\.app\.j12sports\.com\.br') {
    Write-Check "Hostname HML configurado em api.ts"
}
else {
    Write-Error-Custom "Hostname HML não encontrado em api.ts"
    exit 1
}

if ($apiContent -match 'DEFAULT_HML_BROWSER_API_URL.*=.*"/__api"') {
    Write-Check "URL padrão HML é /__api"
}
else {
    Write-Error-Custom "URL padrão HML não é /__api"
    exit 1
}

# ========== CHECK 3: scripts/serve-ssr.mjs ==========
Write-Host ""
Write-Host "📋 CHECK 3: Verificar proxy SSR" -ForegroundColor Cyan
Write-Host "==============================="

if (-not (Test-Path "scripts/serve-ssr.mjs")) {
    Write-Error-Custom "scripts/serve-ssr.mjs não encontrado"
    exit 1
}

$ssrContent = Get-Content -Path "scripts/serve-ssr.mjs" -Raw

if ($ssrContent -match '__api') {
    Write-Check "SSR intercepta requisições /__api"
}
else {
    Write-Error-Custom "SSR não intercepta /__api"
    exit 1
}

if ($ssrContent -match 'http://127\.0\.0\.1:3001') {
    Write-Check "API target padrão está correto (127.0.0.1:3001)"
}
else {
    Write-Error-Custom "API target não está correto"
    exit 1
}

# ========== CHECK 4: ecosystem.config.cjs ==========
Write-Host ""
Write-Host "📋 CHECK 4: Verificar config PM2" -ForegroundColor Cyan
Write-Host "================================"

if (-not (Test-Path "ecosystem.config.cjs")) {
    Write-Error-Custom "ecosystem.config.cjs não encontrado"
    exit 1
}

$pmContent = Get-Content -Path "ecosystem.config.cjs" -Raw

if ($pmContent -match 'VITE_API_URL.*"/api"') {
    Write-Check "PM2 configura VITE_API_URL=/api"
}
else {
    Write-Warning-Custom "PM2 pode não estar configurando VITE_API_URL"
}

# ========== CHECK 5: Nginx Config ==========
Write-Host ""
Write-Host "📋 CHECK 5: Verificar config Nginx" -ForegroundColor Cyan
Write-Host "=================================="

if (-not (Test-Path "deploy/nginx/hml.app.j12sports.com.br.conf")) {
    Write-Error-Custom "Nginx config não encontrado"
    exit 1
}

$nginxContent = Get-Content -Path "deploy/nginx/hml.app.j12sports.com.br.conf" -Raw

if ($nginxContent -match "location /api/") {
    Write-Check "Nginx tem rota /api"
}
else {
    Write-Error-Custom "Nginx não tem rota /api"
    exit 1
}

if ($nginxContent -match "127\.0\.0\.1:4173") {
    Write-Check "Nginx proxifica / para SSR (4173)"
}
else {
    Write-Error-Custom "Nginx não proxifica para SSR"
    exit 1
}

# ========== RESUMO ==========
Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "✅ TODAS AS VERIFICAÇÕES PASSARAM!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""

Write-Host "Próximos passos:" -ForegroundColor Yellow
Write-Host "1. npm run build        # Reconstruir frontend"
Write-Host "2. pm2 restart j12-*    # Reiniciar processos"
Write-Host "3. pm2 logs j12-*       # Verificar logs"
Write-Host "4. Acessar via browser: https://hml.app.j12sports.com.br"
Write-Host ""

Write-Host "Testar no console do navegador:" -ForegroundColor Yellow
Write-Host "  fetch('/__api/public/modalidades').then(r => r.json()).then(console.log)"
Write-Host ""

Write-Host "Esperado: ✓ Resposta com dados (sem ERR_CONNECTION_REFUSED)" -ForegroundColor Green
Write-Host ""
