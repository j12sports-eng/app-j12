# Sprint 23.11 - Validacao browser E2E

Data: 2026-07-13.

## Leitura temporal obrigatoria

Este relatorio preserva duas evidencias de momentos diferentes. Os resultados nao devem
ser combinados nem apresentados como se pertencessem a uma unica execucao.

### Resultado original da Sprint 23.11, antes da remediacao 23.11A

- 21 jornadas foram enumeradas;
- PASS 0; FAIL 0; BLOCKED 21; NOT_EXECUTED 0;
- o bloqueador original foi `ER_FK_CANNOT_OPEN_PARENT`, causado pela ordem canonica das
  migrations, que tentou criar FKs de `enrollments` antes das tabelas parent
  `people`/`person_profiles`;
- API e frontend nao foram iniciados apos a falha da migration; consequentemente,
  nenhuma jornada reuniu browser, API e banco nesse momento.

Esse e o resultado original auditavel da Sprint 23.11. A matriz, o resumo e os gates
originais preservados nas secoes abaixo devem ser lidos nesse contexto.

### Resultado historico posterior, apos a remediacao da Sprint 23.11A

A Sprint 23.11A corrigiu a topologia de forma aditiva, com dependencias explicitas e
duas migrations novas. As 12 migrations originais foram preservadas, inclusive seus
IDs, bytes e checksums.

Depois dessa remediacao houve evidencia historica posterior de outra execucao: total 21;
PASS 1, correspondente a J01 (login admin real); FAIL 0; BLOCKED 20; NOT_EXECUTED 0. As
20 jornadas restantes ficaram bloqueadas pela ausencia de fixtures sinteticas e
assertions funcionais especificas, e nao mais pela topologia de migrations. Elas nao
foram promovidas a PASS por navegacao superficial.

Essa execucao posterior nao altera nem reclassifica retroativamente o resultado original
de 0 PASS / 21 BLOCKED da Sprint 23.11. Conforme o relatorio da Sprint 23.11A, o ensaio
Playwright de 1 PASS / 20 BLOCKED terminou antes da estabilizacao final do checksum da
migration de reconciliation. Por isso, ele tambem nao deve ser usado como prova do
ledger final da execucao MySQL definitiva no datadir `23-11a-3`; a validacao desse ledger
pertence exclusivamente as evidencias especificas documentadas pela Sprint 23.11A.

## 1. Objetivo e decisao

Retomar a validacao das 21 jornadas canonicas com Playwright, Chromium, API e MySQL
descartavel exclusivamente locais. No fechamento original da Sprint 23.11, o resultado
foi **SPRINT PARCIALMENTE PREPARADA E BLOQUEADA**. Nenhuma jornada recebeu PASS sem
browser, API e banco integrados.

## 2. Estado inicial e checkpoint

- Branch encontrada: `sprint-23`.
- HEAD inicial: `6e11006fc4aee926e105e8d4a0c00e7388ae7911`.
- Divergencia inicial: 0 behind / 2 ahead de `origin/sprint-23`.
- Staging: vazio.
- Portas 3000, 3001, 3002, 4173, 4174 e 3307: livres.
- Nenhum processo Node ou mysqld ativo.
- Playwright, Chromium e um datadir E2E existiam; config e testes Playwright nao existiam.
- Logs anteriores provam que MySQL 3307, API 3101 e Vite 3000 chegaram a iniciar e ficar
  ready, mas nao havia trace, screenshot, video, HTML, JSON ou resultado de jornada.

Classificacao inicial real: **D - runtime iniciado anteriormente, jornadas nao
executadas**. A interrupcao ocorreu depois de um smoke de runtime e antes da criacao e
execucao da suite browser.

## 3. Separacao Sprint 23.10 x 23.11

| Arquivo/hunk                                        | Sprint | Evidencia                               |
| --------------------------------------------------- | ------ | --------------------------------------- |
| `.gitignore` com `artifacts/`                       | 23.10  | suporte a artefatos dos quality gates   |
| scripts `ci:*` de `package.json`                    | 23.10  | pipeline e baseline progressivo         |
| `.ci/`, `.github/`, `scripts/ci/` e relatorio 23.10 | 23.10  | permanecem preservados e untracked      |
| `@playwright/test ^1.61.1`                          | 23.11  | unica dependencia nova                  |
| 64 linhas do `package-lock.json`                    | 23.11  | Playwright, core e dependencia opcional |
| scripts `e2e:23.11:*`                               | 23.11  | harness local desta retomada            |

