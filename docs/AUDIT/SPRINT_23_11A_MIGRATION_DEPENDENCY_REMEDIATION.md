# Sprint 23.11A - Remediacao segura da dependencia canonica das migrations

Data: 2026-07-13.

## 1. Objetivo, contexto e classificacao inicial

Objetivo: corrigir a ordem estrutural do catalogo sem renomear ou editar migrations
historicas, sem mascarar drift e sem acessar qualquer ambiente externo.

Classificacao inicial: **Sprint 23.11 parcialmente concluida/bloqueada**. No MySQL local
descartavel, 20260629134546_create_enrollments_table.sql tentou criar FKs para people e
person_profiles antes da migration que cria essas tabelas. A evidencia preservada
registra ER_FK_CANNOT_OPEN_PARENT (errno 1824), ledger FAILED, interrupcao fail-closed e
21 jornadas BLOCKED.

## 2. Auditoria Git inicial

- Branch: sprint-23.
- HEAD: 6e11006fc4aee926e105e8d4a0c00e7388ae7911.
- origin/sprint-23: a0aa892...; divergencia 0 behind/2 ahead.
- Staging vazio.
- Modified preservados: .gitignore, package-lock.json, package.json.
- Untracked preservados: entregas 23.10 e 23.11.
- Ignored preservados: artifacts/e2e/, inclusive datadirs e evidencias.
- git diff --check: aprovado na entrada, com avisos CRLF sem erro.
- Nenhum reset, clean, restore, commit, push, tag, merge ou deploy foi executado.

## 3. Auditoria do runner, identidade e checksum

O runner 23.3 foi lido integralmente. A identidade e timestamp_name, ambos extraidos do
filename. O checksum SHA-256 cobre somente os bytes do conteudo. Consequencias:

- renomear/trocar timestamp cria outro ID, deixa o registro antigo ORPHANED e o novo
  arquivo PENDING;
- editar conteudo preservando o ID produz CHECKSUM_MISMATCH;
- FAILED, APPLYING, ORPHANED e mismatch bloqueiam toda a sequencia;
- APPLIED com checksum igual e ignorada idempotentemente;
- .js executa up() e .sql executa somente a secao -- UP;
- o ledger usa APPLYING, APPLIED, FAILED, timestamp unico e named lock MySQL
  j12:schema-migrations;
- DDL MySQL pode fazer commit implicito; por isso FAILED exige inspecao e recuperacao
  explicita, nunca retry automatico.

A ordem anterior era lexical por ID. A remediacao manteve identidade/checksum e passou a
usar DFS topologico estavel sobre a lista lexical. Declaracao desconhecida, dependencia
ausente e ciclo falham fechado. O dry-run continua totalmente offline e agora mostra as
dependencias de cada item.

## 4. Matriz topologica completa

Pos. antiga e a ordem lexical com os 14 arquivos atuais; Pos. necessaria e a ordem
efetiva dependency-first.

