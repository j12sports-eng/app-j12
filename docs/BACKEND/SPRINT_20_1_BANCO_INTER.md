# Sprint 20.1 - Banco Inter + Cobrancas Automaticas

## Objetivo

Implementar a infraestrutura backend para emissao de cobrancas Banco Inter, consulta de status,
webhook e conciliacao automatica com o Financeiro J12.

O frontend nao foi alterado nesta sprint.

## Escopo

Novo subdominio:

- `backend/src/domains/financeiro/inter`

O subdominio encapsula:

- entidade de pagamento Inter;
- DTOs de saida;
- validadores de entrada;
- client Banco Inter;
- repository MySQL;
- service de aplicacao;
- controller HTTP;
- rotas administrativas;
- testes focados.

## Endpoints

Base montada:

- `/admin/financeiro/inter`
- `/api/admin/financeiro/inter`

Rotas:

- `POST /api/admin/financeiro/inter/cobrancas`
- `GET /api/admin/financeiro/inter/cobrancas/:id`
- `POST /api/admin/financeiro/inter/sincronizar`
- `POST /api/admin/financeiro/inter/webhook`

`/cobrancas` e `/sincronizar` usam o padrao administrativo existente:

- `requireAuth`
- `canManageSystem`

`/webhook` nao usa login J12 porque e chamado pelo Banco Inter. A seguranca fica em:

- mTLS no client/API gateway;
- `INTER_WEBHOOK_SECRET`, quando configurado, validado por header/token.

## Variaveis de ambiente

- `INTER_CLIENT_ID`
- `INTER_CLIENT_SECRET`
- `INTER_PIX_KEY`
- `INTER_CERT_PATH`
- `INTER_KEY_PATH`
- `INTER_BASE_URL`
- `INTER_ENVIRONMENT`
- `INTER_TIMEOUT_MS`
- `INTER_WEBHOOK_SECRET`

O client reutiliza a resolucao de certificados ja existente no projeto para mTLS.

## Tabelas Utilizadas

Nao foi criada migration nesta sprint. A implementacao usa as tabelas ja garantidas pelo bootstrap
do backend:

- `j12_financeiro_cobrancas`
- `j12_mensalidades`
- `j12_pagamentos`
- `financial_payments`
- `inter_webhook_events`

## Fluxo de Emissao

1. O endpoint recebe `cobrancaId`, `mensalidadeId` ou `id`.
2. O repository carrega a cobranca existente no Financeiro.
3. O client autentica no Banco Inter via OAuth client credentials.
4. O token e cacheado ate proximo do vencimento.
5. O client emite cobranca Pix no Banco Inter.
6. O repository salva o espelho em `financial_payments`.
7. A resposta retorna `txid`, copia e cola, QR Code quando disponivel e link de pagamento quando
   retornado pelo Inter.

## Fluxo de Consulta

1. O endpoint localiza o pagamento em `financial_payments`.
2. O client consulta a cobranca Pix no Banco Inter.
3. Se o status remoto indicar liquidacao, cancelamento ou expiracao, a conciliacao local e aplicada.
4. A resposta retorna os dados locais e o payload remoto sanitizado.

## Fluxo de Webhook

Eventos aceitos:

- pagamento confirmado;
- pagamento cancelado;
- expiracao;
- devolucao.

Para cada evento:

1. O payload e normalizado.
2. Um hash idempotente e salvo em `inter_webhook_events`.
3. O pagamento local e localizado por `txid`.
4. A baixa ou reversao e aplicada nas tabelas financeiras.
5. O evento e marcado como processado ou com erro.

## Conciliacao

Pagamento confirmado atualiza:

- `financial_payments.status = PAGO`;
- `j12_financeiro_cobrancas.status = pago`;
- `j12_mensalidades.status = pago`;
- `j12_pagamentos` com observacao de baixa Banco Inter e E2E quando disponivel.

Cancelamento atualiza:

- `financial_payments.status = CANCELADO`;
- cobranca e mensalidade para `cancelado`.

Expiracao atualiza:

- `financial_payments.status = VENCIDO`;
- cobranca e mensalidade para `atrasado`.

Devolucao atualiza:

- `financial_payments.status = CANCELADO`;
- mensalidade/cobranca voltam para estado aberto compatível com vencimento.

## Seguranca

- OAuth Banco Inter com renovacao automatica de token.
- Cache em memoria por instancia do client.
- Retry unico com refresh de token em respostas 401/403 e falhas transientes.
- mTLS via certificado/chave configurados.
- Webhook com validacao de segredo compartilhado quando `INTER_WEBHOOK_SECRET` estiver definido.
- Sem exposicao publica para frontend.

## Limitacoes

- A sprint nao cria UI.
- A sprint nao altera modulos externos ao Financeiro.
- A sprint nao cria migration nova; depende das tabelas ja preparadas pelo bootstrap do backend.
- Link de pagamento e retornado somente quando o Banco Inter enviar `loc.location` ou campo
  equivalente.

## Testes

Testes criados:

- `backend/src/domains/financeiro/inter/infrastructure/clients/banco-inter.client.test.js`
- `backend/src/domains/financeiro/inter/application/tests/inter-application.service.test.js`
- `backend/src/domains/financeiro/inter/infrastructure/repositories/mysql-inter.repository.test.js`
- `backend/src/domains/financeiro/inter/presentation/tests/inter-admin.controller.test.js`

Cobertura:

- autenticacao OAuth;
- cache/renovacao de token;
- emissao Pix;
- consulta e conciliacao;
- webhook;
- baixa automatica;
- cancelamento, expiracao e devolucao;
- controller e rotas.
