#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${DOMAIN:-app.j12sports.com.br}"
APP_DIR="${APP_DIR:-/var/www/app-j12}"
FRONTEND_PM2_NAME="${FRONTEND_PM2_NAME:-j12-frontend}"
FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${FRONTEND_PORT:-4173}"
API_TARGET="${API_TARGET:-http://127.0.0.1:3001}"
NGINX_CONF_PATH="${NGINX_CONF_PATH:-}"
PM2_CONFIG="${PM2_CONFIG:-}"

SUDO=()
if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  SUDO=(sudo)
fi

log() {
  echo
  echo "==> $*"
}

require_command() {
  local command_name="$1"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Comando obrigatorio nao encontrado: $command_name"
    exit 1
  fi
}

show_port_usage() {
  log "Verificando quem usa a porta $FRONTEND_PORT"

  if command -v lsof >/dev/null 2>&1; then
    "${SUDO[@]}" lsof -nP -iTCP:"$FRONTEND_PORT" -sTCP:LISTEN || true
  else
    echo "lsof nao encontrado; usando ss/fuser quando disponivel."
  fi

  if command -v ss >/dev/null 2>&1; then
    "${SUDO[@]}" ss -tulpn | grep -E "[:.]$FRONTEND_PORT\\b" || true
  fi
}

get_port_pids() {
  if command -v lsof >/dev/null 2>&1; then
    "${SUDO[@]}" lsof -tiTCP:"$FRONTEND_PORT" -sTCP:LISTEN 2>/dev/null | sort -u
    return 0
  fi

  if command -v fuser >/dev/null 2>&1; then
    "${SUDO[@]}" fuser "$FRONTEND_PORT/tcp" 2>/dev/null | tr ' ' '\n' | sed '/^$/d' | sort -u
    return 0
  fi
}

show_pid_details() {
  local pid="$1"

  echo "PID encontrado na porta $FRONTEND_PORT: $pid"
  ps -fp "$pid" || true
  ps aux | grep "$pid" | grep -v grep || true
}

kill_port_processes() {
  mapfile -t pids < <(get_port_pids || true)

  if [[ "${#pids[@]}" -eq 0 ]]; then
    echo "Nenhum processo encontrado na porta $FRONTEND_PORT."
    return 0
  fi

  for pid in "${pids[@]}"; do
    show_pid_details "$pid"
  done

  log "Encerrando processos presos na porta $FRONTEND_PORT"
  if command -v fuser >/dev/null 2>&1; then
    "${SUDO[@]}" fuser -k "$FRONTEND_PORT/tcp" || true
  else
    for pid in "${pids[@]}"; do
      "${SUDO[@]}" kill -TERM "$pid" || true
    done
  fi

  sleep 2
  mapfile -t pids < <(get_port_pids || true)

  if [[ "${#pids[@]}" -gt 0 ]]; then
    echo "Processos ainda ativos na porta $FRONTEND_PORT; aplicando kill -9."
    for pid in "${pids[@]}"; do
      show_pid_details "$pid"
      "${SUDO[@]}" kill -9 "$pid" || true
    done
  fi
}

confirm_port_free() {
  log "Confirmando que a porta $FRONTEND_PORT ficou livre"
  show_port_usage

  mapfile -t pids < <(get_port_pids || true)
  if [[ "${#pids[@]}" -gt 0 ]]; then
    echo "A porta $FRONTEND_PORT ainda esta ocupada."
    exit 1
  fi

  echo "Porta $FRONTEND_PORT livre."
}

locate_app_dir() {
  if [[ -f "$APP_DIR/package.json" ]]; then
    return 0
  fi

  log "Procurando frontend em /var/www"
  mapfile -t package_files < <(find /var/www -name package.json -not -path "*/node_modules/*" 2>/dev/null || true)

  if [[ "${#package_files[@]}" -eq 0 ]]; then
    echo "Nenhum package.json encontrado em /var/www."
    echo "Defina APP_DIR com a pasta correta do projeto."
    exit 1
  fi

  printf '%s\n' "${package_files[@]}"

  for package_file in "${package_files[@]}"; do
    local candidate_dir
    candidate_dir="$(dirname "$package_file")"

    if [[ -f "$candidate_dir/scripts/serve-ssr.mjs" ]] && grep -q '"start:frontend"\|"preview"' "$package_file"; then
      APP_DIR="$candidate_dir"
      echo "Frontend localizado em: $APP_DIR"
      return 0
    fi
  done

  echo "Nao foi possivel identificar automaticamente a pasta do frontend."
  echo "Defina APP_DIR com a pasta correta do projeto."
  exit 1
}