| Migration                                        | TS             | Cria                                            | Altera        | Referencia/depende de       | Antiga | Necessaria | Checksum    | Risco    |
| ------------------------------------------------ | -------------- | ----------------------------------------------- | ------------- | --------------------------- | -----: | ---------: | ----------- | -------- |
| create_enrollments_table.sql                     | 20260629134546 | enrollments                                     | -             | people, person_profiles     |      1 |          2 | 0f0e8a71... | P0 antes |
| add_active_draft_unique_constraint...js          | 20260629190607 | -                                               | enrollments   | enrollments                 |      2 |          3 | 67e96a77... | medio    |
| add_enrollment_confirmation...js                 | 20260629232350 | -                                               | enrollments   | enrollments                 |      3 |          4 | e0c4cb88... | baixo    |
| add_enrollment_class_links...103000.js           | 20260701103000 | enrollment_class_links                          | extensoes     | enrollments, j12_turmas     |      4 |          6 | c409b99e... | P0 antes |
| add_enrollment_class_links...120000.js           | 20260701120000 | mesma tabela                                    | FKs/indice    | primeira links + indice     |      5 |          8 | d18f38c5... | P0 antes |
| create_enrollment_financial_obligations...js     | 20260702120000 | financial_obligations                           | -             | enrollments                 |      6 |          9 | a12c5e6a... | baixo    |
| create_enrollment_agenda_items...js              | 20260702133000 | agenda_items                                    | -             | enrollments, j12_turmas     |      7 |         10 | 6cd128d5... | P0 antes |
| create_agenda_recurrence_tables.js               | 20260703130000 | 3 tabelas recurrence                            | -             | agenda, enrollments, turmas |      8 |         11 | be981aca... | P0 antes |
| create_agenda_notification_tables.js             | 20260703143000 | 5 tabelas notification                          | -             | recurrence, agenda          |      9 |         12 | b83fcbd0... | baixo    |
| create_financial_automation_execution_history.js | 20260709220000 | execution_history                               | -             | nenhuma                     |     10 |         13 | 388b17b3... | baixo    |
| create_people_domain_tables.sql                  | 20260712183000 | people, profiles, relationships, pre_matriculas | -             | nenhuma                     |     11 |          1 | 0dfbca27... | fundacao |
| create_auth_runtime_tables.sql                   | 20260712184500 | users, sessions, reset, j12_usuarios            | -             | nenhuma FK                  |     12 |         14 | c50b48b4... | baixo    |
| create_classes_foundation_table.js               | 20260713100000 | j12_turmas                                      | adota/indices | schema runtime auditado     |     13 |          5 | 831c913c... | aditivo  |
| reconcile_enrollment_class_links_indexes.js      | 20260713101500 | indice composto                                 | class_links   | links 10:30                 |     14 |          7 | 6af1b45c... | aditivo  |

Foram analisadas 16 relacoes estruturais/fundacionais e 12 arestas explicitas finais.
Nao houve ciclo. Cinco condicoes invalidas foram encontradas na auditoria inicial:

1. enrollments depende de people/person_profiles (duas FKs, uma dependencia de migration);
2. class-links 10:30 dependia de j12_turmas sem migration provedora;
3. class-links 12:00 tinha sequenciamento duplicado nao formalizado;
4. agenda-items dependia de j12_turmas sem migration provedora;
5. recurrence dependia de j12_turmas sem migration provedora.

O ensaio real encontrou ainda uma incompatibilidade sequencial: class-links 12:00 exige
idx_enrollment_class_links_enrollment_status, ausente na tabela criada por 10:30. A
reconciliation aditiva passou a executar entre ambas. Resultado final: zero dependencia
topologica conhecida invalida e zero ciclo.

## 5. Compatibilidade com ledger: cenarios A-G

| Cenario                               | Comportamento comprovado/definido                                                                                       |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| A - banco novo                        | Topologia cria people, enrollments e turmas antes de consumidores; 14/14 APPLIED no MySQL local.                        |
| B - parcialmente antes de enrollments | Dependencias pendentes executam primeiro; registros APPLIED validos sao ignorados. Teste de catalogo parcial passou.    |
| C - enrollments FAILED                | Continua bloqueado. Nao ha limpeza/retry automatico; o datadir FAILED foi preservado e uma base nova foi usada.         |
| D - enrollments ja APPLIED            | ID/checksum historicos permanecem iguais; a nova fundacao de turmas pode executar sem reaplicar enrollments.            |
| E - people existe por legado          | CREATE IF NOT EXISTS da migration oficial adota a tabela; incompatibilidade necessaria para FK falha no proprio MySQL.  |
| F - ambas APPLIED no ledger           | IDs e checksums preservados fazem skip seguro.                                                                          |
| G - schema existe/ledger incompleto   | Nao ha baseline silencioso. Migrations idempotentes validam/adotam quando inequivoco; drift ambiguo exige plano manual. |

Uma migration FAILED nunca e reinterpretada como PENDING. Uma migration historica
alterada continua gerando mismatch. Isso preserva recuperacao de desastre e impede que
um restore com ledger divergente prossiga silenciosamente.

## 6. Estrategias avaliadas

1. **Renomear people:** rejeitada; muda ID/timestamp, cria ORPHANED/PENDING e risco de
   duplicacao.
