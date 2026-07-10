# Sprint 20.13C - Frontend administrativo

Interface administrativa read-only em `/admin/financeiro/automacoes/historico`, protegida para administradores e coordenadores.

## Arquitetura

O fluxo e `API administrativa -> financialAutomationHistoryApi -> React Query -> FinancialAutomationHistoryPage`. A camada usa o cliente HTTP compartilhado e possui somente GET: lista, detalhe por historyId e timeline por executionId. Nao ha mutation ou cliente paralelo.

Os tipos cobrem record, seis status, filtros, paginacao e timeline sem `any`. Os hooks `useAutomationHistory`, `useAutomationHistoryDetails` e `useExecutionHistory` usam chaves estaveis. A chave da lista recebe o objeto completo de filtros, incluindo pagina, limite e ordenacao; consultas por ID usam `enabled`. Nao existe polling.

## Interface

A pagina oferece filtros por automacao, workflow, executionId, correlationId, triggerType, status e periodo, alem de ordenacao por inicio, conclusao ou duracao. Alterar filtro reinicia a pagina em 1.

Componentes:

- `AutomationHistoryFilters`: filtros e ordenacao acessiveis por label.
- `AutomationHistoryTable`: tabela responsiva com overflow horizontal e estado vazio.
- `AutomationHistoryStatusBadge`: diferenciacao dos seis status.
- `AutomationHistoryDetailsDialog`: detalhe atualizado por historyId e fallback seguro para a linha selecionada.
- `AutomationHistoryTimeline`: eventos append-only da executionId.

Loading, erro e vazio sao exibidos sem alterar o design global. A paginacao usa `hasNext` e `hasPrevious` retornados pelo backend.

## Rota e navegacao

A rota TanStack e `/admin/financeiro/automacoes/historico`, protegida por `ProtectedRoute` para `admin` e `coordenador`. O routeTree e gerado pelo build oficial. Como o menu atual nao possui submenus, o acesso foi adaptado como item `Historico de Automacoes` na secao Receita, sem reestruturar a navegacao.

## Limitacoes

- Filtros textuais sao exatos no backend.
- Nao ha polling, exportacao, mutation ou controle operacional de automacoes.
- A timeline e limitada a 1000 eventos pela API.

Fluxo completo: `FinancialAutomationOrchestrator -> FinancialAutomationHistoryService -> AutomationExecutionHistoryRepositoryContract -> MySqlAutomationExecutionHistoryRepository -> MySQL -> API administrativa -> React Query -> Tela administrativa`.
