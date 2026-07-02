# Sprint 12.8 - API Administrativa do Financeiro de Matriculas

## Objetivo

Implementar endpoints administrativos para consultar e operar obrigacoes
financeiras originadas por Matriculas, usando exclusivamente `FinancialFacade`
na borda de controller.

Esta sprint nao integra gateway, nao emite Pix/boleto/cartao, nao altera
frontend/mobile e nao expoe endpoint publico sem protecao administrativa.

## Documentacao e estado anterior

Documentos revisados:

```text
docs/BACKEND/SPRINT_12_6.md
docs/BACKEND/SPRINT_12_7.md
```

Base existente:

```text
FinancialFacade
enrollment_financial_obligations
fluxo interno de status da Sprint 12.7
```

## Decisao tecnica

Endpoints administrativos registrados.

Padrao de protecao adotado:

```text
requireAuth + canManageSystem
```

Mesmo padrao administrativo ja usado por Matriculas em:

```text
backend/src/domains/enrollments/presentation/routes/enrollment-admin.routes.js
```

## Endpoints registrados

Base:

```text
/admin/financial
/api/admin/financial
```

Rotas:

```text
GET /admin/financial/enrollments/:enrollmentId/obligations
GET /admin/financial/students/:studentPersonId/:studentProfileId/summary
POST /admin/financial/obligations/:obligationId/mark-paid
POST /admin/financial/obligations/:obligationId/cancel
POST /admin/financial/obligations/:obligationId/mark-overdue
```

## Uso de FinancialFacade

O controller administrativo:

```text
backend/src/domains/financeiro/presentation/controllers/financial-admin.controller.js
```

chama somente:

```js
financialFacade.listEnrollmentFinancialObligations()
financialFacade.getStudentFinancialSummary()
financialFacade.markEnrollmentFinancialObligationAsPaid()
financialFacade.cancelEnrollmentFinancialObligation()
financialFacade.markEnrollmentFinancialObligationAsOverdue()
```

Nao chama:

```text
repositories
SQL
Prisma
tabelas legadas
services privados
gateway
```

## Repository

Foram adicionadas consultas administrativas internas no repository de
obrigacoes:

```js
listEnrollmentFinancialObligations({ enrollmentId, limit })
listEnrollmentFinancialObligationsByStudentScope({
  studentPersonId,
  studentProfileId,
  limit,
})
```

Essas consultas leem apenas:

```text
enrollments
enrollment_financial_obligations
```

Nao leem ou escrevem:

```text
j12_mensalidades
j12_financeiro_cobrancas
j12_pagamentos
financial_payments
gateway
```

## Smoke tests

```text
FINANCIAL_ADMIN_API_ENABLED=true
FINANCIAL_ADMIN_ROUTES_SECURED=true
FINANCIAL_CONTROLLERS_USE_FACADE=true
FINANCIAL_OBLIGATIONS_ENDPOINT_READY=true
FINANCIAL_SUMMARY_ENDPOINT_READY=true
MARK_PAID_ENDPOINT_READY=true
CANCEL_OBLIGATION_ENDPOINT_READY=true
MARK_OVERDUE_ENDPOINT_READY=true
NO_PUBLIC_ENDPOINT_EXPOSED_UNSAFELY=true
NO_GATEWAY_INTEGRATION=true
NO_NOTIFICATION_SIDE_EFFECTS=true
NO_TEST_DATA_LEFT=true
```

## Validacoes executadas

```text
node --check arquivos alterados: aprovado
node --test backend/src/domains/financeiro/application/tests/*.test.js: aprovado
node --test backend/src/domains/financeiro/infrastructure/repositories/*.test.js: aprovado
node --test backend/src/domains/financeiro/presentation/tests/*.test.js: aprovado
cmd /c npm run build: aprovado
```

## Fora do escopo

Nao foram alterados:

```text
frontend
mobile
Matriculas
Turmas
Agenda
Notificacoes
schema/migrations
gateway/pagamentos externos
legado operacional
regras ja estabilizadas
```

## Proximos passos

A Sprint 12.9 pode consumir essa API administrativa pelo frontend, sem acessar
repository diretamente e sem inventar novas regras financeiras.