2. **Editar enrollments:** rejeitada; muda checksum e mascara drift em ambientes
   aplicados.
3. **Editar people:** rejeitada pelo mesmo motivo.
4. **Nova migration preparatoria retrodatada:** rejeitada; exigiria identidade artificial
   e duplicaria o schema de people.
5. **Separar people:** rejeitada; altera o arquivo historico e sua identidade logica.
6. **Postergar FK:** rejeitada; exige editar enrollments e cria janela sem integridade.
7. **Dependencias explicitas:** escolhida; preserva bytes, IDs e checksums, e resolve a
   causa estrutural de forma deterministica.
8. **Reconciliation aditiva:** escolhida como complemento para fundacao de turmas e o
   indice esperado pela segunda migration de links.
9. **Hibrida superior:** resultado final. Grafo explicito mais migrations aditivas
   fail-closed, sem excecao temporaria no executor.

A escolha segue a prioridade de nao corromper bancos existentes, nao mascarar drift,
preservar identidade/checksum e suportar base nova e parcial.

## 7. Implementacao e invariantes

- migration-dependencies.js declara arestas por ID canonico.
- migration-catalog.js faz ordenacao topologica estavel e falha para dependencia
  ausente, declaracao desconhecida ou ciclo.
- canonical-migration-runner.js inclui dependencies no plano/dry-run.
- 20260713100000_create_classes_foundation_table.js formaliza exatamente o DDL de
  j12_turmas auditado em db.js. Em legado valida InnoDB e todos os tipos; aceita INT ou
  BIGINT somente onde o runtime historico admitia ambos; adiciona apenas tres indices
  conhecidos. Down destrutivo e recusado.
- 20260713101500_reconcile_enrollment_class_links_indexes.js adiciona e valida somente
  o indice composto exigido pela migration preservada de 12:00. Down destrutivo e
  recusado.
- As 12 migrations preexistentes nao foram renomeadas nem editadas.
- Checksums historicos auditados permaneceram identicos.
- Nenhuma tabela dummy, FK removida, baseline automatico ou migration ignorada.

## 8. Testes especificos e dry-run

Testes focados executados novamente na retomada com DB forcado para 127.0.0.1:1 e
credenciais invalidas: **37/37 PASS**. A suite cobre os 20 comportamentos minimos da
remediacao, incluindo:

1. catalogo deterministico;
2. people antes de enrollments;
3. dependencia ausente;
4. ciclo;
5. checksum byte a byte preservado;
6. migration alterada/mismatch;
7. base nova (MySQL real local);
8. base parcialmente migrada;
9. FAILED/interrupcao;
10. schema legado/tipos aceitos e drift rejeitado;
11. concorrencia/named lock;
12. dry-run sem adapter de banco;
13. falha intermediaria;
14. grafo canonico integralmente valido;
15. rollback destrutivo recusado nas duas migrations aditivas;
16. declaracao de dependencia apontando para migration desconhecida;
17. ledger preexistente FAILED sem chamada ao executor;
18. dry-run real do catalogo e ordem topologica efetiva;
19. checksums fixos das 12 migrations originais;
20. fundacao de j12_turmas antes de todos os consumidores estruturais.

O dry-run offline passou e listou 14 itens PENDING em ordem dependency-first, com people
na posicao 1, enrollments na 2, fundacao de turmas na 5 e reconciliation na 7.

## 9. Validacao MySQL local descartavel

Guardrails confirmados: J12_ENVIRONMENT=e2e-local, HML_ISOLATED=true, host
127.0.0.1, porta 3307, database j12_e2e_hml, SSL e integracoes externas desabilitados.
Nao foi usado hostname remoto, credencial externa ou --allow-remote.

- datadir original e mysql-data-sprint-23-11 preservados;
- mysql-data-sprint-23-11a preserva a descoberta FAILED da migration links 12:00;
- mysql-data-sprint-23-11a-2 foi preservado como evidencia historica superada: ele
  registrava checksum f4734764... para a reconciliation antes de o Prettier alterar os
  bytes do arquivo. Essa evidencia nao representa o catalogo final e nao foi reutilizada;
