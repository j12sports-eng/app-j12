# Sprint 20.3 - Fase A - Backend das Automacoes Financeiras

## Objetivo

Preparar o backend Financeiro para ser consumido pelo n8n.

Toda regra de negocio fica no backend. O n8n deve apenas orquestrar chamadas,
enviar mensagens pelos provedores configurados e registrar o resultado pelos
endpoints de eventos.

Esta fase nao altera workflows do n8n e nao altera frontend.

## Arquitetura

Novo subdominio:

- `backend/src/domains/financeiro/automation`

Camadas:

- `entities`: evento de automacao financeira, tipos, status e alvos;
- `application/dtos`: formatos de saida para vencimentos, inadimplentes, pagamentos e eventos;
- `application/validators`: janelas fixas, status de pagamentos, eventos e processamento;
- `application/services`: regra de negocio, idempotencia e reprocessamento;
- `infrastructure/repositories`: adapter MySQL para mensalidades, pagamentos e historico;
- `presentation/controllers`: entrada HTTP fina;
- `presentation/routes`: token de servico, validacao de origem e rate limit.

Tabelas lidas:

- `j12_mensalidades`
- `j12_financeiro_cobrancas`
- `financial_payments`
- `j12_alunos`
- `j12_responsaveis`

Tabela criada sob demanda para historico e idempotencia:

- `financial_automation_events`

## Endpoints

Base:

- `/admin/financeiro/automation`
- `/api/admin/financeiro/automation`

Rotas:

- `GET /api/admin/financeiro/automation/vencimentos`
- `GET /api/admin/financeiro/automation/inadimplentes`
- `GET /api/admin/financeiro/automation/pagamentos`
- `POST /api/admin/financeiro/automation/eventos`
- `POST /api/admin/financeiro/automation/processar`

## Autenticacao

As rotas usam token interno de servico, nao sessao de usuario.

Headers aceitos:

- `Authorization: Bearer <token>`
- `x-service-token: <token>`
- `x-internal-token: <token>`
- `x-n8n-token: <token>`

Variaveis aceitas, em ordem:

- `FINANCEIRO_AUTOMATION_SERVICE_TOKEN`
- `N8N_SERVICE_TOKEN`
- `INTERNAL_SERVICE_TOKEN`

Se nenhum token estiver configurado, a API responde `503` e nao abre o endpoint.

## Origem e Rate Limit

Origem:

- `FINANCEIRO_AUTOMATION_ALLOWED_ORIGINS`
- `N8N_ALLOWED_ORIGINS`

Quando `Origin` ou `Referer` existir, a origem precisa estar na allowlist.
Chamadas server-to-server sem esses headers sao aceitas se o token estiver correto.

Rate limit especifico:

- `FINANCEIRO_AUTOMATION_RATE_LIMIT_WINDOW_MS`
- `FINANCEIRO_AUTOMATION_RATE_LIMIT_MAX`

Padrao: 60 requisicoes por minuto por IP e rota.

## Vencimentos

```http
GET /api/admin/financeiro/automation/vencimentos
```

Query params:

- `days`: opcional. Valores permitidos: `0,1,3,7`.
- `referenceDate`: opcional, formato `YYYY-MM-DD`.
- `includeProcessed`: opcional. Quando `true`, tambem retorna itens ja processados.
- `limit`: opcional.

Busca mensalidades pendentes que vencem:

- hoje;
- em 1 dia;
- em 3 dias;
- em 7 dias.

Cada item retorna `automation.eventKey`. O n8n deve usar essa chave ao registrar o envio.

## Inadimplentes

```http
GET /api/admin/financeiro/automation/inadimplentes
```

Query params:

- `days`: opcional. Valores permitidos: `1,3,7,15,30`.
- `referenceDate`: opcional, formato `YYYY-MM-DD`.
- `includeProcessed`: opcional.
- `limit`: opcional.

Busca mensalidades pendentes ou atrasadas com:

