# Sprint 23.11B - Browser E2E Completion

Data de fechamento: 2026-07-15
Ambiente: somente local, isolado e descartavel
Decisao: SPRINT 23.11B CONCLUIDA - 21/21 Browser E2E PASS - 100% funcional no escopo

## Checkpoint e preservacao

- Branch: sprint-23
- HEAD: 0eeeeab1c9e1cfc4b060e3ea8f33f241b8277848
- Staging inicial e final: vazio.
- O working tree ja continha alteracoes locais de 23.11, 23.11A e 23.11B. Nenhuma foi descartada, revertida ou sobrescrita.
- A evidencia da Sprint 23.11A, inclusive docs/AUDIT/SPRINT_23_11A_MIGRATION_DEPENDENCY_REMEDIATION.md, foi preservada.
- Nenhuma migration historica foi alterada.
- Nenhum commit, push, tag, merge, rebase, deploy ou acesso a producao foi executado.
- Banco Inter, Pix real, n8n real, webhooks externos e transacoes financeiras reais permaneceram fora do escopo.

## Evolucao historica da conclusao Browser E2E

### Marco inicial - 13/21 PASS - 61,9%

O checkpoint inicial registrava 13 jornadas aprovadas e oito jornadas ainda com falha.
Totais daquele marco: PASS 13, FAIL 8, BLOCKED 0, NOT_EXECUTED 0.

### Marco intermediario - 18/21 PASS - 85,7%

PASS: J01-J10 e J14-J21.
FAIL: J11, J12 e J13.
BLOCKED: 0.
NOT_EXECUTED: 0.

Causas registradas naquele momento:

- J11: a rota retornava a tela anterior e nao emitia a requisicao esperada.
- J12/J13: o fluxo relacionado a /admin/bi/financeiro nao completava corretamente a navegacao e as requisicoes esperadas.

### Marco final - 21/21 PASS - 100%

O marco final foi executado pelo caminho isolado artifacts/e2e/runs/sprint-23-11b-final-11.
Totais finais desse marco: PASS 21, FAIL 0, BLOCKED 0, NOT_EXECUTED 0.

## Diagnostico e correcoes

### J11 - historico persistido

Falha: a rota filha /admin/financeiro/automacoes/historico era registrada abaixo de /admin/financeiro, mas o componente pai nao renderizava Outlet. A URL mudava sem montar a tela filha e a requisicao de historico nao era executada.

Correcao: src/routes/admin/financeiro.tsx passou a renderizar Outlet para rotas filhas, mantendo a pagina protegida original em /admin/financeiro.

Resultado: PASS em execucao Browser E2E real, com registro persistido, status e workflow assertados.

### J12 - consulta de historico

Falha: a mesma ausencia de Outlet impedia a montagem da tela filha e dos detalhes GET por historyId/executionId.

Correcao: a mesma composicao Outlet em src/routes/admin/financeiro.tsx, sem alterar contrato de API nem enfraquecer assertions.

Resultado: PASS em execucao Browser E2E real, com timeline e metadata sanitizada assertadas.

### J13 - BI financeiro

Falhas: comparacoes de unidade em collations diferentes causavam ER_CANT_AGGREGATE_2COLLATIONS; GROUP BY de payment method falhava sob only_full_group_by; a consulta de evidencia usava aliases incompletos de cancelamento e uma janela ate LAST_DAY, diferente do CURRENT_MONTH efetivo da API.

Correcoes:

- backend/src/domains/bi/infrastructure/repositories/mysql-bi-financial.repository.js usa CONVERT(... USING utf8mb4) COLLATE utf8mb4_unicode_ci nas comparacoes de unidade.
- Os GROUP BYs usam as expressoes dimensionais completas, compativeis com only_full_group_by.
- e2e/sprint-23-11/journeys.spec.cjs alinha a evidencia aos aliases cancelado/cancelada/canceled/cancelled/removida/removida_pelo_usuario_recebedor.
- A janela canonica usa o primeiro dia do mes ate CURRENT_DATE(), exatamente como o servico BI CURRENT_MONTH.
- A assertion continua exigindo soma real >= 231.10 e igualdade exata com data.kpis.expectedRevenue.value.

