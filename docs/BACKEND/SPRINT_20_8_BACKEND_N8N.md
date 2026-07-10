# Sprint 20.8 - Camada Backend de Integração n8n

## Objetivo

Preparar uma fronteira desacoplada para futura comunicação controlada entre o domínio financeiro e o n8n, sem chamada HTTP real, autenticação, webhook, banco, rota pública ou alteração de regra financeira.

## Arquitetura

```text
Futuro caso de uso/controller
          |
          v
FinancialAutomationService (integration/n8n)
          |
          v
N8nIntegrationContract
          ^
          |
N8nWorkflowAdapter
          |
          v
transport injetado (somente mock nesta sprint)
```

Controllers nunca conhecem n8n. A camada de aplicação conversa com o contrato; o adapter traduz as operações para um transport injetado. Nenhum transport de rede foi criado.

## Componentes

### N8nIntegrationContract

- define `startWorkflow`, `getExecutionStatus`, `cancelExecution` e `validatePayload`;
- falha explicitamente quando operações abstratas não são implementadas;
- exige `workflowKey` e `correlationId`;
- aceita somente objetos e valores JSON seguros;
- rejeita referências circulares, valores não serializáveis e profundidade excessiva;
- clona o payload validado para desacoplar mutações do chamador.

### N8nWorkflowAdapter

- implementa o contrato;
- delega início, consulta e cancelamento ao `transport` injetado;
- valida entradas antes de chamar o transport;
- falha de forma controlada se o método necessário não existir;
- não importa cliente HTTP, ambiente, credencial ou SDK do n8n.

### FinancialAutomationService

- prepara payloads e gera `correlationId` quando ausente;
- adiciona metadado seguro de origem;
- abstrai início, consulta de status e cancelamento;
- registra somente metadados operacionais, nunca o conteúdo de `data`;
- encapsula falhas de integração com código controlado e preserva a causa.

Já existe outro `FinancialAutomationService` em `financeiro/automation/application`, responsável pela automação financeira legada. A nova classe está deliberadamente isolada em `financeiro/integration/n8n` e não foi exportada pelo índice principal, evitando substituir ou alterar a implementação existente.

## Isolamento garantido

- nenhum arquivo existente de controller, service legado, repository ou route foi alterado;
- nenhum router foi criado ou montado;
- nenhuma API pública foi adicionada ou modificada;
- nenhum acesso a banco, Prisma, migration ou Banco Inter foi incluído;
- nenhum `axios`, `fetch`, URL, token ou credencial foi adicionado;
- o índice principal `backend/src/domains/financeiro/index.js` não importa a nova camada;
- testes usam apenas transports em memória.

## Contrato de transport futuro

Um transport autorizado deverá implementar:

- `startWorkflow({ payload })`;
- `getExecutionStatus({ executionId })`;
- `cancelExecution({ executionId, reason })`.

Autenticação, retry, timeout, allowlist, URL HML e observabilidade do transport ficam bloqueados para sprint futura. O transport deve retornar objetos serializáveis e nunca expor credenciais.

## Testes unitários

Cobertura criada:

- contrato abstrato e códigos de erro;
- normalização, clone e validação JSON do payload;
- delegação das três operações pelo adapter;
- validação antes do transport e falha fechada sem método;
- preparação de payload e geração de correlação no service;
- consulta/cancelamento pelo service;
- logs sem conteúdo do payload e erro encapsulado.

Comando focado:

```text
node --test backend/src/domains/financeiro/integration/n8n/tests/*.test.js
```

## Estado de prontidão

A camada está pronta para testes e futura composição por injeção de dependência, mas permanece **não integrada ao runtime**. Não é possível iniciar workflow real a partir desta entrega.

## Riscos e próximos gates

- a duplicidade nominal dos dois `FinancialAutomationService` exige imports explícitos por namespace;
- um transport futuro precisará política de autenticação, timeout, retry, sanitização e circuit breaker;
- status/cancelamento dependem do contrato real da versão n8n escolhida;
- autorização e idempotência devem ser definidas antes de qualquer controller interno;
- somente após testes HML deve-se considerar montagem em rota interna autenticada;
- API pública e produção permanecem bloqueadas.
