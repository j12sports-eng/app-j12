# Sprint 20.2 - Banco Inter - Entrega Final

## Objetivo

Concluir a integracao Banco Inter da Sprint 20.2 usando a arquitetura de providers da Sprint 20.1.

Esta entrega cobre:

- backend do provider Banco Inter;
- conexao do provider com a `PaymentGatewayFactory`;
- endpoints administrativos Pix;
- compatibilidade com rotas legadas;
- frontend financeiro consumindo o endpoint administrativo novo;
- testes, lint e build de fechamento.

Nao faz parte desta sprint iniciar automacoes da Sprint 20.3, novos gateways ou novas regras de
negocio.

## Arquitetura final

Camadas principais:

- `backend/src/domains/financeiro/payment`: contrato generico de cobrancas e providers;
- `backend/src/domains/financeiro/payment/providers/inter`: provider Banco Inter real;
- `backend/src/domains/financeiro/inter`: API administrativa especifica do Banco Inter;
- `backend/src/services/bancoInter`: compatibilidade legada Pix/Inter;
- `src/hooks/useFinanceiroAdmin.ts`: tela financeira criando Pix pelo endpoint novo;
- `src/routes/admin/financeiro.tsx`: pagina administrativa financeira.

`PaymentProviderInter` implementa `PaymentProvider` e fica isolado das regras financeiras. O
Financeiro chama a factory, a factory resolve o provider e o provider conversa com Pix/OAuth/mTLS.

## OAuth

`OAuthService` usa client credentials:

1. chama `POST /oauth/v2/token`;
2. envia `client_id`, `client_secret`, `grant_type=client_credentials` e scopes Pix;
3. usa agente mTLS na chamada de token;
4. armazena token em cache de memoria por instancia;
5. renova antes do vencimento;
6. limpa cache e tenta novamente em falhas de autenticacao/transientes pelo `InterClient`.

Falhas controladas:

- `INTER_OAUTH_CREDENTIALS_MISSING`;
- `INTER_OAUTH_TOKEN_MISSING`.

## mTLS

`MTLSService` cria o `https.Agent` com:

- certificado cliente;
- chave privada;
- cadeia CA opcional;
- `keepAlive`;
- `rejectUnauthorized` ativo por padrao.

O frontend nunca acessa certificado, chave, secret ou token OAuth. Esses dados ficam restritos ao
backend.

## Provider e Factory

`PaymentProviderInter` implementa:

- `createCharge`;
- `updateCharge`;
- `cancelCharge`;
- `getCharge`;
- `listPayments`;
- `createPix`;
- `getPix`;
- `cancelPix`;
- `sync`;
- `processWebhook`.

`PaymentGatewayFactory` registra `PaymentProviderInter` quando o provider e `banco_inter`. Outros
providers continuam usando `PlannedPaymentProvider` ate suas sprints.

## Endpoints

Base generica:

- `/admin/financeiro`;
- `/api/admin/financeiro`.

Rotas genericas:

- `POST /cobrancas`;
- `GET /cobrancas`;
- `GET /cobrancas/:id`;
- `PATCH /cobrancas/:id`;
- `DELETE /cobrancas/:id`.

Base Banco Inter:

- `/admin/financeiro/inter`;
- `/api/admin/financeiro/inter`.

Rotas Banco Inter:

- `POST /webhook`;
- `POST /pix`;
- `GET /pix/:txid`;
- `DELETE /pix/:txid`;
- `POST /cobrancas`;
- `GET /cobrancas/:id`;
- `POST /sincronizar`.

Compatibilidade legada mantida:

- `POST /pix/create`;
- `GET /pix/:txid/status`;
- `POST /webhooks/inter`;
- `POST /inter/webhook/configure`.

## Payloads

Criar Pix:

```json
POST /api/admin/financeiro/inter/pix
{
  "chargeId": "cob-123",
  "mensalidadeId": "men-123"
}
```

Resposta esperada:

```json
{
  "success": true,
  "data": {
    "provider": "banco_inter",
    "txid": "TXID123",
    "cobrancaId": "cob-123",
    "mensalidadeId": "men-123",
    "bancoInter": {
      "txid": "TXID123",
      "pixCopiaCola": "000201...",
      "qrCode": "data:image/png;base64,...",
      "linkPagamento": "https://..."
    },
    "pagamento": {
      "status": "PENDENTE"
    }
  }
}
```

Consultar Pix:

```http
GET /api/admin/financeiro/inter/pix/TXID123
```

Cancelar Pix:

```json
DELETE /api/admin/financeiro/inter/pix/TXID123
{
  "reason": "Cancelamento solicitado no financeiro J12"
}
```

Sincronizar:

```json
POST /api/admin/financeiro/inter/sincronizar
{
  "limit": 50
}
```

Webhook:

