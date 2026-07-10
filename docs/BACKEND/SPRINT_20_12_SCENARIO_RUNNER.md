# Sprint 20.12 - Runner de Cenarios de Automacao Financeira

## Objetivo

O `FinancialAutomationScenarioRunner` executa e consolida cenarios sinteticos de homologacao das automacoes financeiras. A implementacao e exclusivamente orientada a injecao: nenhum cliente HTTP, endpoint, banco, Banco Inter, BotConversa ou WhatsApp e criado ou chamado pelo runner.

## Arquitetura

O modulo fica em `backend/src/domains/financeiro/application/scenarios` e e exportado pelo boundary publico do dominio financeiro.

- `ScenarioDefinition`: valida e torna imutaveis `id`, `name`, `description`, `workflow`, `payload`, `expectedResult` e `mode`.
- `FinancialAutomationScenarioRunner`: recebe um executor mock/HML, executa um ou varios cenarios, limita duracao e tentativas, compara o resultado real com o esperado e isola falhas.
- `ScenarioExecutionReport`: consolida totais, sucessos, falhas, duracao, cenarios, warnings e erros.
- `defaultFinancialAutomationScenarios`: fornece as sete definicoes padrao, sem efeitos externos.

```text
ScenarioDefinition[]
        |
        v
FinancialAutomationScenarioRunner -> executor injetado (mock/dry_run/hml)
        |
        v
ScenarioExecutionReport
```

## Cenarios padrao

| ID | Comportamento | Resultado esperado |
| --- | --- | --- |
| `success` | conclusao sintetica | sucesso |
| `workflow-not-found` | workflow inexistente | `AUTOMATION_WORKFLOW_NOT_MAPPED` |
| `invalid-payload` | payload invalido | `AUTOMATION_PAYLOAD_INVALID` |
| `timeout` | executor pendente | `SCENARIO_TIMEOUT` |
| `retry` | primeira tentativa falha | sucesso na segunda tentativa |
| `integration-error` | falha sintetica de integracao | `AUTOMATION_INTEGRATION_ERROR` |
| `unexpected-error` | excecao nao prevista | `SCENARIO_UNEXPECTED_ERROR` |

As chaves em `payload.simulation` sao instrucoes de fixture. Elas nao sao regras financeiras e somente devem ser interpretadas por um executor de teste/HML injetado.

## Fluxo e responsabilidades

1. O chamador seleciona as definicoes e injeta um executor com `execute(input)` ou uma funcao equivalente.
2. O runner valida a definicao e encaminha apenas `attempt`, `mode`, `payload`, `scenarioId` e `workflow`.
3. Cada tentativa e protegida por timeout. Retry ocorre somente quando `expectedResult.attempts` o solicita, respeitando `maxAttempts`.
4. O resultado e normalizado e comparado com `success`, `status`, `errorCode` e `attempts` esperados.
5. O lote gera um `ScenarioExecutionReport` imutavel. Uma falha de cenario nao interrompe os demais.

`success` no item do relatorio significa que o comportamento observado correspondeu ao esperado. Assim, um teste de erro esperado pode ser um cenario validado com sucesso; o erro sintetico observado permanece registrado em `errors` para diagnostico.

## Exemplo mockado

```js
const {
  DEFAULT_FINANCIAL_AUTOMATION_SCENARIOS,
  FinancialAutomationScenarioRunner,
} = require("../../backend/src/domains/financeiro");

const runner = new FinancialAutomationScenarioRunner({
  executor: async ({ payload }) => ({
    status: "COMPLETED",
    success: payload.simulation === "success",
  }),
});

const report = await runner.run(DEFAULT_FINANCIAL_AUTOMATION_SCENARIOS);
```

O exemplo e ilustrativo; um executor deve simular todos os resultados esperados antes de executar o conjunto completo.

## Testes

Os testes unitarios usam `node:test` e cobrem:

- contrato e imutabilidade da definicao;
- execucao individual e em lote;
- timeout e retry;
- workflow e payload invalidos;
- os sete cenarios padrao;
- consolidacao e serializacao do relatorio.

Comando focal:

```bash
node --test backend/src/domains/financeiro/application/scenarios/tests/*.test.js
```

## Limitacoes e seguranca

- O runner nao descobre nem instancia executores automaticamente. Isso impede fallback acidental para transporte real.
- Somente `dry_run` e `hml` sao aceitos; `production` e rejeitado na criacao da definicao.
- O timeout cancela a espera do runner, mas nao tem como abortar internamente um executor que ignore cancelamento. Executores HML devem permanecer sem efeitos externos.
- Retry nao aplica atraso ou backoff, pois esta camada valida comportamento e nao implementa politica financeira operacional.
- Payloads e resultados precisam ser serializaveis para compor relatorios seguros.

## Proximos passos

- Conectar explicitamente o runner ao executor HML da aplicacao quando esse componente estiver disponivel no mesmo branch, mantendo injecao e allowlist de modo.
- Adicionar persistencia opcional de artefatos do relatorio fora do fluxo transacional, sem expor endpoint publico.
- Incluir o conjunto focal no pipeline de homologacao e publicar apenas metadados sanitizados.