- mysql-data-sprint-23-11a-3 e a base final descartavel, criada em 2026-07-13 11:09:55;
- a execucao final concluiu em 2026-07-13 11:10:09, com shutdown normal do MySQL e sem
  processo orfao;
- aplicacao final: 14/14 APPLIED;
- ledger final: APPLIED 14, APPLYING 0, FAILED 0; nao existe estado RUNNING no ledger
  canonico, e seu equivalente operacional APPLYING ficou em zero;
- checksum final da fundacao: 831c913c9670ac4b42bb2a62821379276acfdc55b516758be9746d7aed4bee0f;
- checksum final da reconciliation: 6af1b45c9de6726b4f38c9fef5992f48bd122f4f215797f86eddbe4dd03b8495;
- 23 tabelas canonicas inventariadas;
- 22 FKs inventariadas, incluindo enrollments -> people/person_profiles,
  class-links/agenda/recurrence -> j12_turmas e financial obligations -> enrollments;
- MySQL 8.4.9, bind 127.0.0.1:3307;
- portas 3000, 3101 e 3307 encerradas ao final do ensaio.

Evidencias sanitizadas estao em artifacts/e2e/: plano, inventarios antes/depois,
ledger, FKs e logs. Nenhum secret real foi gravado.

Na retomada, catalogo, ledger e arquivos foram correlacionados novamente. O ledger do
datadir 23-11a-3 contem exatamente os checksums atuais acima, e as 12 migrations
originais foram comparadas byte a byte com o HEAD: **12/12 intactas**. Por isso, a
evidencia integra existente foi aproveitada sem sobrescrever os datadirs 23-11a-2 ou
23-11a-3. O retry operacional registrado no datadir anterior nao e usado como evidencia
do conteudo final; idempotencia e fail-closed permanecem cobertos pelos testes offline.

### 9.1 Auditoria somente leitura apos a interrupcao

A retomada em HEAD `0eeeeab1c9e1cfc4b060e3ea8f33f241b8277848` classificou o comando
interrompido como **concluido validamente**, e nao como tentativa ausente, parcial ou
falha:

| Evidencia                        | Resultado atual                                                             |
| -------------------------------- | --------------------------------------------------------------------------- |
| Processos e portas               | nenhum `node`/`mysqld` e nenhum listener em 3000, 3101 ou 3307 na entrada   |
| Datadir `23-11a-3`               | 195 arquivos, 200.795.140 bytes; schema `j12_e2e_hml` materializado         |
| Log interno `mysql-e2e.err`      | ready em 3307, shutdown solicitado, `Normal shutdown` e `Shutdown complete` |
| Binlog interno `binlog.000001`   | 14 inserts APPLYING, 14 updates APPLIED e 0 transicao FAILED                |
| Working tree de migrations       | nenhum delta nas 14 migrations em relacao ao HEAD                           |
| Migrations historicas originais  | 12/12 checksums iguais aos valores fixos auditados                          |
| Necessidade de novo datadir `-4` | nenhuma; a evidencia final continuava integra e foi reutilizada             |

Os arquivos genericos `preflight.json`, `migration-plan.json`, inventories e
`migration-apply.stdout/stderr.log` em `artifacts/e2e/` foram atualizados novamente as
20:16 por uma execucao posterior sobre `mysql-data-sprint-23-11b`. Eles mostram o mesmo
catalogo atual, 23 tabelas, 22 FKs, ledger 14/0/0 e stderr vazio, mas **nao** foram
reatribuidos ao datadir `23-11a-3`. Para o `-3`, a prova atual usa somente seu log
interno, seu binlog imutavel, os hashes atuais e o inventario final registrado antes da
sobrescrita dos nomes genericos.

### 9.2 Checksums finais confirmados pelo binlog do datadir `23-11a-3`

