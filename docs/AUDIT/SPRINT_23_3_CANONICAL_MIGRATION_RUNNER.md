# Sprint 23.3 â€” Runner e ledger canÃ´nico de migrations

Data: 2026-07-12.

## Resultado

Foi implementada uma autoridade canÃ´nica local para descoberta, ordenaÃ§Ã£o, checksum, planejamento, execuÃ§Ã£o coordenada e ledger das migrations versionadas. Nenhuma migration foi executada e nenhum banco foi acessado deliberadamente.

O runner nÃ£o Ã© carregado por startup, build, dev server ou deploy. `plan` e `up --dry-run` nÃ£o importam `config/db.js`, nÃ£o criam pool e nÃ£o escrevem ledger. `status` e `up` exigem confirmaÃ§Ã£o exata do nome do banco; host nÃ£o local exige tambÃ©m opt-in explÃ­cito.

## Base inicial

- Branch: `sprint-23`.
- HEAD: `f79c4dbba7a80d675b6354b9b66648d7a5608645`.
- Estado inicial: `docs/AUDIT/SPRINT_23_2_CANONICAL_FINANCIAL_BRIDGE.md` jÃ¡ estava staged e foi preservado.
- Nenhum commit, push, tag, migration real ou alteraÃ§Ã£o de schema foi executado.

Foram lidos integralmente os trÃªs relatÃ³rios 22.3, o relatÃ³rio 22.9, o relatÃ³rio final da Sprint 22 e os relatÃ³rios 23.1 e 23.2.

## InventÃ¡rio de autoridades de schema

### Migrations oficiais

O diretÃ³rio `backend/src/database/migrations` contÃ©m 10 migrations versionadas: uma SQL e nove JavaScript. Todas seguem identificador timestampado de 14 dÃ­gitos; as duas migrations histÃ³ricas de `enrollment_class_links` tÃªm timestamps distintos, embora disputem o mesmo objeto.

| Faixa                               | Objetos                                    |
| ----------------------------------- | ------------------------------------------ |
| `20260629134546`                    | `enrollments`                              |
| `20260629190607`                    | unique de draft ativo                      |
| `20260629232350`                    | auditoria de confirmaÃ§Ã£o                 |
| `20260701103000` e `20260701120000` | duas variantes de `enrollment_class_links` |
| `20260702120000`                    | obrigaÃ§Ãµes financeiras                   |
| `20260702133000`                    | itens de agenda                            |
| `20260703130000`                    | recorrÃªncia de agenda                     |
| `20260703143000`                    | notificaÃ§Ãµes de agenda                   |
| `20260709220000`                    | histÃ³rico de automaÃ§Ã£o financeira       |

### DDL fora das migrations

- `backend/src/config/db.js`: `ensureAuthSchema`, `ensureSchema`, criaÃ§Ã£o/alteraÃ§Ã£o/Ã­ndices e sincronizaÃ§Ãµes legadas; chamado no bootstrap por `server/index.mjs` e `backend/src/server.js`.
- Auth e portais: `backend/auth.js`, `backend/routes/auth.js`, `backend/services/teacher-portal.js`, `backend/src/services/portal-schema.service.js` e `backend/src/controllers/financeiro.controller.js` executam ou exigem schema sob demanda.
- Financeiro: services Banco Inter, automaÃ§Ã£o e payment repositories possuem DDL/`ensureSchema` prÃ³prios.
- Pessoas: repositories/services de Pessoa, Profile, Relacionamento e PrÃ©-matrÃ­cula usam SQL dedicado e criaÃ§Ã£o sob demanda.
- Quadras: `court-rental.service.js` contÃ©m `ensureCourtRentalSchema` e o chama antes de vÃ¡rias operaÃ§Ãµes.
- Campeonatos: repositories de campeonato, inscriÃ§Ãµes, atletas, grupos, rodadas, mata-mata, sÃºmula, classificaÃ§Ã£o e portal pÃºblico encadeiam `ensureSchema`.
- SQL avulso: `backend/sql/schema.sql`; quatro arquivos SQL do domÃ­nio Pessoas; a migration SQL oficial; e proposta nÃ£o executÃ¡vel em `docs/BACKEND/sql/proposals`.

Esses mecanismos foram inventariados, mas nÃ£o foram removidos nem registrados retroativamente no ledger. Fazer isso sem conhecer o schema fÃ­sico quebraria compatibilidade. A retirada de DDL runtime deve ser incremental, depois de converter cada autoridade em migrations formais e validar ambientes.

## Arquitetura implementada

### CatÃ¡logo

`migration-catalog.js` aceita somente nomes `YYYYMMDDHHMMSS_name.js|sql`, calcula SHA-256 sobre os bytes completos, rejeita arquivo vazio, ID invÃ¡lido, ID duplicado e timestamp duplicado, e retorna ordem determinÃ­stica.

### Ledger

`j12_schema_migrations` possui:

