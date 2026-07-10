# Sprint 20.13A - Fundacao do Historico de Automacoes Financeiras

## Contexto e objetivo

A especificacao inicial da Sprint 20.13 pressupunha que a Sprint 20.12 havia criado um historico operacional. A auditoria da branch `sprint-20.4`, no commit base `e90df30`, confirmou que a Sprint 20.12 existente criou o Scenario Runner. Nenhum modelo, contrato, repository ou servico de historico existia no checkout ou no historico Git local.

Com autorizacao expressa, esta sprint preparatoria cria a fundacao isolada para registrar e consultar eventos do ciclo de execucao. Ela nao integra o historico ao `FinancialAutomationOrchestrator` e nao adiciona efeitos colaterais ao fluxo atual.

## Estado inicial auditado

- O dominio financeiro usa CommonJS e exports agregados por `index.js`.
- Contratos abstratos lancam erros tipados de operacao nao implementada.
- Modelos de auditoria normalizam datas como ISO 8601 e sao imutaveis.
- Repositories SQL recebem `queryRunner` e carregam o runner padrao de forma tardia.
- O acesso compartilhado usa `backend/src/config/db.js`, baseado em `mysql2/promise`.
- Migrations recentes sao scripts JavaScript manuais com `up`, `down`, `status`, verificacao de schema e protecao contra `down` com dados.
- Campos JSON persistidos pelas migrations atuais usam `LONGTEXT`.

## Arquitetura

```text
Chamador isolado futuro
        |
FinancialAutomationHistoryService
        |
AutomationExecutionHistoryRepositoryContract
        +-- InMemoryAutomationExecutionHistoryRepository
        +-- MySqlAutomationExecutionHistoryRepository
                     |
financial_automation_execution_history
```

O servico conhece somente o contrato. O modelo e a application layer nao conhecem SQL, pool ou tabela.

## Contrato do registro

`AutomationExecutionHistoryRecord` e imutavel e contem:

- identidade: `id`, `executionId`;
- classificacao: `automationName`, `workflowName`, `triggerType`, `status`;
- tempo: `startedAt`, `finishedAt`, `durationMs`, `createdAt`;
- tentativa e correlacao: `attempt`, `correlationId`;
- contexto sanitizado: `input`, `output`, `error`, `metadata`.

Status aceitos: `STARTED`, `SUCCEEDED`, `FAILED`, `WARNING`, `TIMED_OUT` e `CANCELLED`.

## Decisao append-only

Cada transicao operacional gera um registro novo. `id` e a chave fisica do evento; `executionId` agrupa todos os eventos da mesma execucao. Nao existe update nem constraint unica em `executionId`. Isso permite inicio, warning, timeout e resultado final, alem de tentativas futuras, sem presumir regras de versionamento.

`findByExecutionId` devolve o evento mais recente segundo `started_at DESC`, `created_at DESC`, `id DESC`. `list` devolve uma lista paginada, ordenada por `started_at DESC`, `id DESC`, com limite maximo de 1000.

## Tabela e indices

Migration: `20260709220000_create_financial_automation_execution_history.js`.

Tabela: `financial_automation_execution_history`.

Colunas:

| Coluna | Tipo | Regra |
| --- | --- | --- |
| `id` | `VARCHAR(64)` | PK |
| `execution_id` | `VARCHAR(191)` | obrigatoria, nao unica |
| `automation_name` | `VARCHAR(120)` | obrigatoria |
| `workflow_name` | `VARCHAR(120)` | nullable |
| `trigger_type` | `VARCHAR(80)` | nullable |
| `status` | `VARCHAR(32)` | validado no dominio |
| `started_at` | `DATETIME` | obrigatoria |
| `finished_at` | `DATETIME` | nullable |
| `duration_ms` | `BIGINT UNSIGNED` | nullable e nao negativa |
| `attempt` | `INT UNSIGNED` | padrao 1 |
| `correlation_id` | `VARCHAR(191)` | nullable |
| `input_json`, `output_json`, `error_json`, `metadata_json` | `LONGTEXT` | JSON controlado |
| `created_at` | `DATETIME` | obrigatoria |