Nenhum arquivo da 23.10 foi commitado, removido ou sobrescrito.

## 4. Arquitetura E2E preparada

```text
preflight fail-closed
  -> dry-run offline das migrations
  -> MySQL 8.4 local 127.0.0.1:3307
  -> migrations com confirmacao exata (somente opcao explicita)
  -> API 127.0.0.1:3101
  -> Vite 127.0.0.1:3000
  -> Playwright Chromium, 1 worker
  -> JSON + HTML + trace/screenshot/video somente quando aplicavel
```

O modo `inspect` nunca aplica migrations. O modo `local` explicita
`--apply-local-migrations`; nao existe acesso remoto nem `--allow-remote`.

## 5. Guardrails de isolamento

O preflight exige `J12_ENVIRONMENT=e2e-local`, `HML_ISOLATED=true`,
`NODE_ENV` nao produtivo, banco exato `127.0.0.1:3307/j12_e2e_hml`, API 3101 e
frontend 3000 em HTTP loopback. Banco Inter, Pix, certificados, webhook, n8n, Resend e
BotConversa devem estar vazios/desabilitados. URLs remotas, SSL de banco, secrets
outbound e credenciais embutidas em URL sao rejeitados.

As regressions completas foram executadas com DB forcado para `127.0.0.1:1`, evitando
o banco remoto presente no `.env`.

## 6. Playwright e Chromium

- Declarado, locked e instalado: `@playwright/test 1.61.1`.
- Cache comprovado: `chromium-1228`, `chromium_headless_shell-1228`,
  `ffmpeg-1011` e `winldd-1007`.
- Config: Chromium desktop, 1 worker, sem retry, traces/screenshots/videos retidos em
  falha e reporters line/JSON/HTML sob `artifacts/e2e/playwright`.
- Execucao original desta sprint: 21 casos enumerados e corretamente skipped como BLOCKED;
  nenhuma pagina foi aberta e isso nao foi promovido a E2E real.

## 7. MySQL descartavel

O datadir anterior `artifacts/e2e/mysql-data` foi preservado. Ele contem o schema
`j12_e2e_hml`, mas root exige credencial desconhecida; nao houve tentativa de adivinhar
senha, `skip-grant-tables`, reset ou exclusao.

Foi criado um datadir irmao `artifacts/e2e/mysql-data-sprint-23-11`, inicializado
localmente. A identidade e o alvo foram comprovados antes de qualquer mutation. A porta
3307 foi liberada apos cada tentativa.

## 8. Migrations e bloqueador original

O dry-run offline listou 12 migrations PENDING. A aplicacao local, com confirmacao exata,
falhou fechada na primeira migration:

- `20260629134546_create_enrollments_table.sql` cria FKs para `people`;
- `people` so e criada depois, por
  `20260712183000_create_people_domain_tables.sql`;
- MySQL retornou `ER_FK_CANNOT_OPEN_PARENT` / errno 1824;
- o ledger registrou FAILED e interrompeu a sequencia;
- 0 das 12 migrations de dominio foram aplicadas com sucesso;
- API, frontend, seed e browser nao foram iniciados.

Nao foi feito reordenamento de IDs, alteracao de checksum, baseline artificial, DDL ad
hoc ou bootstrap de runtime para contornar o runner canonico.

## 9. Dados sinteticos

O catalogo reserva prefixo `[E2E-SYNTHETIC]`, dominio `example.test` e contatos nao
roteaveis. Nenhum dado pessoal real foi copiado. Como o schema falhou antes do runtime,
nenhuma fixture sintetica foi inserida.

## 10. Matriz completa das jornadas na execucao original

Na execucao original, todas compartilharam o bloqueador de ordem das migrations.
Resultado observado:
`ER_FK_CANNOT_OPEN_PARENT` antes da API; evidencias: plano, stderr da aplicacao e JSON
Playwright ignorados pelo Git.

