# Sprint 23.4 — Remoção segura de DDL do runtime produtivo

Data: 2026-07-12.

## Resultado executivo

O runtime MySQL produtivo agora é **validation-only para schema**. `query`, `execute`, conexões adquiridas e transações passam por uma política central que:

- permite SQL de dados e consultas;
- converte `CREATE TABLE IF NOT EXISTS` em consulta read-only ao `information_schema` quando a tabela já existe;
- falha com `PRODUCTION_SCHEMA_TABLE_MISSING` quando a tabela obrigatória está ausente;
- bloqueia `ALTER`, `CREATE INDEX`, `DROP`, `RENAME`, `TRUNCATE` e demais DDL com `PRODUCTION_RUNTIME_DDL_BLOCKED`;
- libera DDL somente no contexto explícito do runner canônico da Sprint 23.3.

Os dois entrypoints HTTP fecham o servidor e marcam exit code 1 quando o bootstrap falha em produção. O adapter SQLite legado também falha antes de criar diretório, arquivo ou tabela em produção.

Nenhuma migration foi executada, nenhum schema real foi alterado e nenhum banco externo foi acessado deliberadamente.

## Base

- Branch inicial: `sprint-23`.
- HEAD inicial: `c9612817a320b83065ffffea3b6ee638c6af6d34`.
- Os nove arquivos da Sprint 23.3 já estavam staged e foram preservados.
- Nenhum commit, push ou tag foi realizado nesta Sprint.

## Auditoria integral

A busca local encontrou **149 ocorrências de DDL** e **220 referências a `ensure*Schema`** antes da implementação. A classificação abaixo considera o caminho de execução, não apenas texto encontrado.

| Classe                     | Principais arquivos/mecanismos                                          | Execução anterior             | Tratamento 23.4                                             |
| -------------------------- | ----------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------- |
| Bootstrap MySQL central    | `backend/src/config/db.js`, `server/index.mjs`, `backend/src/server.js` | startup                       | guard central + fail-fast produtivo                         |
| Auth                       | `backend/auth.js`, `backend/routes/auth.js`, `ensureAuthSchema`         | startup e requests            | criação vira validação; ausência/ALTER falham               |
| Portal aluno/professor     | `portal-schema.service.js`, `teacher-portal.js`                         | requests                      | coberto pelo adapter central                                |
| Financeiro legado          | controller, routes, Banco Inter service                                 | startup/requests              | coberto pelo adapter central                                |
| Financeiro moderno         | payment e automation repositories                                       | repository sob demanda        | query runner default coberto; conexões do pool também       |
| Pessoas                    | services/repositories e quatro arquivos SQL                             | service sob demanda           | formalizado em migration; runtime produtivo validation-only |
| Quadras                    | `court-rental.service.js`                                               | antes de operações            | pool/query/connection cobertos                              |
| Campeonatos                | nove repositories encadeados                                            | antes de leituras e mutations | query runners e conexões cobertos                           |
| SQLite legado              | `server/database.mjs`                                                   | import do módulo              | bloqueado antes de filesystem/DatabaseSync em produção      |
| SQL legado                 | `backend/sql/schema.sql`                                                | manual/fora do runner         | inventariado; não promovido como canônico                   |
| Propostas                  | `docs/BACKEND/sql/proposals`                                            | não executável                | preservadas como proposta                                   |
| Migrations formais         | `backend/src/database/migrations`                                       | runner manual                 | único caminho autorizado para DDL produtivo                 |
| Testes/strings documentais | testes e Markdown                                                       | não produtivo                 | preservados                                                 |

### Ocorrências de maior risco

1. `ensureSchema()` era chamado diretamente no startup dos dois entrypoints.
2. `ensureAuthSchema()` também era chamado em login/requests.
3. Repositories de Campeonatos e Financeiro chamavam `ensureSchema()` antes de operações normais.
4. Quadras mantinha DDL extenso dentro do application service.
5. `server/database.mjs` criava SQLite e alterava colunas durante import.
6. Chamadas diretas a `pool.query`, `pool.execute` e conexões podiam contornar o helper `query`.

Por isso a correção foi aplicada na fronteira do pool e não somente no helper ou em dezenas de call sites.

## Implementação

### Política central

`runtime-ddl-policy.js` classifica o statement antes da execução. Em produção normal, nenhum DDL chega ao driver. O caso idempotente `CREATE TABLE IF NOT EXISTS` é tratado como assert de pré-condição: uma consulta raw e parametrizada verifica a tabela; o statement original não é executado.

O adapter cobre:

- `pool.query`;
- `pool.execute`;
- `connection.query`;
- `connection.execute`;
- conexões usadas por transactions e services.

Desenvolvimento e testes mantêm o comportamento legado para compatibilidade comprovada. O runner define `J12_MIGRATION_RUNNER_CONTEXT=true` imediatamente antes do import tardio de `config/db.js`; startup e servidores não definem essa variável.

### Startup seguro

Quando schema está completo, os antigos `CREATE TABLE IF NOT EXISTS` tornam-se validações read-only e os checks de coluna/índice permanecem consultas. Quando falta tabela/coluna/índice ou existe DDL incompatível, o bootstrap falha claramente. Em produção, ambos os entrypoints fecham o listener e definem exit code 1, impedindo prontidão falsa.