Indices simples: `execution_id`, `automation_name`, `workflow_name`, `status`, `correlation_id` e `started_at`. Nao ha foreign keys porque nao existe tabela canonica de workflows/automacoes e nao ha indice unico sobre a chave de agrupamento.

## Serializacao e seguranca

- Queries, filtros, limites e offsets usam parametros `?`.
- JSON e serializado somente depois da construcao do modelo sanitizado.
- JSON ausente vira `NULL`.
- JSON corrompido no banco gera `AUTOMATION_HISTORY_DATA_INVALID` com o nome da coluna, sem expor seu conteudo.
- `Error` e reduzido a `name`, `message`, `code`, `category` e detalhes sanitizados; stack nao e persistida.
- Chaves de credenciais, authorization, cookies, headers, passwords, secrets e tokens sao removidas recursivamente.
- `input` deve conter apenas contexto operacional minimo e identificadores; payload financeiro integral permanece fora deste historico.
- Erros inesperados de banco sao propagados sem incluir parametros ou JSON sensivel na mensagem.

## Migration e rollback

`up` consulta a existencia antes da criacao, usa `CREATE TABLE IF NOT EXISTS` e valida engine, colunas e indices. `status` apenas inspeciona. `down` recusa remover a tabela se houver qualquer registro; ele nao foi executado em ambiente compartilhado.

O teste automatizado valida estaticamente o SQL e seus contratos. A migration real nao foi aplicada automaticamente porque o banco configurado e compartilhado e a sprint nao autoriza mutacao desse ambiente sem uma janela operacional segura.

## Testes

Foram criados testes para:

- validacao, datas, status, tentativa, duracao, imutabilidade e sanitizacao do modelo;
- save, buscas, filtros, intervalo, ordenacao, paginacao e clones do repository em memoria;
- todos os registros do servico e consultas delegadas;
- INSERT, parametros, JSON, mapeamento, filtros, paginacao e erros do adapter MySQL;
- definicao idempotente da migration, colunas, indices e ausencia de unicidade em `execution_id`.

Resultados executados em 9 de julho de 2026:

- testes do modelo, memoria e servico: 5/5 aprovados;
- testes dos repositories e smoke estrutural da migration: 7/7 aprovados;
- testes do orquestrador: 8/8 aprovados;
- testes do Scenario Runner: 7/7 aprovados;
- suite completa do dominio financeiro: 141/141 aprovados;
- `cmd /c npm run build`: client e SSR compilados com sucesso;
- `git diff --check`: aprovado, apenas avisos locais de conversao LF/CRLF.

## Fora do escopo

- integracao com `FinancialAutomationOrchestrator`;
- alteracoes no Scenario Runner, n8n, APIs, controllers, rotas ou frontend;
- novos endpoints, CLI ou executor HML;
- alteracoes de regras financeiras, pagamentos, mensalidades ou relatorios;
- execucao da migration no banco compartilhado.

## Riscos e proximos passos

- A composicao de producao ainda nao existe por decisao de escopo.
- Retencao, arquivamento e volume da tabela precisam de politica operacional antes da integracao.
- A proxima sprint deve integrar o servico ao orquestrador como efeito secundario tolerante a falhas: erro do historico deve gerar warning e nunca substituir o resultado principal da automacao.

## Atualizacao da Sprint 20.13B

A fundacao desta sprint foi integrada opcionalmente ao `FinancialAutomationOrchestrator` na Sprint 20.13B. O contrato append-only e o repository permanecem inalterados. O servico passou a expor tambem `recordCancelled`, usando o status `CANCELLED` que ja fazia parte do modelo. Consulte `docs/BACKEND/SPRINT_20_13B.md` para fluxo, tolerancia a falhas e sequencia dos eventos.
