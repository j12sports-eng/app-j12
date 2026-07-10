# Sprint 20.13B - Integracao do Historico ao Orquestrador Financeiro

## Objetivo

Integrar a fundacao append-only da Sprint 20.13A ao `FinancialAutomationOrchestrator` como efeito secundario opcional. A automacao, a auditoria e o resultado principal continuam independentes da disponibilidade do historico.

## Estado inicial auditado

- O orquestrador possuia somente a operacao `execute`, que seleciona workflow, cria contexto, inicia auditoria e chama `startWorkflow`.
- Timeout ja era convertido em resultado `TIMEOUT`; falhas eram normalizadas como `AutomationError`.
- Warnings podiam vir do servico ou de falhas nao fatais na conclusao da auditoria.
- Cancelamento existe no servico de integracao n8n, mas nao como operacao do orquestrador.
- O Scenario Runner possui executor proprio e nao chama diretamente este orquestrador.
- Payment, Banco Inter e o modulo operacional de Automation possuem fluxos independentes.
- A Sprint 20.13A fornecia modelo, servico, repositories e migration, sem composition root de producao.

## Integracao realizada

O construtor do orquestrador aceita opcionalmente:

```js
new FinancialAutomationOrchestrator({
  financialAutomationHistoryService,
  logger,
});
```

O alias `historyService` tambem e aceito. Se nenhum servico for injetado, nenhuma gravacao e tentada e o comportamento anterior permanece igual.

O orquestrador nao instancia repository MySQL, nao importa SQL e nao conhece a tabela. A composicao concreta permanece responsabilidade de um composition root futuro.

## Fluxo

```text
contexto + auditoria inicial
          |
          v
historico STARTED (secundario)
          |
          v
startWorkflow + timeout
          |
          +-- sucesso ------> SUCCEEDED
          +-- cancelado ----> CANCELLED
          +-- timeout ------> TIMED_OUT
          +-- erro ---------> FAILED
          |
          v
warnings operacionais ------> WARNING, um evento por warning
```

Cada seta para o historico cria um registro novo. Nenhum registro anterior e atualizado.

## Campos persistidos

- `executionId`: ID operacional de agrupamento disponivel desde o inicio;
- `automationName`: `financial-automation` por padrao;
- `workflowName`: workflow selecionado pelo mapa canonico;
- `triggerType`: tipo da requisicao financeira;
- `status`: transicao append-only;
- `startedAt`, `finishedAt`, `durationMs`;
- `attempt`: valor informado ou `1`;
- `correlationId`;
- `input`: somente `mode` e `requestType`;
- `output`: status, ID externo ou warning controlado;
- `error`: erro normalizado, posteriormente sanitizado pelo modelo;
- `metadata`: contexto sanitizado, ator e ID externo.

O payload financeiro recebido pelo orquestrador nao e encaminhado ao historico.

## Identidade da execucao

No instante de `STARTED`, o n8n ainda nao retornou seu ID. O agrupador do historico usa, nesta ordem:

1. `input.executionId`, quando informado;
2. `correlationId` do contexto.

Esse valor permanece igual em todos os eventos append-only da execucao. Quando o workflow retorna um ID externo, ele e preservado em `metadata.externalExecutionId` e em `output.executionId`, sem quebrar o agrupamento iniciado anteriormente.

## Sucesso, warning e cancelamento

Uma chamada a `startWorkflow` concluida gera `SUCCEEDED`, mesmo quando o status externo ainda e `STARTED`, pois o trabalho do orquestrador foi concluido com sucesso.

Statuses externos `CANCELLED`, `CANCELED` ou `CANCELADO` geram `CANCELLED`. Nenhuma chamada nova a `cancelExecution` foi criada.

Cada warning operacional ja existente gera um evento `WARNING`. O warning criado pela propria falha do historico nao e novamente persistido, evitando recursao.

## Tolerancia a falhas

Toda chamada ao historico fica dentro de `try/catch` isolado:

1. a falha adiciona `AUTOMATION_HISTORY_PERSISTENCE_FAILED` ao resultado;
2. o logger opcional recebe apenas `event` e `code`;
3. mensagem do banco, stack, payload e credenciais nao sao logados;
4. falha do logger tambem e ignorada;
5. o fluxo principal continua com seu sucesso, falha, timeout ou cancelamento original.

Nao existe recursao entre historico e auditoria. Uma falha do historico nao e gravada no proprio historico.

## Sequencias validadas

| Resultado | Eventos append-only |
| --- | --- |
| sucesso | `STARTED`, `SUCCEEDED` |
| sucesso com warning | `STARTED`, `SUCCEEDED`, `WARNING` |
| falha de integracao | `STARTED`, `FAILED` |
| timeout | `STARTED`, `TIMED_OUT` |
| status cancelado | `STARTED`, `CANCELLED` |
| repository indisponivel | resultado principal preservado + warning interno |

## Arquivos da integracao

- `application/orchestrators/FinancialAutomationOrchestrator.js`: injecao opcional, transicoes e isolamento de falhas.
- `application/history/FinancialAutomationHistoryService.js`: operacao `recordCancelled` sobre status ja existente.
- `application/orchestrators/tests/financial-automation-orchestrator.history.test.js`: cobertura isolada da integracao.
- `docs/BACKEND/SPRINT_20_13A.md`: referencia ao estado integrado.

## Itens nao alterados

- Scenario Runner;
- repositories e migration da Sprint 20.13A;
- Payment e providers;
- Banco Inter;
- servico e adapter n8n;
- controllers, rotas e APIs;
- frontend, cobrancas, mensalidades e relatorios.

## Validacoes executadas

- testes focais de historico e orquestrador: 17/17 aprovados;
- suite completa do dominio Financeiro: 145/145 aprovados;
- lint focado com ESLint nos arquivos 20.13A/20.13B: aprovado, zero erros;
- build de producao com `cmd /c npm run build`: client e SSR aprovados;
- `git diff --check`: aprovado, apenas avisos locais de conversao LF/CRLF;
- smoke dos boundaries: historico disponivel no boundary do dominio e orquestrador disponivel em `application/orchestrators`.

## Pendencias

- Definir composition root de producao e politica de habilitacao do repository MySQL.
- Aplicar a migration em janela aprovada de homologacao.
- Definir retencao, observabilidade e capacidade antes de habilitar alto volume.

Esses itens pertencem a uma sprint posterior. Nenhuma atividade da Sprint 20.13C foi iniciada.