| Migration                                                        | SHA-256                                                          |
| ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| 20260712183000_create_people_domain_tables                       | 0dfbca2723adac1d906769e1bd12b40ca9d486fafdab2a03529fffc6945609d3 |
| 20260629134546_create_enrollments_table                          | 0f0e8a713af0b20138519b007d24dbc5d7ddf55b4ea4f230be14bd2bf1609115 |
| 20260629190607_add_active_draft_unique_constraint_to_enrollments | 67e96a77c32e2477c7b23ee58eccb651bc72e07a222e0a77b4e4a91a2c524b1a |
| 20260629232350_add_enrollment_confirmation_audit_columns         | e0c4cb886c96690c1c5b1ea27f209b56869573553a89351a672608d411f8510c |
| 20260713100000_create_classes_foundation_table                   | 831c913c9670ac4b42bb2a62821379276acfdc55b516758be9746d7aed4bee0f |
| 20260701103000_add_enrollment_class_links_table                  | c409b99ec23ca23ccc044a7da1d73abc160f4aa329799fefabaa389307c7f96e |
| 20260713101500_reconcile_enrollment_class_links_indexes          | 6af1b45c9de6726b4f38c9fef5992f48bd122f4f215797f86eddbe4dd03b8495 |
| 20260701120000_add_enrollment_class_links_table                  | d18f38c57747459782c7ca20220fb520f3fff50ee4e743df0d44588d40debb70 |
| 20260702120000_create_enrollment_financial_obligations_table     | a12c5e6af7b0441951fc9d9b1586c842b321e93701f053ee9b3e3e945659cf92 |
| 20260702133000_create_enrollment_agenda_items_table              | 6cd128d59b6169e16a46d91219ccd2c92d16db2754acbf33bd6bae5a85c41c8e |
| 20260703130000_create_agenda_recurrence_tables                   | be981acab4de5c2c735b0de1bcafb6d49396608cae712eb9f8e66f6dabc8c8a3 |
| 20260703143000_create_agenda_notification_tables                 | b83fcbd0edb59fd3e0369d46a9a1db8cbb0274a952902ac1b12fb082e398eb50 |
| 20260709220000_create_financial_automation_execution_history     | 388b17b35800a0feb280ef6c7e8699bda99392532ed7749184443c541732d27f |
| 20260712184500_create_auth_runtime_tables                        | c50b48b4c2072991a8b135240fd97ca535889a2cf5d5b0f3dabab16723cd875e |

## 10. Retomada da Sprint 23.11

Com schema valido, o harness iniciou API em 127.0.0.1:3101, confirmou /ready 200,
iniciou Vite em 127.0.0.1:3000 e executou Chromium. Foi corrigido um reload loop local:
o Vite observava artifacts/e2e enquanto Playwright escrevia o relatorio. O diretorio
agora e ignorado pelo watcher.

O placeholder antigo foi removido. J01 autentica de verdade admin@j12.com com senha
efemera gerada pelo runner, confirma redirect /dashboard e ausencia de request externo.
O Playwright abaixo pertence ao ensaio anterior preservado, encerrado antes da
estabilizacao final do checksum da reconciliation; ele nao e usado como prova do ledger
final do datadir 23-11a-3. Resultado historico preservado:

| Estado       | Total |
| ------------ | ----: |
| PASS         |     1 |
| FAIL         |     0 |
| BLOCKED      |    20 |
| NOT_EXECUTED |     0 |
| Total        |    21 |

As 20 jornadas restantes nao usam mais o bloqueio de migration. Elas estao BLOCKED pela
ausencia de fixture sintetica e assertions de mutation especificas para cada fluxo.
Nao foram promovidas a PASS por simples navegacao. J01 possui execucao browser/API/DB
real local. O relatorio JSON/HTML foi atualizado; esse ensaio passou em 24,4 s.
Traces, screenshot e video das duas tentativas intermediarias J01 foram preservados.
Nao houve request externa inesperada no teste aprovado.

## 11. Bugs, limitacoes e riscos residuais

- O catalogo historico continha duas migrations de class-links com contratos diferentes;
  a ponte aditiva resolve o indice sem apagar o historico.
- Um banco com registro FAILED continua exigindo recuperacao manual; comportamento
  intencional e fail-closed.