### SQLite legado

O módulo SQLite é local/legado. `DatabaseSync` pode criar arquivo no construtor; por isso o bloqueio produtivo ocorre antes de `mkdirSync` e `new DatabaseSync`.

## Migrations formais adicionadas

### Pessoas

`20260712183000_create_people_domain_tables.sql` formaliza, sem alterar contrato:

- `people`;
- `person_profiles`;
- `person_relationships`;
- `pre_matriculas`.

### Autenticação

`20260712184500_create_auth_runtime_tables.sql` formaliza:

- `j12_usuarios`;
- `users`;
- `user_sessions`;
- `password_reset_tokens`.

Ambas possuem `-- UP`, não possuem `DROP` automático e documentam rollback manual porque as tabelas preexistem ao ledger e podem conter dados. O dry-run do runner passou a listar **12 migrations**.

## Invariantes

1. Runtime produtivo comum nunca executa DDL.
2. Migration runner é o único opt-in explícito.
3. Tabela ausente produz erro nominando somente o objeto, sem SQL completo ou credenciais.
4. DDL genérico produz erro controlado e recomenda migration.
5. Falha de bootstrap produtiva fecha o servidor.
6. Desenvolvimento/testes preservam fallback legado nesta etapa.
7. Nenhum DDL runtime é declarado migrado sem artefato formal equivalente.

## Testes focados

Cobertura:

- tabela presente: `CREATE IF NOT EXISTS` não chega ao executor;
- tabela ausente: erro claro;
- `ALTER`, `CREATE INDEX` e `TRUNCATE`: bloqueados;
- desenvolvimento: compatibilidade mantida;
- contexto do runner: DDL autorizado;
- pool, conexão e transactions: guard estrutural presente;
- startup dos dois entrypoints: fechamento produtivo;
- SQLite: falha antes da inicialização produtiva;
- migrations Pessoas/Auth e DOWN não destrutivo;
- catálogo, checksum, concorrência e contratos da Sprint 23.3.

Resultado focado antes dos gates globais: **24/24 aprovado**.

## Gates finais

| Gate                         | Resultado                                                           |
| ---------------------------- | ------------------------------------------------------------------- |
| Testes focados               | **24/24 aprovado**                                                  |
| Backend completo             | **589/589 aprovado**                                                |
| Frontend completo encontrado | **78/78 aprovado**                                                  |
| ESLint focado                | **aprovado**                                                        |
| Prettier JS/MJS/Markdown     | **aprovado**; SQL não possui parser configurado                     |
| `git diff --check`           | **aprovado**                                                        |
| Dry-run canônico             | **12/12 migrations listadas**, sem banco                            |
| Build Client/SSR             | **aprovado**; Client 3.737 módulos, warnings TanStack preexistentes |

## Limitações

- Apenas Pessoas e Auth foram convertidos integralmente nesta Sprint. O grande bootstrap legado, Financeiro, Portais, Quadras e Campeonatos continuam contendo DDL no código, mas ele está tecnicamente impedido de executar em produção.
- Remover fisicamente cada bloco exige migrations por domínio, comparação com `information_schema` de clone isolado e plano de dados. Fazer isso sem schema físico inventaria contratos.
- A validação atual reutiliza os `ensureSchema` legados como sequência de asserts. Uma etapa futura deve substituí-los por manifests explícitos read-only, domínio a domínio.
- Nenhuma migration foi aplicada em banco descartável/HML; somente contratos, dry-run e testes in-memory foram executados.
- Schema produtivo que ainda dependa de um `ALTER` runtime agora falhará fechado até a migration equivalente ser aprovada e aplicada.

## Percentual real

- Bloqueio de DDL produtivo na fronteira MySQL/SQLite: **100% local/estrutural**.
- Startup fail-fast: **100% local/estrutural**.
- DDL formalizado: Pessoas e Auth; demais domínios pendentes.
- Execução em banco isolado: **0% comprovado**.
- Sprint 23.4: **76%** — risco produtivo imediato bloqueado; remoção física e migrations dos demais domínios continuam graduais.

## Arquivos alterados

- `backend/src/config/db.js` — aplica política em pool e conexões.
- `backend/src/config/runtime-ddl-policy.js` — política produtiva central.
- `backend/src/config/runtime-ddl-policy.test.js` — testes unitários.
- `backend/src/config/runtime-ddl-integration.test.js` — contratos de integração/startup.
- `backend/src/config/sqlite-runtime-policy.test.js` — bloqueio SQLite produtivo.
- `backend/src/database/migrations/20260712183000_create_people_domain_tables.sql` — migration Pessoas.
- `backend/src/database/migrations/20260712184500_create_auth_runtime_tables.sql` — migration Auth.
- `backend/src/database/migration-runner/cli.js` — contexto explícito do runner.
- `backend/src/database/migration-runner/canonical-migration-runner.test.js` — catálogo com 12 migrations.
- `server/index.mjs` — fail-fast do entrypoint canônico.
- `backend/src/server.js` — fail-fast do entrypoint legado.
- `server/database.mjs` — impede bootstrap SQLite produtivo.
- `docs/AUDIT/SPRINT_23_4_RUNTIME_DDL_REMOVAL.md` — esta auditoria.

A Sprint 23.5 não foi iniciada.
