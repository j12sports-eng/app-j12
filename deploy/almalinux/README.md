# AlmaLinux 9 atomic deploy

This workflow is intentionally separate from the legacy Ubuntu scripts. It does not install packages, configure DNS/TLS, change firewalld/SELinux, or execute migrations.

Host preparation (authorized administrator): create service user/group, `/opt/j12-sports/{releases,shared/{certs,logs,pm2}}`, `/etc/j12-sports/deploy.conf`, external `.env` mode 600/640, PM2 systemd unit for the service user, Nginx config under `/etc/nginx/conf.d`, and allow only HTTP/HTTPS in firewalld. Keep API/SSR bound to loopback. Use SELinux labels/policies appropriate to Nginx proxying; never disable SELinux.

Commands:

```bash
sudo J12_DEPLOY_CONFIG=/etc/j12-sports/deploy.conf bash deploy/almalinux/preflight.sh
sudo -u j12 J12_DEPLOY_CONFIG=/etc/j12-sports/deploy.conf bash deploy/almalinux/deploy-release.sh \
  --source=/srv/j12-staging/source \
  --release-id=20260712153000-a0aa892 \
  --confirm=DEPLOY:20260712153000-a0aa892
sudo -u j12 J12_DEPLOY_CONFIG=/etc/j12-sports/deploy.conf bash deploy/almalinux/rollback.sh \
  --release-id=20260711120000-abcdef0 \
  --confirm=ROLLBACK:20260711120000-abcdef0
```

The source directory must already contain an approved immutable revision. Deploy copies it without `.git`, env files, certificates, logs, dependencies or build outputs; links external secrets; uses `npm ci --ignore-scripts`; builds before activation; generates only an offline migration plan; swaps `current` atomically; reloads PM2; and runs API/SSR readiness smoke. Failure restores the previous symlink and process configuration.

Migrations are a separate change window through the canonical runner, after backup and exact database confirmation. Deploy and rollback never run `up`, `DOWN`, schema DDL or database restore.
