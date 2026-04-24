#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${DOMAIN:-api.j12sports.com.br}"
APP_DIR="${APP_DIR:-/var/www/j12-sports-hub-main}"
SERVICE_NAME="${SERVICE_NAME:-j12-api}"
EMAIL="${EMAIL:-}"

if [[ ! -d "$APP_DIR" ]]; then
  echo "Diretorio da aplicacao nao encontrado: $APP_DIR"
  echo "Defina APP_DIR corretamente antes de rodar o script."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node nao encontrado. Instale Node 24+ antes de continuar."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm nao encontrado. Instale Node 24+ antes de continuar."
  exit 1
fi

echo "==> Instalando pacotes base do servidor"
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx

echo "==> Instalando dependencias do projeto"
cd "$APP_DIR"
npm install

if [[ ! -f ".env.api.production" ]]; then
  echo "==> Criando .env.api.production a partir do modelo"
  cp .env.api.production.example .env.api.production
fi

mkdir -p logs

if ! command -v pm2 >/dev/null 2>&1; then
  echo "==> Instalando PM2"
  sudo npm install -g pm2
fi

echo "==> Subindo API no PM2"
pm2 start ecosystem.config.cjs --only "$SERVICE_NAME" --update-env
pm2 save

echo "==> Configurando Nginx"
sudo cp "deploy/nginx/$DOMAIN.conf" "/etc/nginx/sites-available/$DOMAIN.conf"
sudo ln -sfn "/etc/nginx/sites-available/$DOMAIN.conf" "/etc/nginx/sites-enabled/$DOMAIN.conf"
sudo nginx -t
sudo systemctl reload nginx

if [[ -n "$EMAIL" ]]; then
  echo "==> Emitindo certificado SSL com Certbot"
  sudo certbot --nginx --non-interactive --agree-tos -m "$EMAIL" -d "$DOMAIN"
else
  echo "==> Certificado SSL pendente"
  echo "Rode manualmente:"
  echo "sudo certbot --nginx -d $DOMAIN"
fi

echo "==> Publicacao da API concluida"
echo "Verifique:"
echo "1. pm2 status"
echo "2. curl https://$DOMAIN/health"
echo "3. acesso do frontend em https://app.j12sports.com.br"