- `id` como primary key;
- timestamp da migration com unique;
- nome e checksum SHA-256;
- estado `APPLYING`, `APPLIED` ou `FAILED`;
- inÃ­cio, aplicaÃ§Ã£o, falha, duraÃ§Ã£o e mensagem sanitizada.

O ledger Ã© criado somente por execuÃ§Ã£o real de `up`, nunca por plan/dry-run. `status` consulta `information_schema` e retorna todas como pendentes quando o ledger nÃ£o existe.

### Lock e concorrÃªncia

O adapter MySQL mantÃ©m uma conexÃ£o dedicada e usa `GET_LOCK('j12:schema-migrations', timeout)`. Mutations de ledger exigem essa conexÃ£o. O lock Ã© liberado em `finally`, inclusive em falha.

### ExecuÃ§Ã£o e falha segura

- JavaScript precisa exportar `up()`.
- SQL executa apenas a seÃ§Ã£o `-- UP`; `-- DOWN` nÃ£o Ã© aplicado.
- Migration aplicada com checksum igual Ã© ignorada.
- Checksum divergente, ledger Ã³rfÃ£o, `APPLYING` residual ou `FAILED` bloqueiam migrations posteriores.
- Antes do `up`, o estado passa a `APPLYING`; sucesso vira `APPLIED`; erro vira `FAILED` e interrompe a ordem.
- NÃ£o hÃ¡ rollback automÃ¡tico: DDL MySQL pode fazer commit implÃ­cito.

## Comandos

Sem banco:

```text
node backend/src/database/migration-runner/cli.js plan
node backend/src/database/migration-runner/cli.js up --dry-run
```

Com banco explicitamente autorizado:

```text
node --env-file=.env backend/src/database/migration-runner/cli.js status --confirm-database=EXACT_DB_NAME
node --env-file=.env backend/src/database/migration-runner/cli.js up --confirm-database=EXACT_DB_NAME
```

Banco remoto requer ainda `--allow-remote`. Nenhum desses comandos com banco foi executado nesta Sprint.

## Testes

O teste focado in-memory/controlado cobre:

1. descoberta das 10 migrations atuais;
2. ordem determinÃ­stica e checksum estÃ¡vel;
3. timestamp duplicado;
4. migration nova;
5. migration jÃ¡ aplicada;
6. checksum divergente;
7. falha intermediÃ¡ria e interrupÃ§Ã£o das posteriores;
8. dois runners concorrentes;
9. dry-run com zero mutation;
10. confirmaÃ§Ã£o exata/opt-in remoto do CLI;
11. contrato MySQL do ledger, unique e named lock.

Resultado focado inicial: **11/11 aprovado**. O dry-run real do catÃ¡logo listou 10/10 migrations com checksums e nenhuma configuraÃ§Ã£o/pool de banco foi carregada.

## LimitaÃ§Ãµes

- Nenhum MySQL descartÃ¡vel estava disponÃ­vel/autorizado; o adapter foi validado por contrato e os fluxos pelo ledger in-memory.
- Bancos existentes nÃ£o possuem baseline comprovado. NÃ£o se deve executar `up` para â€œadotarâ€ objetos existentes sem comparar `information_schema`, checksums e dados em clone isolado.
- As migrations JavaScript atuais ainda importam `config/db.js`; o runner coordena e registra, mas nÃ£o torna seus DDLs transacionais.
- O ledger nÃ£o cobre DDL runtime ou SQL avulso retroativamente.
- A duplicidade funcional das migrations de class links continua explÃ­cita e deve ser reconciliada contra schema real antes de aplicaÃ§Ã£o.
- `status`/`up` nÃ£o foram executados porque o `.env` aponta para banco nÃ£o local e a Sprint proÃ­be esse acesso.

## Percentual real

- CatÃ¡logo, checksum, ordem, estados, proteÃ§Ã£o duplicada, lock, dry-run e CLI: **100% local/contratual**.
- ExecuÃ§Ã£o em MySQL isolado: **0% comprovado**.
- AdoÃ§Ã£o de banco legado e retirada de DDL runtime: **0%**.
- Sprint 23.3: **78%** â€” implementaÃ§Ã£o e testes locais completos; faltam banco descartÃ¡vel, baseline de ambiente e migraÃ§Ã£o gradual do DDL runtime.

## Arquivos da Sprint 23.3

- `backend/src/database/migration-runner/migration-catalog.js`
- `backend/src/database/migration-runner/canonical-migration-runner.js`
- `backend/src/database/migration-runner/mysql-migration-ledger.js`
- `backend/src/database/migration-runner/migration-executor.js`
- `backend/src/database/migration-runner/cli.js`
- `backend/src/database/migration-runner/index.js`
- `backend/src/database/migration-runner/README.md`
- `backend/src/database/migration-runner/canonical-migration-runner.test.js`
- `docs/AUDIT/SPRINT_23_3_CANONICAL_MIGRATION_RUNNER.md`

Nenhuma Sprint 23.4 foi iniciada.
