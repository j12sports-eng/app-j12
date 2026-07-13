#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
load_config
assert_safe_layout
[[ "$(id -un)" == "$J12_SERVICE_USER" ]] || die "run this command as $J12_SERVICE_USER"

SOURCE_DIR=""
RELEASE_ID=""
CONFIRM=""
while (($#)); do
  case "$1" in
    --source=*) SOURCE_DIR="${1#*=}" ;;
    --release-id=*) RELEASE_ID="${1#*=}" ;;
    --confirm=*) CONFIRM="${1#*=}" ;;
    *) die "unknown argument: $1" ;;
  esac
  shift
done
assert_release_id "$RELEASE_ID"
[[ "$CONFIRM" == "DEPLOY:$RELEASE_ID" ]] || die "exact confirmation required: DEPLOY:$RELEASE_ID"
SOURCE_DIR="$(readlink -f "$SOURCE_DIR")"
[[ -f "$SOURCE_DIR/package-lock.json" && -f "$SOURCE_DIR/package.json" ]] || die "invalid source directory"
source_sha="$(git -C "$SOURCE_DIR" rev-parse HEAD)"
release_sha="${RELEASE_ID#*-}"
[[ "$source_sha" == "$release_sha"* ]] || die "release id does not match source HEAD"
[[ -z "$(git -C "$SOURCE_DIR" status --porcelain)" ]] || die "source checkout must be clean and immutable"

for command_name in node npm pm2 curl flock rsync git; do require_command "$command_name"; done
assert_secret_permissions
mkdir -p "$J12_RELEASES_DIR" "$J12_LOGS_DIR" "$J12_PM2_HOME"
exec 9>"$J12_ROOT/deploy.lock"
flock -n 9 || die "another deploy or rollback is running"

release="$J12_RELEASES_DIR/$RELEASE_ID"
[[ ! -e "$release" ]] || die "release already exists"
previous="$(current_release)"
mkdir -m 750 "$release"

cleanup_failed_release() {
  if [[ "$(current_release)" != "$release" ]]; then rm -rf --one-file-system "$release"; fi
}
trap cleanup_failed_release ERR

rsync -a --delete \
  --exclude='.git' --exclude='.env*' --exclude='certs' --exclude='logs' \
  --exclude='node_modules' --exclude='dist' --exclude='dist-ssr' \
  "$SOURCE_DIR/" "$release/"
ln -s "$J12_ENV_FILE" "$release/.env"
ln -s "$J12_CERTS_DIR" "$release/certs"
ln -s "$J12_LOGS_DIR" "$release/logs"
chown -R "$J12_SERVICE_USER:$J12_SERVICE_GROUP" "$release"

cd "$release"
npm ci --ignore-scripts
npm run build
[[ -f dist/server/server.mjs && -d dist/client ]] || die "build artifacts missing"
node backend/src/database/migration-runner/cli.js up --dry-run >"$J12_LOGS_DIR/migration-plan-$RELEASE_ID.json"

atomic_link "$release"
if ! reload_pm2 "$release" || ! smoke_release; then
  if [[ -n "$previous" && -d "$previous" ]]; then
    atomic_link "$previous"
    reload_pm2 "$previous" || true
  fi
  die "activation failed; previous release restored"
fi
save_pm2
trap - ERR
printf 'deploy=ok release=%s previous=%s migrations=not-applied\n' "$release" "$previous"

