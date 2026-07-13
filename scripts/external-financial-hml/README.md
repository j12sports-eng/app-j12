# External financial HML gate

`audit` and `plan` are always offline and never load Banco Inter or n8n clients:

`node scripts/external-financial-hml/j12-external-financial.cjs audit`

`authorize` only validates prerequisites. It also performs no external call. It requires an isolated HML profile, explicit non-production confirmations, an approved authorization ID, exact sandbox host allowlist, sandbox secrets supplied outside Git, certificate/key files and exact confirmation:

`node --env-file=<hml-secret-file> --env-file=<external-overlay> scripts/external-financial-hml/j12-external-financial.cjs authorize --confirm=AUTHORIZE:<HML_INSTANCE_ID>:<AUTHORIZATION_ID>`

Passing this preflight does not itself authorize a real drill. A human-approved operational window and review of the scenario-specific command are still mandatory. Production hosts, real recipients, real Pix keys and production credentials are prohibited.
