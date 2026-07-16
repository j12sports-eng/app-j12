# Sprint 23.15 - Reauditoria final da ponte financeira

Data: 2026-07-15  
Branch: `sprint-23`  
HEAD: `37928bb4e28407e7a58c37eee70880b8be1157bc`  
Decisao: **NO-GO**

## Resumo executivo

A implementacao das Sprints 23.13A, 23.13B, 23.13C, 23.13D e 23.14 esta conectada no codigo e cobre Enrollment -> Financial Obligation -> Financial Bridge -> Charge -> Installment -> Payment -> Settlement -> BI. Identidade, materializacao, conciliacao e baixa unificada possuem testes de transacao, rollback, retry, concorrencia, idempotencia e propagacao de estados.

Os gates unitarios, integrados e estaticos passaram. Contudo, a migration nova da bridge falhou ao ser aplicada pelo runner canonico em um MySQL local descartavel. Os testes simulados nao bastam para classificar a ponte como implantavel. O P0 financeiro permanece parcial e nao liberado, alem dos P0 externos de restore e credenciais historicas. A decisao e **NO-GO**.

Nenhum codigo de producao, migration, infraestrutura ou Browser E2E foi alterado nesta reauditoria. Nenhuma integracao externa foi acessada.

## Checkpoint Git

| Item                  | Resultado                                     |
| --------------------- | --------------------------------------------- |
| Branch                | `sprint-23`                                   |
| HEAD                  | `37928bb4e28407e7a58c37eee70880b8be1157bc`    |
| Origin                | alinhado; divergencia `0 0`                   |
| Working tree          | preservado: 8 modificados e 15 nao rastreados |
| Staging               | vazio                                         |
| Migrations historicas | nenhuma modificada; checksums aprovados 3/3   |
| `git diff --check`    | PASS; apenas avisos LF/CRLF                   |

## Arquitetura validada

- A identidade canonica resolve Enrollment, Person, Profile e `legacyStudentId` explicitamente e falha fechado em ausencia ou duplicidade.
- O application service compoe obligation, identity service, materializador legado e bridge repository; requires tardios evitam ciclo de inicializacao.
- O materializador reutiliza `student-finance`, sem copiar regras ou SQL de cobranca/mensalidade.
- O repository da obrigacao fornece conexao transacional escopada; bridge, charge e installment usam a mesma conexao.
- A conciliacao central atualiza payment, `j12_pagamentos`, bridge, obligation, charge e installment na mesma transacao.
- A baixa manual delega ao mesmo reconciliador da baixa automatica.
- Repositories e services novos tem referencias reais e testes; nenhum orfao foi encontrado.
- Rotas publicas nao foram alteradas; a rota financeira legada continua montada para compatibilidade.
- ESLint nao encontrou imports nao utilizados. A busca no escopo nao encontrou TODO, FIXME, HACK ou XXX.
- Nao foi encontrada duplicacao nova de regra. DDL/SQL legado fora do escopo permanece mitigado pela politica de runtime.

## Fluxos auditados

| Fluxo                       | Estado                  | Evidencia                                                  |
| --------------------------- | ----------------------- | ---------------------------------------------------------- |
| Identity                    | PASS                    | resolucao deterministica, inexistencia e duplicidade       |
| Financial Obligation        | PASS                    | criacao/reuso e transicoes protegidas                      |
| Financial Bridge repository | PASS simulado           | uniques, retry, concorrencia e rollback                    |
| Materialization             | PASS simulado           | criacao/reuso de charge e installment                      |
| Canonical Reconciliation    | PASS simulado           | PAID/PENDING/CANCELLED/OVERDUE/FAILED                      |
| Canonical Settlement        | PASS simulado           | manual e automatico no mesmo fluxo                         |
| Enrollment -> BI            | PASS integrado simulado | 12/12 cenarios                                             |
| Bridge migration em MySQL   | **FAIL**                | `MIGRATION_EXECUTION_FAILED` na migration `20260715143000` |

## Resultados dos gates

| Gate                        | Resultado                                                        |
| --------------------------- | ---------------------------------------------------------------- |
| Secret Scan                 | PASS - 1.651 arquivos, 0 findings                                |
| Contracts                   | PASS - 12/12                                                     |
| Migrations                  | PASS - 41/41                                                     |
| Migration Runner            | PASS - 17/17, incluindo dry-run, lock, retry e checksum          |
| Topology/Integrity          | PASS - 3/3, dependency-first e migrations historicas preservadas |
| Security                    | PASS - 34/34                                                     |
| Backend completo            | PASS - 686/686; 0 skipped                                        |
| Frontend completo           | PASS - 78/78; 0 skipped                                          |
| Ponte financeira focada     | PASS - 105/105; 0 skipped                                        |
| Integracao Enrollment -> BI | PASS - 12/12                                                     |
| Build Client                | PASS - 3.737 modulos                                             |
| Build SSR                   | PASS - 449 modulos                                               |
| `node --check`              | PASS em todo JavaScript alterado/novo                            |
| Prettier                    | PASS no escopo alterado/novo                                     |
| ESLint escopado             | PASS                                                             |
| `git diff --check`          | PASS                                                             |

