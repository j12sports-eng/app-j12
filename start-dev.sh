#!/bin/bash
# Script para iniciar Backend e Frontend

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  🚀 J12 SPORTS HUB - INICIALIZADOR DE AMBIENTE             ║"
echo "║  Conexão MySQL Corrigida para HostGator                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}⚠️  Node.js não encontrado. Por favor, instale Node.js.${NC}"
    exit 1
fi

echo -e "${BLUE}ℹ️  Versão do Node.js:${NC} $(node --version)"
echo -e "${BLUE}ℹ️  Versão do npm:${NC} $(npm --version)"
echo ""

# Função para iniciar o backend
start_backend() {
    echo -e "${GREEN}▶ Iniciando Backend (Node.js + Express)...${NC}"
    cd backend
    
    # Instalar dependências se necessário
    if [ ! -d "node_modules" ]; then
        echo -e "${BLUE}📦 Instalando dependências...${NC}"
        npm install
    fi
    
    echo ""
    echo "════════════════════════════════════════════════════════════"
    echo "  Backend iniciando na porta 3001"
    echo "════════════════════════════════════════════════════════════"
    echo ""
    npm run dev
}

# Função para iniciar o frontend
start_frontend() {
    echo -e "${GREEN}▶ Iniciando Frontend (React + Vite)...${NC}"
    cd ..
    
    # Instalar dependências se necessário
    if [ ! -d "node_modules" ]; then
        echo -e "${BLUE}📦 Instalando dependências...${NC}"
        npm install
    fi
    
    echo ""
    echo "════════════════════════════════════════════════════════════"
    echo "  Frontend iniciando na porta 5173"
    echo "════════════════════════════════════════════════════════════"
    echo ""
    npm run dev
}

# Menu de seleção
echo "Escolha o que deseja fazer:"
echo ""
echo "1) Iniciar Backend (Port 3001)"
echo "2) Iniciar Frontend (Port 5173)"
echo "3) Iniciar Backend + Frontend (em paralelo)"
echo "4) Verificar Status da Conexão"
echo ""
read -p "Opção (1-4): " choice

case $choice in
    1)
        start_backend
        ;;
    2)
        start_frontend
        ;;
    3)
        echo -e "${BLUE}ℹ️  Iniciando Backend em terminal separado...${NC}"
        start_backend &
        sleep 3
        echo ""
        echo -e "${BLUE}ℹ️  Iniciando Frontend...${NC}"
        start_frontend
        ;;
    4)
        echo -e "${BLUE}🔍 Verificando status da conexão...${NC}"
        echo ""
        
        # Testar healthcheck
        response=$(curl -s http://localhost:3001/health)
        if [ -z "$response" ]; then
            echo -e "${YELLOW}⚠️  Backend não está respondendo${NC}"
            echo "Por favor, inicie o backend primeiro"
            exit 1
        fi
        
        echo -e "${GREEN}✓ Backend conectado${NC}"
        echo "$response" | jq '.'
        echo ""
        
        # Testar API
        response=$(curl -s http://localhost:3001/api/test)
        echo -e "${GREEN}✓ API respondendo${NC}"
        echo "$response" | jq '.'
        ;;
    *)
        echo -e "${YELLOW}⚠️  Opção inválida${NC}"
        exit 1
        ;;
esac