Resultado: PASS em execucao Browser E2E real. A resposta foi HTTP 200, a soma canonica foi nao vazia e o KPI coincidiu exatamente.

## Resultado individual das 21 jornadas

| Jornada                                           | Resultado |
| ------------------------------------------------- | --------- |
| J01 - Admin autentica                             | PASS      |
| J02 - Admin cria/consulta aluno                   | PASS      |
| J03 - Responsavel e vinculado                     | PASS      |
| J04 - Matricula e criada                          | PASS      |
| J05 - Aluno entra em turma                        | PASS      |
| J06 - Obrigacao financeira e gerada               | PASS      |
| J07 - Cobranca e criada ou simulada com seguranca | PASS      |
| J08 - Pagamento e processado ou simulado          | PASS      |
| J09 - Conciliacao atualiza status                 | PASS      |
| J10 - Automacao e executada                       | PASS      |
| J11 - Historico e persistido                      | PASS      |
| J12 - Admin consulta historico                    | PASS      |
| J13 - BI reflete dados                            | PASS      |
| J14 - Professor consulta turma                    | PASS      |
| J15 - Professor registra presenca                 | PASS      |
| J16 - Aluno consulta seus dados                   | PASS      |
| J17 - Responsavel consulta dependente             | PASS      |
| J18 - Reserva de quadra e criada                  | PASS      |
| J19 - Conflito de horario e impedido              | PASS      |
| J20 - Campeonato e criado                         | PASS      |
| J21 - Portal publico exibe campeonato             | PASS      |

Totais finais: PASS 21, FAIL 0, BLOCKED 0, NOT_EXECUTED 0.
Percentual funcional real: 100% (21/21).

Evidencia final: artifacts/e2e/runs/sprint-23-11b-final-11.
Execucoes intermediarias preservadas: sprint-23-11b-final, -2, -3, -4, -5, -6, -7, -8, -9 e -10. Nenhuma evidencia foi apagada.

## Oito falhas auditadas e correcoes

1. Automacao mensal sem historico append-only: criada a camada `financeiro-automation-history.service.js`, com execution_id, estados e persistencia usados por J10-J12.
2. Conflito entre rotas novas e legado financeiro: `backend/src/routes/financeiro.routes.js` monta o legado como fallback e `backend/src/server.js` usa o router compatível, preservando contratos existentes.
3. J11 sem montagem da rota filha: `src/routes/admin/financeiro.tsx` passou a renderizar `Outlet` fora da pagina raiz.
4. J12 sem montagem dos detalhes: o mesmo `Outlet` permite a lista e os endpoints de detalhe serem realmente executados.
5. BI financeiro sem composicao/protecao consistente: `src/routes/admin/bi.tsx` e `src/routes/admin/bi.financeiro.tsx` preservam `ProtectedRoute` e montam a tela filha.
6. LIMIT/OFFSET parametrizado rejeitado pelo MySQL 8.4: limites inteiros normalizados passaram a ser embutidos com seguranca nos repositorios de matriculas, obrigacoes, historico, campeonatos e quadras.
7. Cadastro publico podia enviar campos undefined ao mysql2: `public-enrollments.controller.js` agora normaliza idade, colegio, periodo, unidade e dias/horarios antes de persistir.
8. BI financeiro tinha divergencia SQL real: corrigidas collations de unidade, `only_full_group_by`, aliases de cancelamento e a janela `CURRENT_MONTH`; a assertion J13 compara a soma canonica >= 231.10 com o KPI exato.

## Gates executados

