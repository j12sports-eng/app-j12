#!/usr/bin/env bash
set -euo pipefail

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
log() { printf '==> %s\n' "$*"; }
require_command() { command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"; }

load_config() {
  local config_file="${J12_DEPLOY_CONFIG:-/etc/j12-sports/deploy.conf}"
  [[ -r "$config_file" ]] || die "deploy config is not readable: $config_file"
  # shellcheck source=/dev/null
  source "$config_file"
  : "${J12_ROOT:?}" "${J12_RELEASES_DIR:?}" "${J12_SHARED_DIR:?}" "${J12_CURRENT_LINK:?}"
  : "${J12_SERVICE_USER:?}" "${J12_SERVICE_GROUP:?}" "${J12_ENV_FILE:?}" "${J12_CERTS_DIR:?}"
  : "${J12_LOGS_DIR:?}" "${J12_PM2_HOME:?}" "${J12_PM2_CONFIG:?}" "${J12_PM2_SYSTEMD_UNIT:?}"
  : "${J12_API_READY_URL:?}" "${J12_SSR_READY_URL:?}"
  J12_KEEP_RELEASES="${J12_KEEP_RELEASES:-5}"
  J12_SHUTDOWN_TIMEOUT_SECONDS="${J12_SHUTDOWN_TIMEOUT_SECONDS:-20}"
}

assert_release_id() {
  [[ "${1:-}" =~ ^[0-9]{14}-[a-f0-9]{7,40}$ ]] || die "release id must be YYYYMMDDHHMMSS-gitsha"
}

assert_safe_layout() {
  [[ "$J12_RELEASES_DIR" == "$J12_ROOT"/releases ]] || die "unsafe releases path"
  [[ "$J12_SHARED_DIR" == "$J12_ROOT"/shared ]] || die "unsafe shared path"
  [[ "$J12_CURRENT_LINK" == "$J12_ROOT"/current ]] || die "unsafe current link"
  [[ "$J12_ENV_FILE" == "$J12_SHARED_DIR"/* ]] || die "env file must be under shared"
  [[ "$J12_CERTS_DIR" == "$J12_SHARED_DIR"/* ]] || die "certs must be under shared"
  [[ "$J12_LOGS_DIR" == "$J12_SHARED_DIR"/* ]] || die "logs must be under shared"
}

assert_secret_permissions() {
  [[ -f "$J12_ENV_FILE" ]] || die "external env file missing"
  local mode owner
  mode="$(stat -c '%a' "$J12_ENV_FILE")"
  owner="$(stat -c '%U:%G' "$J12_ENV_FILE")"
  [[ "$mode" == "600" || "$mode" == "640" ]] || die "env permissions must be 600 or 640"
  [[ "$owner" == "$J12_SERVICE_USER:$J12_SERVICE_GROUP" ]] || die "env owner mismatch"
  [[ -d "$J12_CERTS_DIR" ]] || die "external certs directory missing"
  local cert_mode
  while IFS= read -r -d '' secret_file; do
    cert_mode="$(stat -c '%a' "$secret_file")"
    [[ "$cert_mode" == "600" || "$cert_mode" == "640" ]] || die "certificate/key permissions must be 600 or 640"
  done < <(find "$J12_CERTS_DIR" -type f -print0)
}

current_release() {
  [[ -L "$J12_CURRENT_LINK" ]] || return 0
  readlink -f "$J12_CURRENT_LINK"
}

atomic_link() {
  local target="$1" temporary="$J12_ROOT/.current.$$.tmp"
  [[ "$target" == "$J12_RELEASES_DIR"/* && -d "$target" ]] || die "target is not a release"
  ln -s "$target" "$temporary"
  mv -Tf "$temporary" "$J12_CURRENT_LINK"
}

smoke_release() {
  curl --fail --silent --show-error --max-time 15 "$J12_API_READY_URL" >/dev/null
  curl --fail --silent --show-error --max-time 15 "$J12_SSR_READY_URL" >/dev/null
}

save_pm2() {
  HOME="$J12_SHARED_DIR" PM2_HOME="$J12_PM2_HOME" pm2 save
}

reload_pm2() {
  local release="$1"
  HOME="$J12_SHARED_DIR" PM2_HOME="$J12_PM2_HOME" \
    pm2 startOrReload "$release/$J12_PM2_CONFIG" --update-env
}