Warnings do build: imports nao utilizados foram reportados somente em dependencias TanStack dentro de `node_modules`. Warnings LF/CRLF sao informativos.

## Browser E2E

Conforme instrucao, as jornadas nao foram repetidas nesta consolidacao. O artefato preservado `artifacts/e2e/runs/sprint-23-11b-final-11/playwright.stdout.log` foi lido diretamente:

- PASS: 21
- FAIL: 0
- BLOCKED: 0
- NOT_EXECUTED: 0
- skipped: 0
- flaky: 0
- Chromium desktop, 1 worker, 2,9 minutos

Esse artefato antecede a nova migration da bridge e nao elimina o bloqueador encontrado no schema atual.

## Migration Runner e bloqueador da bridge

O runner canonico passou 17/17, e topologia/integridade passaram 3/3. A bridge e ordenada depois de `enrollment_financial_obligations`; catalogo, dry-run, dependency-first e checksums sao deterministicos.

Apesar disso, uma aplicacao real no banco local descartavel falhou com:

`MIGRATION_EXECUTION_FAILED: Migration 20260715143000_create_enrollment_financial_bridges_table failed.`

A migration exige IDs predecessores `VARCHAR(64)` com a mesma collation e cria FKs sob `utf8mb4_unicode_ci`. As tabelas legadas `j12_alunos`, `j12_financeiro_cobrancas` e `j12_mensalidades` sao criadas pelo bootstrap sem collation explicita. A hipotese principal e incompatibilidade de collation nas FKs ou pre-requisitos; o runner sanitiza a causa SQL interna, impedindo confirmacao mais granular pelo log. Nenhuma migration foi alterada.

Classificacao: **P0 interno parcial e nao liberado**. O contrato e a logica existem, mas o schema nao e aplicavel no MySQL local canonico.

## Riscos, pendencias e bloqueadores

| Nivel | Risco                                                             | Estado                            |
| ----- | ----------------------------------------------------------------- | --------------------------------- |
| P0    | Bridge nao aplicavel no MySQL local descartavel                   | aberto para correcao e nova prova |
| P0    | Restore real, offsite e RPO/RTO nao comprovados                   | parcial/externo                   |
| P0    | Rotacao/revogacao de certificados historicos nao comprovada       | nao resolvido/externo             |
| P1    | HML e smoke externos ausentes                                     | nao resolvido                     |
| P1    | Imports legados carregam configuracao/criam pool em suites amplas | parcial                           |
| P1    | Causa SQL do runner excessivamente sanitizada                     | parcial                           |
| P2    | Banco Inter, Pix e webhooks externos nao homologados              | nao executado por restricao       |
| P2    | Observabilidade, alertas e rotacao de logs operacionais           | parcial                           |

Pendencias externas: drill real de backup/restore com offsite e RPO/RTO medidos; evidencia de rotacao/revogacao historica; HML e infraestrutura real; homologacao posterior em sandbox autorizado.

## Percentuais finais

| Area                          | Percentual | Fundamentacao                                         |
| ----------------------------- | ---------: | ----------------------------------------------------- |
| Arquitetura e composicao      |        95% | caminhos conectados; bloqueio fisico da migration     |
| Logica financeira testada     |       100% | 105/105 focados e 12/12 integrados                    |
| Aplicabilidade da bridge      |        50% | contratos passam; aplicacao MySQL falha               |
| Backend                       |       100% | 686/686                                               |
| Frontend                      |       100% | 78/78                                                 |
| Browser E2E preservado        |       100% | artefato 21/21, anterior a bridge                     |
| Migrations                    |        75% | runner/topologia verdes; bridge nao aplicavel         |
| Seguranca local               |       100% | 34/34 e 0 secrets                                     |
| Evidencia operacional externa |        20% | restore, HML e rotacao nao comprovados                |
| Sprint 23.15                  |    **85%** | auditoria concluida; P0 interno e externos permanecem |
| Prontidao para producao       |     **0%** | teto absoluto por P0 aberto                           |

## Conclusao

**NO-GO.**

A arquitetura e as regras da ponte estao bem cobertas por testes, mas nao e aceitavel liberar um schema cuja migration nova falha no MySQL local canonico. Antes de nova decisao, e obrigatorio corrigir a compatibilidade real dos IDs/collations sem modificar migrations historicas, executar a migration em banco descartavel do zero, repetir runner/integridade e validar novamente a cadeia completa. Mesmo depois dessa correcao, restore real e rotacao/revogacao historica continuam bloqueadores externos para producao.
