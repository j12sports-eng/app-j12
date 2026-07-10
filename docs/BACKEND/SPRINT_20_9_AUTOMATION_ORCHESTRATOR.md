# Sprint 20.9 - Orquestração das Automações Financeiras

## Objetivo

Centralizar a decisão e a execução das automações financeiras sem acoplar o domínio à implementação do n8n. A entrega é isolada, usa apenas dependências injetadas e não ativa workflows nem realiza chamadas externas.

## Arquitetura

```text
Solicitação do domínio financeiro
              |
              v
FinancialAutomationOrchestrator
  | seleção de workflow
  | contexto / payload
  | timeout / erros
  | auditoria
              |
              v
financialAutomationService (porta injetada)
              |
              v
Implementação de integração (desconhecida pelo orquestrador)
```

O orquestrador não importa adapter, transport, cliente HTTP ou módulo n8n. Controllers futuros devem depender do orquestrador, nunca da integração concreta.

## Componentes

### FinancialAutomationOrchestrator

- recebe solicitação, ator e metadados do domínio;
- normaliza o tipo e seleciona o workflow por mapa explícito;
- cria `AutomationExecutionContext` e payload JSON desacoplado;
- chama somente `financialAutomationService.startWorkflow`;
- aplica timeout finito no limite da orquestração;
- converte falhas em `AutomationError`;
- registra auditoria antes e depois da tentativa;
- retorna sempre `AutomationExecutionResult`.

### AutomationExecutionContext

Objeto imutável que transporta:

- `correlationId`;
- `executionId`;
- `workflow`;
- timestamps de solicitação, início e conclusão;
- ator reduzido a `id` e `type`;
- metadados JSON.

### AutomationExecutionResult

Padroniza:

- `success`;
- `status`;
- `workflow`;
- `executionId`;
- `warnings`;
- `errors`;
- `metadata`.

Resultados de validação, integração e timeout não lançam até o chamador; são representados no retorno padronizado. Erros de programação fora desse limite devem ser investigados antes da montagem em runtime.

### AutomationError

Categorias:

| Categoria | Uso |
| --- | --- |
| `Validation` | entrada, contexto, payload ou workflow inválido |
| `Infrastructure` | service/auditoria indisponível ou transport ausente |
| `Timeout` | limite excedido ou causa `ETIMEDOUT`/abort |
| `Integration` | falha controlada da camada de integração |
| `Business` | impedimento de negócio explicitamente classificado por componente futuro |
| `Unexpected` | erro sem classificação segura |

A cadeia de `cause` é inspecionada sem expor mensagens internas no resultado.

## Seleção de workflows

| Tipo de solicitação | Workflow |
| --- | --- |
| `REMINDER` | `financeiro-lembretes` |
| `PAYMENT_SETTLEMENT` | `financeiro-baixa-pagamento` |
| `DAILY_COLLECTION` | `financeiro-cobranca-diaria` |
| `DUE_DATE_COLLECTION` | `financeiro-cobranca-vencimento` |
| `REPROCESS_FAILURES` | `financeiro-reprocessar-falhas` |

O mapa pode ser substituído por injeção em testes/configuração futura, sem alterar o algoritmo do orquestrador.

## Fluxo

1. Validar tipo e resolver workflow.
2. Criar contexto com correlação, ator, timestamp e metadados.
3. Montar payload com `requestType` e dados fornecidos pelo domínio.
4. Registrar auditoria `requested`; falha aqui bloqueia o disparo.
5. Chamar o service injetado dentro do timeout.
6. Registrar auditoria de início ou falha.
7. Retornar resultado imutável e padronizado.

Se a execução já tiver sido iniciada e a auditoria final falhar, o retorno preserva o sucesso real e inclui warning. Isso evita reportar falsamente que o workflow não iniciou.

## Auditoria

A porta injetada deve implementar `record(entry)`. Os eventos registram apenas:

- ator reduzido;
- correlação e execução;
- workflow e request type;
- status e timestamp;
- categoria/código do erro.

Payload financeiro, credenciais e dados pessoais não são enviados à auditoria.

## Dependências

- `financialAutomationService.startWorkflow(payload)`;
- `audit.record(entry)`;
- relógio e gerador de correlação injetáveis;
- apenas módulos nativos do Node.js.

Todos os testes usam mocks em memória. Não existe import de Banco Inter, BotConversa, WhatsApp, Express, banco ou rede.

## Pontos de extensão

- política de autorização por tipo de workflow;
- resolução de workflow por configuração HML validada;
- persistência real da auditoria por porta dedicada;
- cancelamento/status coordenados pelo orquestrador;
- circuit breaker e políticas de retry no service/transport;
- métricas usando o contexto e resultado padronizados;
- rota interna autenticada em sprint futura.

## Isolamento

- nenhum controller ou route foi alterado;
- nenhum índice principal do domínio foi alterado;
- nenhum service legado ou regra financeira foi modificado;
- nenhum frontend, banco, migration ou Prisma foi tocado;
- o diretório `orchestrators` permanece não montado no runtime;
- nenhuma chamada ou workflow real pode ser disparado pela entrega isolada.

## Testes

Os testes cobrem seleção de todos os workflows, payload, retorno padronizado, falha de integração, timeout, request inválido, auditoria, falha fail-closed da auditoria e imutabilidade dos objetos.

Comando focado:

```text
node --test backend/src/domains/financeiro/application/orchestrators/tests/*.test.js
```

## Riscos

- os quatro workflows vazios continuam selecionáveis por contrato, mas não devem ser ativados até receberem implementação autorizada;
- timeout não cancela automaticamente uma operação externa já aceita; o estado deve ser reconciliado por `correlationId`;
- auditoria real ainda não foi implementada;
- o mapa é canônico para esta sprint e precisa de governança antes de configuração dinâmica;
- a nova camada não está exportada no índice principal nem acessível por controller.
