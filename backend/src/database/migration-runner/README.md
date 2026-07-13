# Canonical migration runner

The runner is manual and is never imported by application startup, build or deploy.

Commands that do not access a database:

```text
node backend/src/database/migration-runner/cli.js plan
node backend/src/database/migration-runner/cli.js up --dry-run
```

Database commands require the exact configured database name:

```text
node --env-file=.env backend/src/database/migration-runner/cli.js status --confirm-database=EXACT_DB_NAME
node --env-file=.env backend/src/database/migration-runner/cli.js up --confirm-database=EXACT_DB_NAME
```

A non-local `DB_HOST` additionally requires `--allow-remote`. That flag is a technical guard only; it does not replace operational authorization, backup, schema inventory or change approval.

The runner:

- discovers only `YYYYMMDDHHMMSS_name.js|sql` files in the official migrations directory;
- orders by the complete unique identifier and rejects duplicate timestamps;
- stores the SHA-256 checksum and rejects changed applied migrations;
- uses `j12_schema_migrations` with `APPLYING`, `APPLIED` and `FAILED` states;
- obtains the MySQL named lock `j12:schema-migrations` before ledger or migration mutations;
- records intermediate failures and stops without running later migrations;
- skips already applied migrations only when the checksum matches;
- treats orphaned, applying, failed and checksum-mismatched ledger rows as blockers.

MySQL DDL can commit implicitly. The runner therefore does not claim automatic rollback. A `FAILED` row requires inspection and an approved recovery plan.

For an existing database without this ledger, do not run `up` merely to populate history. First compare `information_schema`, migration checksums and actual objects in an isolated clone, then define an approved baseline/adoption procedure. Sprint 23.3 does not invent or execute that baseline.
