# J12 backup and recovery automation

These commands never read the application `.env`. They require an explicit absolute MySQL `--defaults-file` with restrictive filesystem permissions. Passwords are not passed on the command line.

The backup directory must be outside the Git workspace. `--storage-encrypted` is a mandatory operator acknowledgement that the destination volume/bucket provides encryption at rest. Offsite replication is an external storage responsibility and is not claimed by these scripts.

```text
node scripts/recovery/j12-recovery.cjs backup --database=j12_source --defaults-file=/run/secrets/j12-backup.cnf --output-dir=/var/backups/j12 --storage-encrypted --git-sha=<release>
node scripts/recovery/j12-recovery.cjs validate --artifact=/var/backups/j12/j12-backup-<UTC>.sql.gz
```

Restore is allowed only to an explicitly disposable database name and requires exact confirmation:

```text
node scripts/recovery/j12-recovery.cjs restore --artifact=<absolute.sql.gz> --database=j12_restore_20260712 --confirm-database=j12_restore_20260712 --defaults-file=/run/secrets/j12-restore.cnf
node scripts/recovery/j12-recovery.cjs verify --database=j12_restore_20260712 --confirm-database=j12_restore_20260712 --defaults-file=/run/secrets/j12-restore.cnf
node scripts/recovery/j12-recovery.cjs smoke --database=j12_restore_20260712 --confirm-database=j12_restore_20260712 --defaults-file=/run/secrets/j12-restore.cnf
```

The complete drill measures RPO/RTO and requires the same disposable guards:

```text
node scripts/recovery/j12-recovery.cjs drill --artifact=<absolute.sql.gz> --database=j12_restore_20260712 --confirm-database=j12_restore_20260712 --defaults-file=/run/secrets/j12-restore.cnf --rpo-hours=24 --rto-minutes=60
```

Retention previews by default. Deletion requires `--apply` and only matches canonical artifact names plus their manifests:

```text
node scripts/recovery/j12-recovery.cjs retention --output-dir=/var/backups/j12 --keep-days=30
node scripts/recovery/j12-recovery.cjs retention --output-dir=/var/backups/j12 --keep-days=30 --apply
```

Prerequisites for operational use: `mysqldump`, `mysql`, `mysqlcheck`, protected defaults files, encrypted storage, an offsite copy policy, monitoring, and an isolated disposable MySQL target with all integrations disabled.
