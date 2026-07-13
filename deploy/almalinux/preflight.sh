#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
load_config
assert_safe_layout

[[ -r /etc/os-release ]] || die "/etc/os-release unavailable"
# shellcheck source=/dev/null
source /etc/os-release
[[ "${ID:-}" == "almalinux" ]] || die "this workflow requires AlmaLinux"
[[ "${VERSION_ID%%.*}" == "9" ]] || die "AlmaLinux 9 is required"

for command_name in node npm pm2 nginx systemctl curl flock rsync git getenforce getsebool firewall-cmd; do
  require_command "$command_name"
done
node_major="$(node -p 'process.versions.node.split(".")[0]')"
(( node_major >= 22 )) || die "Node 22 or newer is required"

[[ "$(systemctl is-enabled nginx 2>/dev/null || true)" == "enabled" ]] || die "nginx must be enabled"
[[ "$(systemctl is-active nginx 2>/dev/null || true)" == "active" ]] || die "nginx must be active"
[[ "$(systemctl is-enabled "$J12_PM2_SYSTEMD_UNIT" 2>/dev/null || true)" == "enabled" ]] || die "PM2 systemd unit must be enabled"
[[ "$(systemctl is-active "$J12_PM2_SYSTEMD_UNIT" 2>/dev/null || true)" == "active" ]] || die "PM2 systemd unit must be active"
nginx -t

[[ -d "$J12_RELEASES_DIR" && -d "$J12_SHARED_DIR" && -d "$J12_LOGS_DIR" ]] || die "release layout missing"
assert_secret_permissions
[[ "$(stat -c '%U:%G' "$J12_ROOT")" == "$J12_SERVICE_USER:$J12_SERVICE_GROUP" ]] || die "root owner mismatch"

selinux_mode="$(getenforce)"
[[ "$selinux_mode" != "Disabled" ]] || die "SELinux must not be disabled"
getsebool httpd_can_network_connect | grep -q -- '--> on' || die "SELinux must allow the Nginx reverse proxy connection"
firewall-cmd --state >/dev/null
firewall-cmd --query-service=http >/dev/null || die "firewalld http service is closed"
firewall-cmd --query-service=https >/dev/null || die "firewalld https service is closed"
if firewall-cmd --list-ports | grep -Eq '(^| )(3001|4173)/tcp( |$)'; then
  die "application ports must not be public in firewalld"
fi

printf 'preflight=ok os=%s node=%s selinux=%s current=%s\n' \
  "$PRETTY_NAME" "$(node --version)" "$selinux_mode" "$(current_release)"