| ID  | Jornada                         | Role        | Rota principal                           | Pre-condicoes     | Esperado                   | Status  |
| --- | ------------------------------- | ----------- | ---------------------------------------- | ----------------- | -------------------------- | ------- |
| J01 | Admin autentica                 | admin       | `/login`                                 | usuario sintetico | sessao e redirect          | BLOCKED |
| J02 | Admin cria/consulta aluno       | admin       | `/alunos`                                | J01               | aluno persistido           | BLOCKED |
| J03 | Responsavel e vinculado         | admin       | `/alunos`                                | J02               | vinculo sem acesso cruzado | BLOCKED |
| J04 | Matricula e criada              | admin       | `/admin/enrollments`                     | J02-J03           | matricula persistida       | BLOCKED |
| J05 | Aluno entra em turma            | admin       | `/turmas`                                | J04               | vinculo persistido         | BLOCKED |
| J06 | Obrigacao financeira e gerada   | admin       | `/admin/financeiro`                      | J04               | obrigacao unica            | BLOCKED |
| J07 | Cobranca criada/simulada segura | admin       | `/admin/financeiro`                      | J06               | cobranca local idempotente | BLOCKED |
| J08 | Pagamento processado/simulado   | admin       | `/admin/financeiro`                      | J07               | sem provedor externo       | BLOCKED |
| J09 | Conciliacao atualiza status     | admin       | `/admin/financeiro`                      | J08               | status coerente            | BLOCKED |
| J10 | Automacao e executada           | admin       | `/admin/financeiro`                      | J07               | local, auditada, sem n8n   | BLOCKED |
| J11 | Historico e persistido          | admin       | `/admin/financeiro/automacoes/historico` | J10               | evento persistido          | BLOCKED |
| J12 | Admin consulta historico        | admin       | mesma                                    | J11               | historico renderizado      | BLOCKED |
| J13 | BI reflete dados                | admin       | `/admin/bi`                              | J02/J06/J09       | KPIs coerentes             | BLOCKED |
| J14 | Professor consulta turma        | professor   | `/professor/presencas`                   | J05               | somente turma atribuida    | BLOCKED |
| J15 | Professor registra presenca     | professor   | mesma                                    | J14               | presenca persistida        | BLOCKED |
| J16 | Aluno consulta seus dados       | aluno       | `/portal-aluno/dashboard`                | J02/J04           | escopo da sessao           | BLOCKED |
| J17 | Responsavel consulta dependente | responsavel | `/portal-responsavel/dashboard`          | J03               | somente vinculado          | BLOCKED |
| J18 | Reserva de quadra e criada      | admin       | `/admin/quadras`                         | J01               | reserva persistida         | BLOCKED |
| J19 | Conflito de horario impedido    | admin       | `/admin/quadras`                         | J18               | conflito rejeitado         | BLOCKED |
| J20 | Campeonato e criado             | admin       | `/admin/campeonatos`                     | J01               | campeonato persistido      | BLOCKED |
| J21 | Portal publico exibe campeonato | public      | `/campeonatos`                           | J20               | publicado sem PII          | BLOCKED |

Resumo: total 21; PASS 0; FAIL 0; BLOCKED 21; NOT_EXECUTED 0. O status
NOT_EXECUTED nao foi usado porque todos os casos foram enumerados pelo Playwright e
receberam explicitamente o mesmo bloqueador comprovado.

## 11. Evidencias

Sob `artifacts/e2e/` (ignorado pelo Git):

- `preflight.json`;
- `migration-plan.json`;
- `database-inventory-before.json`;
- `migration-apply.stdout.log` e `migration-apply.stderr.log`;
- logs sanitizados de inicializacao MySQL;
- `playwright/results.json` e relatorio HTML.

Nao existem screenshots, traces ou videos desta rodada porque nenhuma jornada abriu o
browser. Nao ha secrets reais nos artefatos.

## 12. Falhas encontradas e correcoes

| Item                                                | Severidade              | Tratamento                                                     |
| --------------------------------------------------- | ----------------------- | -------------------------------------------------------------- |
| Ordem canonica referencia `people` antes de cria-la | P0 para banco vazio/E2E | documentado; falha fechada preservada                          |
| Datadir anterior sem credencial root recuperavel    | bloqueio local          | preservado; novo datadir irmao criado                          |
| Harness E2E inexistente                             | P2                      | config, preflight, runner, catalogo e evidencias implementados |
| Execucao automatica de migration seria perigosa     | P1                      | inspect sem apply; apply exige flag explicita                  |

