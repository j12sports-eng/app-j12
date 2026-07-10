# Sprint 20.13C - Backend administrativo

Camada read-only para consulta do historico persistido pelas Sprints 20.13A e 20.13B. Nenhum endpoint de escrita foi criado e o comportamento do orquestrador foi preservado.

## Fluxo e composicao

`FinancialAutomationOrchestrator -> FinancialAutomationHistoryService -> AutomationExecutionHistoryRepositoryContract -> MySqlAutomationExecutionHistoryRepository -> MySQL -> API administrativa`.

O router compoe `MySqlAutomationExecutionHistoryRepository -> FinancialAutomationHistoryService -> FinancialAutomationHistoryController` com suporte a injecao de mocks. O controller nao acessa SQL. A autenticacao reutiliza `requireAuth`; a autorizacao reutiliza `canManageSystem` pelo middleware financeiro existente.

## Endpoints

- `GET /api/admin/financeiro/automacoes/historico`: lista paginada.
- `GET /api/admin/financeiro/automacoes/historico/execution/:executionId`: timeline append-only.
- `GET /api/admin/financeiro/automacoes/historico/:historyId`: evento por ID.

A rota `execution/:executionId` e registrada antes de `:historyId`. O servidor monta o router uma vez nos aliases `/admin/financeiro/...` e `/api/admin/financeiro/...`; o frontend usa o segundo por meio do cliente HTTP com base `/api`. O namespace legado `/admin/financial` permanece reservado aos endpoints de obrigacoes e nao foi alterado.

## Consulta, filtros e ordenacao

Filtros: `startedFrom`, `startedTo`, `status`, `workflowName`, `automationName`, `correlationId`, `executionId` e `triggerType`. Status aceitos: `STARTED`, `SUCCEEDED`, `FAILED`, `WARNING`, `TIMED_OUT` e `CANCELLED`.

Ordenacao aceita somente `startedAt`, `finishedAt` ou `durationMs`, com `asc`/`desc`. O repository converte a whitelist para colunas conhecidas; valores do usuario nunca sao interpolados como nomes SQL.

Paginacao usa `page >= 1` e `1 <= limit <= 1000`. O controller calcula `offset = (page - 1) * limit`; `list()` busca a pagina e `count()` executa `COUNT(*)` com os mesmos filtros, sem carregar registros ilimitados.

Exemplo:

```http
GET /api/admin/financeiro/automacoes/historico?page=2&limit=25&status=FAILED&sortBy=durationMs&sortDirection=desc
```

```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "page": 2,
      "limit": 25,
      "total": 0,
      "hasNext": false,
      "hasPrevious": true
    }
  }
}
```

## Timeline e compatibilidade

`findByExecutionId()` continua retornando o evento mais recente. `listByExecutionId()` usa a listagem filtrada e alimenta a timeline completa em ordem cronologica (`startedAt asc`). Essa separacao preserva os contratos das sprints anteriores.

## Erros e seguranca

- 400: input, filtro ou lookup invalido.
- 404 `AUTOMATION_HISTORY_NOT_FOUND`: historyId ausente.
- 404 `AUTOMATION_EXECUTION_HISTORY_NOT_FOUND`: executionId sem eventos.
- 500 `AUTOMATION_HISTORY_QUERY_FAILED`: dado persistido invalido, repository ausente/nao implementado, serializacao ou falha inesperada.
- 401/403: aplicados pelos middlewares existentes antes dos handlers.

Erros 500 usam mensagem generica e nao retornam SQL, stack ou detalhes internos. A sanitizacao recursiva central remove tokens, senhas, secrets, cookies, authorization, chaves privadas, credenciais, certificados e headers sensiveis de objetos e arrays. Ela e aplicada na criacao do record e novamente na resposta administrativa.

## Limitacoes

- Limite maximo de 1000 eventos por timeline/resposta.
- A consulta e exata para campos textuais; nao implementa busca parcial.
- Nao existe polling, escrita, reprocessamento ou integracao externa nesta sprint.