- A adocao de schema legado valida o necessario, mas nao equivale a uma ferramenta geral
  de drift/baseline.
- As 20 jornadas funcionais restantes precisam de fixture e assertions por dominio; a
  Sprint 23.11 segue parcialmente concluida.
- Nginx, PM2, VPS, HML externa e producao nao foram testados nem acessados.
- O working tree atual contem alteracoes posteriores da Sprint 23.11B. O ESLint
  ampliado encontrou 43 erros de formatacao Prettier em seis arquivos desse trabalho
  posterior; eles nao foram alterados nesta retomada por estarem fora do escopo 23.11A.

## 12. Gates finais

Resultados devem ser lidos como contratos locais; testes que carregam db.js usam alvo
127.0.0.1:1 invalido, exceto o ensaio E2E explicitamente isolado em 3307.

A tabela abaixo preserva o fechamento originalmente versionado. A subsecao 12.1
registra e prevalece como a validacao atual executada nesta retomada.

| Gate                      | Resultado                                    |
| ------------------------- | -------------------------------------------- |
| Testes especificos 23.11A | PASS 30/30 dentro da suite focada            |
| Focados + harness 23.11   | PASS 37/37                                   |
| Contratos CI/deploy       | PASS 12/12                                   |
| Contratos migrations      | PASS 29/29                                   |
| Seguranca                 | PASS 34/34                                   |
| Backend completo          | PASS 617/617                                 |
| Frontend completo         | PASS 78/78                                   |
| Secret scanner            | PASS; 1.629 arquivos, 0 findings             |
| Baseline ESLint           | PASS; 668 historicos, 0 warnings/regressoes  |
| ESLint focado             | PASS                                         |
| Prettier focado           | PASS                                         |
| Build Client/SSR          | PASS; comando canonico encerrou com codigo 0 |
| git diff --check          | PASS; somente avisos de conversao LF/CRLF    |
| MySQL base nova           | PASS 14/14 APPLIED no datadir 23-11a-3       |
| Ledger final              | PASS; APPLIED 14, APPLYING 0, FAILED 0       |
| Retry idempotente         | PASS offline; ensaio final nao sobrescrito   |
| Browser 23.11             | Historico: PASS 1, FAIL 0, BLOCKED 20        |

### 12.1 Validacao atual desta retomada

| Gate                            | Resultado atual                                                   |
| ------------------------------- | ----------------------------------------------------------------- |
| Dry-run canonico                | PASS; 14 PENDING em ordem dependency-first, zero acesso a DB      |
| Focados 23.11A + harness        | PASS 37/37                                                        |
| Contratos CI/deploy             | PASS 12/12                                                        |
| Contratos migrations            | PASS 38/38                                                        |
| Seguranca                       | PASS 34/34                                                        |
| Backend completo                | PASS 622/622                                                      |
| Frontend completo               | PASS 78/78                                                        |
| Secret scanner                  | PASS; 1.635 arquivos, 0 findings                                  |
| Build Client                    | PASS; 3.737 modulos, 27,98 s                                      |
| Build SSR                       | PASS; 449 modulos, 8,95 s                                         |
| ESLint nucleo 23.11A            | PASS nos 9 arquivos-fonte da remediacao                           |
| Prettier 23.11A                 | PASS nos 9 fontes, README e este relatorio                        |
| ESLint ampliado do working tree | 43 erros Prettier em 6 arquivos posteriores, fora do escopo A     |
| Baseline ESLint global          | timeout em 10 min; os 2 processos locais remanescentes encerrados |
| git diff --check                | PASS apos a atualizacao final do relatorio                        |
| MySQL base nova                 | PASS 14/14 APPLIED no datadir preservado `23-11a-3`               |
| Ledger pelo binlog              | PASS; 14 APPLYING, 14 APPLIED e 0 FAILED                          |
| Migrations originais            | PASS; 12/12 bytes e checksums intactos                            |
| Browser 23.11                   | nao reexecutado; resultado historico preservado                   |

O timeout do baseline global nao foi convertido em PASS. O PASS de ESLint/Prettier
desta sprint e estritamente o escopo 23.11A; a pendencia posterior permanece visivel
sem contaminar a conclusao funcional da remediacao de migrations.

