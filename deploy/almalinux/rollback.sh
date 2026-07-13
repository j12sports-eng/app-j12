#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
load_config
assert_safe_layout
[[ "$(id -un)" == "$J12_SERVICE_USER" ]] || die "run this command as $J12_SERVICE_USER"

RELEASE_ID=""
CONFIRM=""
while (($#)); do
  case "$1" in
    --release-id=*) RELEASE_ID="${1#*=}" ;;
    --confirm=*) CONFIRM="${1#*=}" ;;
    *) die "unknown argument: $1" ;;
  esac
  shift
done
assert_release_id "$RELEASE_ID"
[[ "$CONFIRM" == "ROLLBACK:$RELEASE_ID" ]] || die "exact confirmation required: ROLLBACK:$RELEASE_ID"
target="$J12_RELEASES_DIR/$RELEASE_ID"
[[ -d "$target" && -f "$target/dist/server/server.mjs" ]] || die "validated release not found"

exec 9>"$J12_ROOT/deploy.lock"
flock -n 9 || die "another deploy or rollback is running"
previous="$(current_release)"
[[ "$target" != "$previous" ]] || die "target is already current"

atomic_link "$target"
if ! reload_pm2 "$target" || ! smoke_release; then
  if [[ -n "$previous" && -d "$previous" ]]; then
    atomic_link "$previous"
    reload_pm2 "$previous" || true
  fi
  die "rollback target failed smoke; original release restored"
fi
save_pm2
printf 'rollback=ok release=%s previous=%s migrations=untouched\n' "$target" "$previous"