- Browser E2E final: PASS, 21/21 em 2.9 min, Chromium desktop, 1 worker.
- Teardown E2E: PASS; runner confirmou portas 3000, 3101 e 3307 livres.
- Testes BI focados (servico, repository, controller e router): PASS, 16/16.
- Contrato do runner: PASS, 4/4.
- Contrato de ambiente isolado: PASS, 4/4.
- ESLint escopado nos arquivos tocados/criados: PASS.
- Prettier --check nos arquivos tocados/criados: PASS.
- node --check da jornada Browser: PASS.
- git diff --check: PASS; somente avisos normais de conversao LF/CRLF, sem erro de whitespace.
- Build Client/SSR (npm run build): PASS; client e server gerados.
- Testes focados de quadras, financeiro, matriculas, campeonatos e historico: PASS, 27/27.
- Regressao backend ampla preservada da execucao anterior: 624/625; um teste legado de JWT apresentou flake isolado. O rerun isolado do caso alterado passou 5/5. Nenhum teste legado foi modificado.
- ESLint baseline global: TIMEOUT historico conhecido; nao foi repetido por nao ser gate proporcional e por produzir ruido fora do escopo. O lint escopado passou.

## Arquivos modificados (tracked)

- backend/routes/financeiro.js
- backend/src/controllers/public-enrollments.controller.js
- backend/src/domains/bi/infrastructure/repositories/mysql-bi-financial.repository.js
- backend/src/domains/campeonatos/infrastructure/repositories/mysql-championship-public.repository.js
- backend/src/domains/campeonatos/infrastructure/repositories/mysql-championship.repository.js
- backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment.repository.js
- backend/src/domains/financeiro/infrastructure/repositories/mysql-automation-execution-history.repository.js
- backend/src/domains/financeiro/infrastructure/repositories/mysql-enrollment-financial-obligation.repository.js
- backend/src/domains/financeiro/infrastructure/repositories/mysql-enrollment-financial-obligation.repository.test.js
- backend/src/domains/financeiro/infrastructure/repositories/tests/mysql-automation-execution-history.repository.test.js
- backend/src/domains/quadras/application/services/court-rental.service.js
- backend/src/domains/quadras/application/tests/court-rental.service.test.js
- backend/src/routes/financeiro.routes.js
- backend/src/server.js
- docs/AUDIT/SPRINT_23_11A_MIGRATION_DEPENDENCY_REMEDIATION.md (evidencia 23.11A preservada)
- e2e/sprint-23-11/journeys.spec.cjs
- playwright.config.cjs
- scripts/e2e/sprint-23-11-contract.test.cjs
- scripts/e2e/sprint-23-11-runner.cjs
- src/components/alunos/AlunoFormDialog.tsx
- src/routes/admin/bi.financeiro.tsx
- src/routes/admin/bi.tsx
- src/routes/admin/financeiro.tsx

## Arquivos criados (untracked)

- backend/src/domains/campeonatos/infrastructure/repositories/tests/mysql-championship-pagination.repository.test.js
- backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment.repository.test.js
- backend/src/services/financeiro-automation-history.service.js
- backend/src/services/tests/financeiro-automation-history.service.test.js
- docs/AUDIT/SPRINT_23_11B_BROWSER_E2E_COMPLETION.md
- scripts/e2e/sprint-23-11-fixtures.cjs

## Limitacoes e riscos remanescentes

- O Browser E2E prova o perfil local isolado e dados sinteticos; nao prova disponibilidade, credenciais ou comportamento de producao.
- O teste backend amplo continua com um flake legado de JWT documentado; ele nao afetou os gates focados nem as 21 jornadas.
- Avisos LF/CRLF do Git sao apenas normalizacao de working tree, sem falha de diff.
- Nenhuma porta local permaneceu ocupada ao final.

## Estado Git final e proximo passo

- Branch final: sprint-23
- HEAD final: 0eeeeab1c9e1cfc4b060e3ea8f33f241b8277848
- Staging final: vazio
- Todas as alteracoes permanecem preservadas no working tree para auditoria e autorizacao posterior.
- A Sprint 23.11B foi encerrada formalmente. Nao avancar para a Sprint seguinte nesta retomada.

Comandos Git recomendados, nao executados:

git status --short --untracked-files=all
git diff --check
git diff --stat
git diff --cached --stat