```json
POST /api/admin/financeiro/inter/webhook
{
  "pix": [
    {
      "txid": "TXID123",
      "endToEndId": "E2E123",
      "horario": "2026-07-09T10:00:00Z",
      "valor": "250.00"
    }
  ]
}
```

## Fluxo Pix

1. Frontend financeiro cria a cobranca local.
2. Se `formaPagamento = pix` e `gerarPix = true`, chama `POST /admin/financeiro/inter/pix`.
3. Backend valida entrada e carrega a cobranca local.
4. `PixService` monta o payload Pix.
5. `InterClient` autentica por OAuth, usa mTLS e envia a requisicao ao Inter.
6. `MySqlInterRepository` persiste o espelho em `financial_payments`.
7. DTO retorna `txid`, copia e cola, QR Code e link quando disponivel.

## Fluxo Webhook

1. `WebhookService` valida segredo compartilhado quando `INTER_WEBHOOK_SECRET` existe.
2. O evento e normalizado para `txid`, `e2eid`, transacao, data e status.
3. O hash do evento e gravado em `inter_webhook_events`.
4. Eventos ja processados retornam como duplicados.
5. O pagamento local e localizado por `txid`.
6. A conciliacao e aplicada nas tabelas financeiras.
7. O evento e marcado como processado ou com erro.

## Fluxo de conciliacao

Status remotos mapeados:

- `CONCLUIDA` ou evento Pix com `endToEndId`: `PAGO`;
- `REMOVIDA_PELO_USUARIO_RECEBEDOR`: `CANCELADO`;
- `REMOVIDA` ou `CANCEL*`: `CANCELADO`;
- `EXPIRADA` ou `EXPIR*`: `VENCIDO`;
- devolucao: `DEVOLVIDO`.

Efeitos locais:

- `PAGO`: atualiza `financial_payments`, `j12_financeiro_cobrancas`,
  `j12_mensalidades` e registra `j12_pagamentos`;
- `CANCELADO`: atualiza `financial_payments` e propaga `cancelado`;
- `VENCIDO`: atualiza `financial_payments` e propaga `atrasado`;
- `DEVOLVIDO`: registra devolucao/cancelamento financeiro e retorna a cobranca para estado aberto
  compativel com vencimento.

## Idempotencia

- Webhook usa `inter_webhook_events.event_hash`;
- insercao usa `INSERT IGNORE`;
- evento com `processed = 1` e tratado como duplicado;
- Pix usa `financial_payments.txid` como chave unica.

## Decisoes tecnicas

- OAuth e mTLS ficam somente no backend.
- Frontend nao duplica regra de conciliacao.
- Frontend chama apenas o endpoint administrativo novo para gerar Pix Banco Inter.
- Rotas legadas permanecem por compatibilidade.
- `PaymentProviderInter` fica desacoplado de controller e de regras visuais.
- Erros externos do Banco Inter sao sanitizados antes de subir para a aplicacao.

## Variaveis de ambiente

Obrigatorias para chamadas reais:

- `INTER_CLIENT_ID`;
- `INTER_CLIENT_SECRET`;
- `INTER_PIX_KEY`;
- `INTER_CERT_PATH` ou `INTER_CERT` ou `BANCO_INTER_CERT_PATH`;
- `INTER_KEY_PATH` ou `INTER_KEY` ou `BANCO_INTER_KEY_PATH`.

Opcionais:

- `INTER_CA_PATH`;
- `INTER_CERT_CHAIN_PATH`;
- `BANCO_INTER_CA_PATH`;
- `INTER_BASE_URL`;
- `INTER_ENVIRONMENT` ou `INTER_ENV`;
- `INTER_TIMEOUT_MS`;
- `INTER_WEBHOOK_SECRET`;
- `INTER_WEBHOOK_URL`;
- `PIX_KEY`;
- `J12_PIX_KEY`.

Sem `INTER_BASE_URL`, producao usa `https://cdpj.partners.bancointer.com.br`; homologacao usa
`https://cdpj-sandbox.partners.uatinter.co` quando `INTER_ENVIRONMENT`/`INTER_ENV` for
`homologacao`, `homologation`, `sandbox` ou `hml`.

## Testes e validacao

Cobertura backend:

- OAuth;
- cache de token;
- mTLS;
- criacao Pix;
- consulta Pix;
- cancelamento;
- webhooks;
- conciliacao;
- idempotencia;
- factory/provider;
- rotas administrativas.

Cobertura frontend:

- API financeira;
- hook administrativo;
- hooks de obrigacoes financeiras;
- invalidacao automatica de queries;
- pagina e rota financeira;
- componentes de cobranca;
- estados `loading`, `empty` e `error`;
- sincronizacao via eventos realtime.

## Pendencias

Nao ha pendencias funcionais no dominio Financeiro para a Sprint 20.2.

Pendencias operacionais fora do desenvolvimento local:

- configurar credenciais e certificados reais por ambiente;
- executar smoke homologado contra sandbox Banco Inter quando as credenciais estiverem disponiveis.
