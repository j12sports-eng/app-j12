# Sprint 20.1 - Fase A - Arquitetura Financeira de Payment Providers

## Objetivo

Criar uma camada backend desacoplada para cobrancas e pagamentos no dominio Financeiro.

Esta fase entrega a infraestrutura de arquitetura. Nenhuma chamada real para Banco Inter,
Asaas, InfinitePay, Mercado Pago ou Cora foi implementada aqui.

## Escopo

Novo subdominio:

- `backend/src/domains/financeiro/payment`

A camada implementa:

- Entity de cobranca e pagamento;
- DTOs de saida;
- validators de entrada;
- interface comum `PaymentProvider`;
- providers planejados para gateways futuros;
- `PaymentGatewayFactory`;
- `ChargeService`;
- `PaymentService`;
- repository MySQL;
- controller administrativo;
- rotas administrativas;
- testes focados.

## Providers Suportados pela Arquitetura

Os providers abaixo ja sao aceitos pela factory e seguem a mesma interface:

- `banco_inter`
- `asaas`
- `infinitepay`
- `mercado_pago`
- `cora`
- `manual`

Na Fase A todos usam `PlannedPaymentProvider`, que registra o contrato comum e retorna
`NOT_IMPLEMENTED` para chamadas externas. Isso permite trocar o provider em service/controller
sem alterar o restante do sistema.

## Endpoints

Base montada:

- `/admin/financeiro`
- `/api/admin/financeiro`

Rotas internas:

- `POST /api/admin/financeiro/cobrancas`
- `GET /api/admin/financeiro/cobrancas`
- `GET /api/admin/financeiro/cobrancas/:id`
- `PATCH /api/admin/financeiro/cobrancas/:id`
- `DELETE /api/admin/financeiro/cobrancas/:id`

Todas usam o padrao administrativo existente:

- `requireAuth`
- `canManageSystem`

## Persistencia

Tabela criada sob demanda pelo repository:

- `financial_gateway_charges`

Campos principais:

- `id`
- `legacy_charge_id`
- `mensalidade_id`
- `student_id`
- `responsible_id`
- `provider`
- `status`
- `amount`
- `currency`
- `description`
- `due_date`
- `payment_method`
- `external_id`
- `checkout_url`
- `provider_payload`
- `metadata_json`
- campos de auditoria e cancelamento

A tabela nao substitui:

- `j12_financeiro_cobrancas`
- `j12_mensalidades`
- `j12_pagamentos`
- `financial_payments`

Ela funciona como camada generica de gateway e pode apontar para cobrancas/mensalidades legadas
por `legacy_charge_id` e `mensalidade_id`.

## Fluxo de Criacao

1. Controller recebe a requisicao administrativa.
2. `ChargeService` valida entrada obrigatoria.
3. `PaymentGatewayFactory` resolve o provider informado.
4. Provider planejado registra a acao sem chamar API externa.
5. Repository persiste a cobranca local em `financial_gateway_charges`.
6. DTO retorna `success/data` com dados da cobranca e snapshot do gateway.

## Fluxo de Atualizacao

1. Service carrega a cobranca existente.
2. Validators normalizam patch permitido.
3. Caso o provider seja alterado, a factory resolve o novo provider.
4. Repository atualiza os campos locais.
5. DTO retorna a cobranca atualizada.

## Fluxo de Cancelamento

`DELETE /cobrancas/:id` executa cancelamento logico:

- status `CANCELLED`;
- `cancelled_by`;
- `cancellation_reason`;
- `cancelled_at`;
- payload do provider planejado.

Nao ha exclusao fisica nesta fase.

## Regras Implementadas

- Criacao requer `studentId`, `description`, `amount > 0` e `dueDate`.
- Provider deve estar na lista suportada.
- Status deve estar na lista suportada.
- Atualizacao vazia e rejeitada.
- Troca de provider ocorre sem alterar o contrato HTTP.
- Chamadas externas permanecem bloqueadas por design da Fase A.

## Testes

Testes criados:

- `backend/src/domains/financeiro/payment/application/tests/payment-charge.service.test.js`
- `backend/src/domains/financeiro/payment/presentation/tests/payment-admin.controller.test.js`
- `backend/src/domains/financeiro/payment/infrastructure/repositories/mysql-payment.repository.test.js`

Cobertura funcional:

- criacao de cobranca;
- atualizacao;
- cancelamento;
- troca de provider;
- regras de validacao;
- registro das rotas;
- persistencia local MySQL.

## Fora de Escopo

- Integracao real com Banco Inter;
- chamadas reais para Asaas, InfinitePay, Mercado Pago ou Cora;
- webhook de provider;
- conciliacao automatica;
- frontend;
- n8n;
- alteracoes em Campeonatos, Agenda, Professores, Alunos, Portais ou Autenticacao.

## Pendencias

- Implementar provider real Banco Inter sobre `PaymentProvider`;
- migrar ou adaptar a implementacao especifica de Inter para usar a factory generica;
- adicionar providers reais adicionais conforme prioridade;
- decidir se `financial_gateway_charges` recebera migration formal ou permanecera bootstrap sob demanda;
- conectar conciliacao generica aos pagamentos confirmados dos gateways.
