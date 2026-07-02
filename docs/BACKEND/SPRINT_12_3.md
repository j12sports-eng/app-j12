# Sprint 12.3 - Contrato de Plano, Valor e Vencimento para Matricula

## Objetivo

Preparar o contrato financeiro minimo para uma matricula `ACTIVE`, antes da
criacao de qualquer mensalidade, cobranca, lancamento financeiro ou pagamento.

Esta sprint cria apenas a borda read-only do dominio Financeiro para responder
se existe fonte confiavel de:

```text
plano
valor
dia de vencimento
primeiro vencimento
ciclo de cobranca
moeda
```

## Documentacao e estado anterior

Documentos relacionados revisados:

```text
docs/ARQUITETURA/FINANCIAL_ARCHITECTURE.md
docs/BACKEND/SPRINT_9_51.md
docs/BACKEND/SPRINT_9_60.md
```

Nao havia `docs/BACKEND/SPRINT_12_1.md` ou `docs/BACKEND/SPRINT_12_2.md` no
workspace no momento da execucao desta sprint.

## Fontes financeiras encontradas

Arquivos operacionais existentes:

```text
backend/src/services/financeiro.service.js
backend/src/controllers/financeiro.controller.js
backend/src/routes/financeiro.routes.js
backend/src/routes/planos.routes.js
```

Fronteira de dominio existente:

```text
backend/src/domains/financeiro
```

Tabelas/estruturas mapeadas por codigo:

```text
j12_planos
j12_alunos
j12_mensalidades
j12_financeiro_cobrancas
j12_pagamentos
financeiro
financial_payments
```

## Decisao tecnica

Contrato/documentacao preparatoria.

Nao foi criada mensalidade ou cobranca real porque o modulo financeiro atual
continua acoplado ao cadastro legado `j12_alunos` e nao possui fonte canonica
segura para `enrollments.id`.

Principais lacunas:

```text
nao ha vinculo fisico confiavel enrollments.id -> j12_alunos.id
nao ha tabela de contrato financeiro por enrollment
nao ha chave idempotente enrollment_id + obligation_type
nao ha vencimento canonico por matricula no novo dominio
nao ha moeda/ciclo canonico no schema de matriculas
```

## Implementacao

Arquivos criados/alterados:

```text
backend/src/domains/financeiro/index.js
backend/src/domains/financeiro/README.md
backend/src/domains/financeiro/application/index.js
backend/src/domains/financeiro/application/contracts/index.js
backend/src/domains/financeiro/application/contracts/enrollment-billing-contract.contract.js
backend/src/domains/financeiro/application/services/index.js
backend/src/domains/financeiro/application/services/financial-application.service.js
backend/src/domains/financeiro/application/facades/index.js
backend/src/domains/financeiro/application/facades/financial.facade.js
backend/src/domains/financeiro/application/tests/financial-application.service.test.js
backend/src/domains/financeiro/application/tests/financial.facade.test.js
docs/BACKEND/SPRINT_12_3.md
```

Novo metodo interno:

```js
prepareEnrollmentBillingContract({
  enrollmentId,
  studentPersonId,
  studentProfileId,
  classId,
  requestedBy,
})
```

Retorno normalizado:

```js
{
  enrollmentId,
  studentPersonId,
  studentProfileId,
  classId,
  planId,
  amount,
  dueDay,
  firstDueDate,
  billingCycle,
  currency,
  status,
  canCreateBilling,
  blockers
}
```

## Regras aplicadas

O service:

```text
valida enrollmentId e requestedBy
busca Enrollment persistido por reader injetado
mantem matricula inexistente como erro controlado
bloqueia matricula nao ACTIVE via blockers do contrato
confere studentPersonId/studentProfileId quando informados
usa somente billingSourceReader injetado como fonte de plano/valor/vencimento
retorna blockers quando a fonte confiavel nao existe
nao consulta SQL diretamente
nao cria cobranca
nao cria mensalidade
nao cria pagamento
nao altera API publica
```

## Blockers do contrato

```text
STUDENT_SCOPE_MISSING
ENROLLMENT_STATUS_NOT_RESOLVED
ENROLLMENT_NOT_ACTIVE
BILLING_PLAN_NOT_RESOLVED
BILLING_AMOUNT_NOT_RESOLVED
BILLING_DUE_DAY_NOT_RESOLVED
BILLING_FIRST_DUE_DATE_NOT_RESOLVED
BILLING_CYCLE_NOT_RESOLVED
BILLING_CURRENCY_NOT_RESOLVED
```

## Smoke tests

Caminho adotado: preparado/bloqueado por falta de fonte canonica confiavel.

```text
ENROLLMENT_BILLING_CONTRACT_PREPARED=true
BILLING_PLAN_OR_AMOUNT_GAP_DOCUMENTED=true
NO_FAKE_AMOUNT_CREATED=true
NO_FAKE_DUE_DATE_CREATED=true
BILLING_CONTRACT_RETURNS_BLOCKERS=true
BILLING_CONTRACT_IS_READ_ONLY=true
NO_CHARGE_CREATED=true
NO_INSTALLMENT_CREATED=true
NO_PAYMENT_CREATED=true
NO_SCHEMA_CHANGE=true
NO_TEST_DATA_LEFT=true
```

## Validacoes executadas

Validacoes concluidas:

```text
node --check nos arquivos JS alterados/criados: aprovado
node --test backend/src/domains/financeiro/application/tests/*.test.js: aprovado
node --test backend/src/domains/enrollments/application/tests/*.test.js: aprovado
cmd /c npm run build: aprovado
```

## Fora do escopo

Nao foram alterados:

```text
frontend
mobile
API publica
Matriculas
Turmas
Agenda
Notificacoes
schema
migrations
pagamentos/gateway
legado operacional
```

## Proximos passos

1. Definir fonte canonica de plano/valor/vencimento para `enrollments.id`.
2. Criar migration futura apenas se aprovada, com chave idempotente por
   `enrollment_id + obligation_type`.
3. Implementar adapter read-only confiavel para resolver contrato financeiro.
4. Somente depois liberar criacao real da obrigacao financeira inicial.
