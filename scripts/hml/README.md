# Isolated homologation tooling

This directory prepares, but does not claim to provision, the J12 HML environment.

1. Copy `config/hml/hml.env.example` to a secret-managed path outside Git and replace every placeholder.
2. Validate without network or database access:

ode --env-file=<path> scripts/hml/j12-hml.cjs validate` 3. Inspect the canonical migration plan offline:

ode --env-file=<path> scripts/hml/j12-hml.cjs plan-migrations`4. Provision MySQL only when Docker and an approved isolated host are available:
  `docker compose --env-file <path> -f deploy/hml/docker-compose.hml.yml up -d mysql-hml`5. Apply migrations with the Sprint 23.3 runner and its exact database confirmation. Never add`--allow-remote` for this loopback profile. 6. Run the canonical API entrypoint (which performs the mandatory HML preflight) and then the local-only smoke:

ode --env-file=<path> scripts/hml/hml-api-entry.cjs`

ode --env-file=<path> scripts/hml/j12-hml.cjs smoke`

Reset is dry-run by default. Destructive application requires both `--apply` and
`--confirm=RESET:<HML_INSTANCE_ID>:<DB_NAME>`, plus `--env-file=<path>`.

Synthetic data must be generated through approved domain APIs after migrations. Use reserved addresses under `example.test`, Brazilian invalid documentation fixtures, non-routable phone numbers and the prefix `[HML-SYNTHETIC]`. Importing or cloning production data is forbidden. This sprint does not invent SQL inserts for schemas whose canonical ownership varies by domain.