show_pm2_state() {
  log "Estado atual do PM2"
  pm2 list || true
  pm2 describe "$FRONTEND_PM2_NAME" || true
}

remove_frontend_pm2() {
  log "Removendo processo PM2 duplicado do frontend"
  pm2 stop "$FRONTEND_PM2_NAME" || true
  pm2 delete "$FRONTEND_PM2_NAME" || true
}

validate_build_outputs() {
  test -f "$APP_DIR/dist/server/server.mjs"
  test -d "$APP_DIR/dist/client"
}

test_frontend_manually() {
  local preview_log="/tmp/j12-frontend-preview-$FRONTEND_PORT.log"
  local preview_pid=""

  log "Testando frontend manualmente em http://$FRONTEND_HOST:$FRONTEND_PORT"
  rm -f "$preview_log"

  NODE_ENV=production API_TARGET="$API_TARGET" node scripts/serve-ssr.mjs --host "$FRONTEND_HOST" --port "$FRONTEND_PORT" >"$preview_log" 2>&1 &
  preview_pid="$!"

  sleep 5

  if ! kill -0 "$preview_pid" >/dev/null 2>&1; then
    echo "Frontend manual nao iniciou. Log:"
    cat "$preview_log" || true
    exit 1
  fi

  if ! curl --max-time 20 -fsS "http://$FRONTEND_HOST:$FRONTEND_PORT/" >/dev/null; then
    echo "Frontend manual iniciou, mas nao respondeu ao curl. Log:"
    cat "$preview_log" || true
    kill "$preview_pid" || true
    wait "$preview_pid" 2>/dev/null || true
    exit 1
  fi

  echo "Frontend respondeu localmente durante o teste manual."
  kill "$preview_pid" || true
  wait "$preview_pid" 2>/dev/null || true
  sleep 1
  confirm_port_free
}

detect_pm2_config() {
  if [[ -n "$PM2_CONFIG" ]]; then
    return 0
  fi

  if [[ -f "$APP_DIR/ecosystem.config.cjs" ]]; then
    PM2_CONFIG="$APP_DIR/ecosystem.config.cjs"
    return 0
  fi

  if [[ -f "$APP_DIR/ecosystem.config.js" ]]; then
    PM2_CONFIG="$APP_DIR/ecosystem.config.js"
    return 0
  fi
}

pm2_config_is_safe() {
  node - "$PM2_CONFIG" "$FRONTEND_PM2_NAME" "$FRONTEND_PORT" <<'NODE'
const configPath = process.argv[2];
const appName = process.argv[3];
const expectedPort = process.argv[4];
const config = require(configPath);
const app = config.apps?.find((item) => item.name === appName);

if (!app) process.exit(1);
if (app.instances !== 1) process.exit(2);
if (app.exec_mode && app.exec_mode !== "fork") process.exit(3);

const args = Array.isArray(app.args) ? app.args.join(" ") : String(app.args ?? "");
if (!args.includes(expectedPort)) process.exit(4);

process.exit(0);
NODE
}

start_frontend_pm2() {
  log "Verificando configuracao do PM2"
  detect_pm2_config || true

  if [[ -n "$PM2_CONFIG" && -f "$PM2_CONFIG" ]]; then
    cat "$PM2_CONFIG"

    if pm2_config_is_safe; then
      echo "ecosystem valido: uma instancia fork usando a porta $FRONTEND_PORT."
      NODE_ENV=production API_TARGET="$API_TARGET" pm2 start "$PM2_CONFIG" --only "$FRONTEND_PM2_NAME" --update-env
    else
      echo "ecosystem nao esta seguro para este reparo; iniciando processo PM2 direto com uma unica instancia."
      NODE_ENV=production API_TARGET="$API_TARGET" pm2 start scripts/serve-ssr.mjs \
        --name "$FRONTEND_PM2_NAME" \
        --interpreter node \
        --time \
        --merge-logs \
        --output "logs/j12-frontend.out.log" \
        --error "logs/j12-frontend.error.log" \
        -- --host "$FRONTEND_HOST" --port "$FRONTEND_PORT"
    fi
  else
    echo "ecosystem.config.js/cjs nao encontrado; iniciando processo PM2 direto."
    NODE_ENV=production API_TARGET="$API_TARGET" pm2 start scripts/serve-ssr.mjs \
      --name "$FRONTEND_PM2_NAME" \
      --interpreter node \
      --time \
      --merge-logs \
      --output "logs/j12-frontend.out.log" \
      --error "logs/j12-frontend.error.log" \
      -- --host "$FRONTEND_HOST" --port "$FRONTEND_PORT"
  fi

  pm2 save
  sleep 5
  show_pm2_state

  curl --max-time 20 -fsS "http://$FRONTEND_HOST:$FRONTEND_PORT/" >/dev/null
}