Nao foi alterada nenhuma migration nesta sprint. A correcao exige uma decisao de
compatibilidade para bancos onde checksums/IDs possam ja estar aplicados; alterar a
migration existente aqui seria inseguro.

## 13. Limitacoes

- O schema vazio nao pode ser construido pelo catalogo atual na ordem canonica.
- O datadir antigo nao possui credencial root recuperavel nos artefatos.
- Nenhuma jornada reuniu browser + API + banco; logo 0% de E2E funcional foi comprovado.
- Banco Inter, Pix, webhook, n8n, e-mail, HML externa e producao permaneceram
  deliberadamente desabilitados/inacessados.
- O relatorio HTML Playwright mostra casos bloqueados, nao aceite funcional.

## 14. Gates finais

| Gate                       | Resultado                                            |
| -------------------------- | ---------------------------------------------------- |
| Contratos do harness 23.11 | PASS 6/6                                             |
| Playwright 23.11 original   | BLOCKED 21/21; PASS 0; FAIL 0                         |
| Playwright posterior 23.11A | HISTORICO: PASS 1; BLOCKED 20; nao prova ledger final |
| CI/deploy                  | PASS 12/12                                           |
| Contratos de migrations    | PASS 19/19                                           |
| Seguranca                  | PASS 34/34                                           |
| Backend completo           | PASS 598/598 com DB fail-closed em 127.0.0.1:1       |
| Frontend completo          | PASS 78/78                                           |
| Secret scanner             | PASS; 1.622 arquivos; 0 findings                     |
| Baseline ESLint            | PASS; 668 erros historicos, 0 warnings, 0 regressoes |
| ESLint focado              | PASS                                                 |
| Prettier focado            | PASS                                                 |
| Build Client/SSR           | PASS, exit code 0                                    |
| `git diff --check`         | PASS no fechamento                                   |

Os contratos e testes que importam o adaptador de banco receberam override local
fail-closed. Nenhuma conexao ao host remoto do `.env` foi autorizada.

## 15. Arquivos da Sprint 23.11

Alterados:

- `package.json`: dependencia Playwright preexistente da interrupcao e comandos E2E;
- `package-lock.json`: lock do Playwright 1.61.1, preexistente da interrupcao.

Criados:

- `playwright.config.cjs`;
- `scripts/e2e/sprint-23-11-environment.cjs`;
- `scripts/e2e/sprint-23-11-environment.test.cjs`;
- `scripts/e2e/sprint-23-11-preflight.cjs`;
- `scripts/e2e/sprint-23-11-runner.cjs`;
- `scripts/e2e/sprint-23-11-contract.test.cjs`;
- `e2e/sprint-23-11/journey-catalog.cjs`;
- `e2e/sprint-23-11/journeys.blocked.spec.cjs`;
- este relatorio.

Artefatos ignorados: dois datadirs locais, logs, inventario, plano, JSON/HTML Playwright
e evidencia da falha.

## 16. Estado no fechamento original da Sprint 23.11

Classificacao naquele fechamento: **parcialmente concluida e bloqueada**. A infraestrutura E2E
fail-closed, o catalogo das 21 jornadas e a evidencia estruturada foram preparados e
validados. Naquele momento, a execucao funcional permanecia bloqueada pela ordem
inconsistente das migrations. O proximo passo entao registrado era definir uma solucao
de fundacao/compatibilidade que preservasse IDs e checksums ja aplicados; a remediacao
aditiva posterior e seus resultados estao separados no inicio deste relatorio e no
relatorio especifico da Sprint 23.11A.

Nao houve commit, push, tag, merge, deploy, SSH, VPS, producao, HML externa, banco
externo ou integracao externa.

## 17. Estado Git no fechamento original da Sprint 23.11

- Branch: `sprint-23`.
- HEAD: `6e11006fc4aee926e105e8d4a0c00e7388ae7911`.
- Divergencia: 0 behind / 2 ahead de `origin/sprint-23`.
- Staged: nenhum.
- Modified tracked: `.gitignore`, `package-lock.json` e `package.json`.
- Untracked: entregas preservadas da 23.10 e os nove arquivos versionaveis da 23.11
  listados acima.
- Ignored: `artifacts/e2e/`, incluindo ambos os datadirs e as evidencias.
- Commit/push/tag: nenhum nesta execucao.
