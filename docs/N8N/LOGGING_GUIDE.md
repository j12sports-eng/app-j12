# Padrão de Logs dos Workflows n8n

## Objetivo

Permitir rastreabilidade entre execução, workflow e item processado sem registrar credenciais, dados pessoais ou payload financeiro completo.

## Formato

Emitir uma linha JSON por evento, em UTF-8, com nomes de campo estáveis. Mensagens humanas complementam campos estruturados, mas não os substituem.

Exemplo sanitizado:

```json
{
  "timestamp": "2030-01-01T12:00:00.000Z",
  "level": "INFO",
  "environment": "HML",
  "mode": "DRY_RUN",
  "workflowId": "workflow-id-interno",
  "workflowName": "financeiro-lembretes",
  "executionId": "execution-id-interno",
  "correlationId": "correlation-id-sintetico",
  "event": "workflow.item.completed",
  "status": "COMPLETED",
  "durationMs": 125,
  "retryAttempt": 0,
  "errorClass": null,
  "message": "Item sintético processado"
}
```

O exemplo contém somente identificadores fictícios e não define valores reais de ambiente.

## Campos obrigatórios

| Campo | Regra |
| --- | --- |
| `timestamp` | instante do evento em ISO 8601 UTC com milissegundos |
| `level` | `DEBUG`, `INFO`, `WARN` ou `ERROR` |
| `environment` | ambiente explícito, nunca inferido pelo destino |
| `mode` | `DRY_RUN`, `MANUAL` ou `SCHEDULED` |
| `workflowId` | ID imutável atribuído pelo n8n |
| `workflowName` | nome canônico do workflow |
| `executionId` | ID da execução gerado pelo n8n |
| `correlationId` | ID propagado durante todo o processamento lógico |
| `event` | nome estável no padrão `dominio.entidade.acao` |
| `status` | estado do evento/executado |
| `message` | resumo curto, sanitizado e acionável |

Campos condicionais: `durationMs`, `retryAttempt`, `errorClass`, `errorCode`, `dependency`, `itemResult` e `parentExecutionId`.

## Identificadores

### Correlation ID

- reutilizar um identificador de correlação recebido quando ele for seguro e válido;
- na ausência, gerar um ID opaco no início do fluxo;
- propagar em logs, chamadas autorizadas e retries;
- não usar telefone, e-mail, CPF, ID financeiro bruto ou conteúdo do payload;
- `eventKey` pode ajudar na idempotência, mas não deve virar label de métrica e só pode aparecer em log restrito se estiver sanitizado.

### Execution ID

Usar `$execution.id` como identificador da tentativa no n8n. Um retry que cria nova execução deve preservar o `correlationId` e registrar `parentExecutionId` quando disponível.

### Workflow ID

Usar o ID interno estável do workflow importado, além de `workflowName`. Não confundir com `versionId` do arquivo JSON.

## Timestamps e duração

- armazenar e transportar em UTC;
- exibir em `America/Sao_Paulo` somente na interface operacional;
- calcular duração por relógio monotônico quando a plataforma permitir;
- nunca sobrescrever o timestamp original durante retry ou reprocessamento.

## Eventos recomendados

- `workflow.execution.started`
- `workflow.execution.completed`
- `workflow.execution.failed`
- `workflow.item.skipped`
- `workflow.item.completed`
- `workflow.retry.scheduled`
- `workflow.retry.exhausted`
- `dependency.request.failed`
- `security.destination.blocked`

## Níveis

- `DEBUG`: diagnóstico temporário em HML; desabilitado por padrão e sem payload bruto.
- `INFO`: início, conclusão, item ignorado e mudança autorizada.
- `WARN`: condição degradada ou recuperável.
- `ERROR`: falha que exige triagem ou interrupção.

A classe operacional do erro é definida separadamente em `ERROR_CLASSIFICATION.md`.

## Sanitização

Nunca registrar segredo, cabeçalho de autenticação, material de certificado, telefone, e-mail, documento, endereço, payload integral ou URL com dados sensíveis. Mascarar valores antes da emissão, limitar tamanho de mensagens e tratar stack traces como acesso restrito.

## Qualidade e validação

- validar schema e tipos antes da ingestão;
- rejeitar/quarentenar evento sem IDs obrigatórios;
- verificar relógios sincronizados e ordenação por timestamp;
- testar correlação entre alerta, dashboard e execução n8n;
- monitorar perda, atraso e duplicidade de logs;
- impedir que falha de logging produza efeito financeiro duplicado.