detect_nginx_conf_path() {
  if [[ -n "$NGINX_CONF_PATH" ]]; then
    return 0
  fi

  if [[ -f "/etc/nginx/conf.d/app-j12.conf" ]]; then
    NGINX_CONF_PATH="/etc/nginx/conf.d/app-j12.conf"
    return 0
  fi

  if [[ -f "/etc/nginx/conf.d/$DOMAIN.conf" ]]; then
    NGINX_CONF_PATH="/etc/nginx/conf.d/$DOMAIN.conf"
    return 0
  fi

  if [[ -f "/etc/nginx/sites-available/$DOMAIN.conf" ]]; then
    NGINX_CONF_PATH="/etc/nginx/sites-available/$DOMAIN.conf"
    return 0
  fi

  if [[ -d "/etc/nginx/conf.d" ]]; then
    NGINX_CONF_PATH="/etc/nginx/conf.d/app-j12.conf"
    return 0
  fi

  NGINX_CONF_PATH="/etc/nginx/sites-available/$DOMAIN.conf"
}

configure_nginx() {
  local source_conf="$APP_DIR/deploy/nginx/$DOMAIN.conf"

  log "Verificando configuracao do Nginx"
  detect_nginx_conf_path

  if [[ -f "$NGINX_CONF_PATH" ]]; then
    "${SUDO[@]}" cat "$NGINX_CONF_PATH" || true
  else
    echo "Arquivo Nginx ainda nao existe: $NGINX_CONF_PATH"
  fi

  if [[ ! -f "$source_conf" ]]; then
    echo "Template Nginx nao encontrado no projeto: $source_conf"
    exit 1
  fi

  if ! "${SUDO[@]}" grep -q "proxy_pass http://127.0.0.1:$FRONTEND_PORT;" "$NGINX_CONF_PATH" 2>/dev/null; then
    echo "Corrigindo proxy do Nginx para http://127.0.0.1:$FRONTEND_PORT"

    if [[ -f "$NGINX_CONF_PATH" ]]; then
      "${SUDO[@]}" cp "$NGINX_CONF_PATH" "$NGINX_CONF_PATH.bak.$(date +%Y%m%d%H%M%S)"
    fi

    "${SUDO[@]}" cp "$source_conf" "$NGINX_CONF_PATH"
  else
    echo "Nginx ja aponta para http://127.0.0.1:$FRONTEND_PORT."
  fi

  if [[ "$NGINX_CONF_PATH" == /etc/nginx/sites-available/* && -d "/etc/nginx/sites-enabled" ]]; then
    "${SUDO[@]}" ln -sfn "$NGINX_CONF_PATH" "/etc/nginx/sites-enabled/$(basename "$NGINX_CONF_PATH")"
  fi

  log "Configuracao Nginx aplicada"
  "${SUDO[@]}" cat "$NGINX_CONF_PATH"
  "${SUDO[@]}" nginx -t
  "${SUDO[@]}" systemctl restart nginx
}

require_command node
require_command npm
require_command pm2
require_command curl

locate_app_dir

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$NODE_MAJOR" -lt 22 ]]; then
  echo "Node $(node -v) nao e suportado por este build. Use Node 22 LTS ou superior."
  exit 1
fi

cd "$APP_DIR"
mkdir -p logs

show_port_usage
show_pm2_state
remove_frontend_pm2
kill_port_processes
confirm_port_free

log "Instalando/atualizando dependencias"
npm install

log "Gerando build SSR TanStack Start para Node.js"
npm run build

validate_build_outputs
test_frontend_manually
start_frontend_pm2

log "Validando API local sem reiniciar backend"
curl --max-time 20 -fsS "http://127.0.0.1:3001/health" >/dev/null

configure_nginx

log "Teste final"
curl --max-time 20 -fsSI "http://$FRONTEND_HOST:$FRONTEND_PORT/" || curl --max-time 20 -fsS -I "http://$FRONTEND_HOST:$FRONTEND_PORT/"
curl --max-time 20 -fsS -H "Host: $DOMAIN" "http://127.0.0.1/health" >/dev/null
curl --max-time 20 -fsS -H "Host: $DOMAIN" "http://127.0.0.1/" >/dev/null
curl --max-time 20 -fsSI "https://$DOMAIN" || curl --max-time 20 -fsS -I "https://$DOMAIN"

echo "Frontend SSR reparado em $DOMAIN sem reiniciar o backend."
