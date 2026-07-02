#!/bin/bash

# Script de Validação: net::ERR_CONNECTION_REFUSED - HML
# Propósito: Verificar se a correção do .env.local foi aplicada corretamente
# Uso: bash validate-connection-fix.sh

set -e

echo "================================================"
echo "🔍 VALIDAÇÃO: Correção ERR_CONNECTION_REFUSED"
echo "================================================"
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para log
log_check() {
    echo -e "${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# ========== CHECK 1: .env.local ==========
echo ""
echo "📋 CHECK 1: Verificar .env.local"
echo "================================"

if [ ! -f .env.local ]; then
    log_error ".env.local não encontrado"
    exit 1
fi

if grep -q "^VITE_API_URL=http://127.0.0.1:3001" .env.local; then
    log_error "VITE_API_URL=http://127.0.0.1:3001 ainda está ativo em .env.local"
    echo "  Ação: Remova ou comente esta linha"
    exit 1
elif grep -q "^# VITE_API_URL=http://127.0.0.1:3001" .env.local; then
    log_check "VITE_API_URL comentado corretamente em .env.local"
else
    log_check "VITE_API_URL não está definido em .env.local (OK)"
fi

# ========== CHECK 2: src/lib/api.ts ==========
echo ""
echo "📋 CHECK 2: Verificar detecção de HML em api.ts"
echo "==============================================="

if [ ! -f src/lib/api.ts ]; then
    log_error "src/lib/api.ts não encontrado"
    exit 1
fi

if grep -q "const HML_FRONTEND_HOSTS = new Set.*hml.app.j12sports.com.br" src/lib/api.ts; then
    log_check "Hostname HML configurado em api.ts"
else
    log_error "Hostname HML não encontrado em api.ts"
    exit 1
fi

if grep -q "DEFAULT_HML_BROWSER_API_URL = \"/__api\"" src/lib/api.ts; then
    log_check "URL padrão HML é /__api"
else
    log_error "URL padrão HML não é /__api"
    exit 1
fi

# ========== CHECK 3: scripts/serve-ssr.mjs ==========
echo ""
echo "📋 CHECK 3: Verificar proxy SSR"
echo "==============================="

if [ ! -f scripts/serve-ssr.mjs ]; then
    log_error "scripts/serve-ssr.mjs não encontrado"
    exit 1
fi

if grep -q "url.pathname.startsWith.*/__api" scripts/serve-ssr.mjs; then
    log_check "SSR intercepta requisições /__api"
else
    log_error "SSR não intercepta /__api"
    exit 1
fi

if grep -q "DEFAULT_API_TARGET = \"http://127.0.0.1:3001\"" scripts/serve-ssr.mjs; then
    log_check "API target padrão está correto (127.0.0.1:3001)"
else
    log_error "API target não está correto"
    exit 1
fi

# ========== CHECK 4: ecosystem.config.cjs ==========
echo ""
echo "📋 CHECK 4: Verificar config PM2"
echo "================================"

if [ ! -f ecosystem.config.cjs ]; then
    log_error "ecosystem.config.cjs não encontrado"
    exit 1
fi

if grep -q "VITE_API_URL: \"/api\"" ecosystem.config.cjs; then
    log_check "PM2 configura VITE_API_URL=/api"
else
    log_warning "PM2 pode não estar configurando VITE_API_URL"
fi

# ========== CHECK 5: Nginx Config ==========
echo ""
echo "📋 CHECK 5: Verificar config Nginx"
echo "=================================="

if [ ! -f deploy/nginx/hml.app.j12sports.com.br.conf ]; then
    log_error "Nginx config não encontrado"
    exit 1
fi

if grep -q "location /api/" deploy/nginx/hml.app.j12sports.com.br.conf; then
    log_check "Nginx tem rota /api"
else
    log_error "Nginx não tem rota /api"
    exit 1
fi

if grep -q "proxy_pass http://127.0.0.1:4173" deploy/nginx/hml.app.j12sports.com.br.conf; then
    log_check "Nginx proxifica / para SSR (4173)"
else
    log_error "Nginx não proxifica para SSR"
    exit 1
fi

# ========== RESUMO ==========
echo ""
echo "================================================"
echo "✅ TODAS AS VERIFICAÇÕES PASSARAM!"
echo "================================================"
echo ""
echo "Próximos passos:"
echo "1. npm run build        # Reconstruir frontend"
echo "2. pm2 restart j12-*    # Reiniciar processos"
echo "3. pm2 logs j12-*       # Verificar logs"
echo "4. Acessar via browser: https://hml.app.j12sports.com.br"
echo ""
echo "Testar no console do navegador:"
echo "  fetch('/__api/public/modalidades').then(r => r.json()).then(console.log)"
echo ""
echo "Esperado: ✓ Resposta com dados (sem ERR_CONNECTION_REFUSED)"
echo ""
