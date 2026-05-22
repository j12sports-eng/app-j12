# Script para iniciar Backend e Frontend (Windows PowerShell)

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  🚀 J12 SPORTS HUB - INICIALIZADOR DE AMBIENTE             ║" -ForegroundColor Cyan
Write-Host "║  Conexão MySQL Corrigida para HostGator                   ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Verificar se Node.js está instalado
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "⚠️  Node.js não encontrado. Por favor, instale Node.js." -ForegroundColor Yellow
    exit 1
}

Write-Host "ℹ️  Versão do Node.js: $(node --version)" -ForegroundColor Blue
Write-Host "ℹ️  Versão do npm: $(npm --version)" -ForegroundColor Blue
Write-Host ""

# Função para iniciar o backend
function Start-Backend {
    Write-Host "▶ Iniciando Backend (Node.js + Express)..." -ForegroundColor Green
    Push-Location backend
    
    # Instalar dependências se necessário
    if (-not (Test-Path node_modules)) {
        Write-Host "📦 Instalando dependências..." -ForegroundColor Blue
        npm install
    }
    
    Write-Host ""
    Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  Backend iniciando na porta 3001" -ForegroundColor Cyan
    Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    
    npm run dev
    Pop-Location
}

# Função para iniciar o frontend
function Start-Frontend {
    Write-Host "▶ Iniciando Frontend (React + Vite)..." -ForegroundColor Green
    
    # Instalar dependências se necessário
    if (-not (Test-Path node_modules)) {
        Write-Host "📦 Instalando dependências..." -ForegroundColor Blue
        npm install
    }
    
    Write-Host ""
    Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  Frontend iniciando na porta 5173" -ForegroundColor Cyan
    Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    
    npm run dev
}

# Função para verificar status
function CheckConnectionStatus {
    Write-Host "🔍 Verificando status da conexão..." -ForegroundColor Blue
    Write-Host ""
    
    $healthResponse = $null
    try {
        $healthResponse = Invoke-RestMethod -Uri "http://localhost:3001/health" -Method Get -ErrorAction Stop
        Write-Host "✓ Backend conectado" -ForegroundColor Green
        $healthResponse | ConvertTo-Json | Write-Host
        Write-Host ""
        
        $testResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/test" -Method Get -ErrorAction Stop
        Write-Host "✓ API respondendo" -ForegroundColor Green
        $testResponse | ConvertTo-Json | Write-Host
    } catch {
        Write-Host "⚠️  Backend não está respondendo" -ForegroundColor Yellow
        Write-Host "Por favor, inicie o backend primeiro"
        exit 1
    }
}

# Menu de seleção
Write-Host "Escolha o que deseja fazer:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1) Iniciar Backend (Port 3001)" -ForegroundColor Yellow
Write-Host "2) Iniciar Frontend (Port 5173)" -ForegroundColor Yellow
Write-Host "3) Iniciar Backend + Frontend (em paralelo)" -ForegroundColor Yellow
Write-Host "4) Verificar Status da Conexão" -ForegroundColor Yellow
Write-Host ""

$choice = Read-Host "Opção (1-4)"

switch ($choice) {
    "1" {
        Start-Backend
    }
    "2" {
        Start-Frontend
    }
    "3" {
        Write-Host "ℹ️  Iniciando Backend em terminal separado..." -ForegroundColor Blue
        Start-Process powershell -ArgumentList "-NoProfile", "-Command", "cd '$pwd'; Start-Backend"
        Start-Sleep -Seconds 3
        Write-Host ""
        Write-Host "ℹ️  Iniciando Frontend..." -ForegroundColor Blue
        Start-Frontend
    }
    "4" {
        CheckConnectionStatus
    }
    default {
        Write-Host "⚠️  Opção inválida" -ForegroundColor Yellow
        exit 1
    }
}
