# Sprint 24.4 — Observabilidade

## Arquitetura de observabilidade

A observabilidade local foi implementada em uma camada transversal, sem alteração de regras de negócio, contratos ou payloads. Um contexto baseado em `AsyncLocalStorage` mantém os identificadores durante o ciclo assíncrono da requisição. O middleware HTTP registra início e conclusão, e o tratador de erros registra falhas no mesmo formato. Consultas executadas pelo adaptador central de banco e tarefas assíncronas selecionadas usam o mesmo logger estruturado.

## Formato dos logs

Cada evento é emitido como uma linha JSON com os campos comuns `timestamp`, `level`, `event`, `correlationId` e `requestId`. Os níveis aceitos são `INFO`, `WARN` e `ERROR`. Metadados específicos são adicionados por evento. Campos sensíveis são substituídos por `[REDACTED]`.

Eventos padronizados:

- HTTP: `http.request.started`, `http.request.completed`, `http.request.failed`.
- Banco: `database.query.completed`, `database.query.failed`, `database.connection.reconnect`, `database.connection.release_failed`.
- Assíncronos: `async.operation.started`, `async.operation.completed`, `async.operation.failed`.

## Correlation ID e Request ID

O middleware aceita `X-Correlation-Id` e `X-Request-Id` quando válidos; caso contrário, gera UUIDs. Ambos são devolvidos nos headers da resposta e propagados pelo contexto assíncrono. O correlation ID relaciona operações de uma mesma cadeia, enquanto o request ID identifica uma requisição específica.

## Métricas coletadas

- Duração total de cada request e respectivo status HTTP.
- Duração das queries executadas pelo adaptador central, operação SQL e uma prévia limitada da instrução, sem parâmetros.
- Duração e resultado das tarefas assíncronas instrumentadas.
- Identificador e papel do usuário autenticado, quando disponíveis, sem dados pessoais adicionais.

## Riscos

- Logs síncronos via console podem acrescentar pequena latência sob volume elevado.
- Queries executadas fora do adaptador central não possuem temporização automática.
- A prévia textual de SQL exige que valores não sejam interpolados diretamente na instrução.

## Limitações

- A solução é local e não inclui coletor, retenção, dashboards, alertas ou tracing distribuído externo.
- Não mede separadamente as etapas internas do pool.
- Serviços assíncronos precisam adotar explicitamente o helper para obter eventos de ciclo de vida.