## 13. Arquivos

Alterados nesta sprint:

- backend/src/database/migration-runner/migration-catalog.js
- backend/src/database/migration-runner/canonical-migration-runner.js
- backend/src/database/migration-runner/canonical-migration-runner.test.js
- backend/src/database/migration-runner/README.md
- scripts/e2e/sprint-23-11-runner.cjs
- scripts/e2e/sprint-23-11-contract.test.cjs
- vite.config.ts
- docs/AUDIT/SPRINT_23_11_BROWSER_E2E_VALIDATION.md

Criados:

- backend/src/database/migration-runner/migration-dependencies.js
- backend/src/database/migration-runner/migration-topology.test.js
- backend/src/database/migrations/20260713100000_create_classes_foundation_table.js
- backend/src/database/migrations/20260713101500_reconcile_enrollment_class_links_indexes.js
- backend/src/database/migration-runner/create-classes-foundation.test.js
- backend/src/database/migration-runner/reconcile-class-links-indexes.test.js
- e2e/sprint-23-11/journeys.spec.cjs
- este relatorio.

Removido/substituido:

- e2e/sprint-23-11/journeys.blocked.spec.cjs, placeholder substituido pela suite real
  parcial. Nenhuma funcionalidade de produto foi removida.

Nesta retomada apos a interrupcao, somente
`docs/AUDIT/SPRINT_23_11A_MIGRATION_DEPENDENCY_REMEDIATION.md` foi alterado.
Nenhum arquivo de codigo, teste ou migration recebeu nova modificacao.

## 14. Classificacao

Sprint 23.11A: **CONCLUIDA** quanto ao objetivo de migrations. Causa raiz corrigida,
topologia valida, 14 migrations aplicadas realmente em banco descartavel, ledger limpo,
retry idempotente e checksums historicos preservados.

Percentual funcional real da Sprint 23.11A: **100%** do objetivo de remediacao de
migrations. Esse percentual nao declara o working tree inteiro livre de pendencias:
os erros de formatacao posteriores e fora do escopo permanecem reportados no gate
ampliado.

Sprint 23.11: **PARCIALMENTE CONCLUIDA**. Runtime e browser foram desbloqueados e J01
passou; 20 jornadas continuam BLOCKED por trabalho funcional E2E nao pertencente a
remediacao topologica.

Nenhum commit, push, tag, merge, deploy, SSH, banco externo ou integracao externa foi
realizado.

## 15. Estado Git final

- Branch sprint-23.
- HEAD 6e11006fc4aee926e105e8d4a0c00e7388ae7911, inalterado.
- Divergencia: 0 behind/2 ahead de origin/sprint-23.
- Staged: nenhum.
- Modified tracked: .gitignore, quatro arquivos do runner, package-lock.json,
  package.json e vite.config.ts. Os arquivos de sprints anteriores foram preservados.
- Untracked: entregas 23.10, 23.11 e os oito arquivos novos 23.11A listados acima.
- Ignored: artifacts/e2e/ com todos os datadirs e evidencias preservados.
- Commit/push/tag: nenhum.

### 15.1 Estado Git desta retomada

- Branch: `sprint-23`.
- HEAD: `0eeeeab1c9e1cfc4b060e3ea8f33f241b8277848`, ja existente na entrada.
- Relacao com `origin/sprint-23`: up to date.
- Staged: nenhum.
- Modified tracked: 15 ao final, sendo 14 alteracoes preexistentes preservadas e este
  relatorio atualizado.
- Untracked: 6 entregas preexistentes preservadas.
- Migrations e migration-runner: nenhum delta em relacao ao HEAD.
- Ignored: `artifacts/e2e/` preservado, inclusive todos os datadirs anteriores e o
  datadir final `mysql-data-sprint-23-11a-3`.
- Processos finais: nenhum `node`/`mysqld`; sem listeners em 3000, 3101 ou 3307.
- Nenhum novo commit, push, tag, deploy, acesso externo ou descarte foi realizado nesta
  retomada.