- 1 dia de atraso;
- 3 dias;
- 7 dias;
- 15 dias;
- 30 dias.

## Pagamentos

```http
GET /api/admin/financeiro/automation/pagamentos
```

Query params:

- `status`: `confirmados`, `pendentes`, `cancelados` ou lista separada por virgula.
- `includeProcessed`: opcional.
- `limit`: opcional.

Mapeamento:

- `confirmados`: `PAGO`
- `pendentes`: `PENDENTE`, `PROCESSANDO`, `ATRASADO`, `VENCIDO`
- `cancelados`: `CANCELADO`

Pagamentos confirmados recebem evento sugerido `AGRADECIMENTO_ENVIADO`.
Pagamentos pendentes recebem evento sugerido `TENTATIVA_COBRANCA`.
Pagamentos cancelados sao listados sem acao automatica de envio.

## Eventos

```http
POST /api/admin/financeiro/automation/eventos
```

Payload:

```json
{
  "eventType": "LEMBRETE_ENVIADO",
  "targetType": "MENSALIDADE",
  "targetId": "men-123",
  "eventKey": "financeiro:automation:LEMBRETE_ENVIADO:MENSALIDADE:men-123:2026-07-09:d0",
  "referenceDate": "2026-07-09",
  "daysOffset": 0,
  "channel": "whatsapp",
  "provider": "botconversa",
  "status": "COMPLETED",
  "payload": {
    "workflowId": "n8n-workflow-id"
  }
}
```

Eventos suportados:

- `LEMBRETE_ENVIADO`
- `COBRANCA_ENVIADA`
- `AGRADECIMENTO_ENVIADO`
- `TENTATIVA_COBRANCA`
- `ERRO_ENVIO`

Status suportados:

- `PENDING`
- `COMPLETED`
- `FAILED`
- `SKIPPED`

Alvos suportados:

- `MENSALIDADE`
- `COBRANCA`
- `PAGAMENTO`
- `PROCESSAMENTO`

## Processamento

```http
POST /api/admin/financeiro/automation/processar
```

Payload:

```json
{
  "limit": 100,
  "syncBancoInter": true,
  "reprocess": false
}
```

Com `syncBancoInter: true`, o backend chama o provider Banco Inter ja existente para sincronizar
pagamentos abertos. A conciliacao continua no backend existente:

- atualiza `financial_payments`;
- atualiza `j12_financeiro_cobrancas`;
- atualiza `j12_mensalidades`;
- registra `j12_pagamentos`.

Depois da sincronizacao, eventos pendentes relacionados a pagamentos confirmados sao marcados
como concluidos.

Reprocessamento manual:

```json
{
  "reprocess": true,
  "idempotencyKey": "financeiro:automation:COBRANCA_ENVIADA:MENSALIDADE:men-123:2026-07-06:d-3"
}
```

O evento volta para `PENDING` e pode ser processado novamente pelo n8n.

## Idempotencia

Cada automacao tem uma chave unica:

```text
financeiro:automation:<EVENTO>:<ALVO>:<ID>:<DATA>:d<JANELA>
```

Regras:

- `financial_automation_events.event_key` e unico;
- `POST /eventos` usa `INSERT IGNORE`;
- repetir o mesmo evento retorna o registro existente;
- `GET /vencimentos`, `/inadimplentes` e `/pagamentos` ocultam eventos `COMPLETED` por padrao;
- `includeProcessed=true` permite auditoria e reprocessamento manual.

## Seguranca

- token interno obrigatorio;
- origem validada quando informada;
- rate limit dedicado;
- logs de rejeicao nao incluem token, payload financeiro, telefone, email ou CPF;
- payloads de evento devem armazenar apenas metadados operacionais do n8n.

## Fora de Escopo

- criar ou alterar workflows do n8n;
- alterar frontend;
- alterar portais;
- alterar Agenda, Campeonatos, Professores ou Alunos;
- trocar a conciliacao Banco Inter ja implementada.
