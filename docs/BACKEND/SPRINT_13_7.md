# Sprint 13.7 - Busca financeira de aluno via FinancialFacade

## Objetivo

Consolidar a busca de aluno usada pelo painel financeiro dentro da fronteira do
Financeiro, mantendo controllers financeiros sem acesso direto a repositories.

## Endpoint

```text
GET /admin/financial/students/search?q=:query&limit=:limit
GET /api/admin/financial/students/search?q=:query&limit=:limit
```

Protecao:

```text
requireAuth + canManageSystem
```

## Arquitetura

```text
FinancialAdminController
  -> FinancialFacade.searchFinancialStudentScopes()
      -> FinancialApplicationService.searchFinancialStudentScopes()
          -> studentScopeReader.searchStudentScopes()
              -> EnrollmentFacade
                  -> EnrollmentApplicationService
                      -> MySqlEnrollmentRepository
```

O controller financeiro continua chamando somente `FinancialFacade`.

## Decisao tecnica

Financeiro nao duplicou SQL de Pessoas ou Matriculas. A rota financeira injeta
um leitor de escopos baseado na `EnrollmentFacade`, reaproveitando o contrato
administrativo ja existente.

## Garantias

```text
FINANCIAL_STUDENT_SCOPE_SEARCH_ENABLED=true
FINANCIAL_CONTROLLER_USES_FACADE_ONLY=true
NO_DIRECT_REPOSITORY_ACCESS_IN_CONTROLLER=true
NO_GATEWAY_INTEGRATION=true
NO_PAYMENT_CREATED=true
NO_NOTIFICATION_SIDE_EFFECTS=true
NO_PUBLIC_API_CHANGE=true
```

## Arquivos principais

```text
backend/src/domains/financeiro/application/facades/financial.facade.js
backend/src/domains/financeiro/application/services/financial-application.service.js
backend/src/domains/financeiro/presentation/controllers/financial-admin.controller.js
backend/src/domains/financeiro/presentation/routes/financial-admin.routes.js
backend/src/domains/financeiro/application/tests/financial.facade.test.js
backend/src/domains/financeiro/application/tests/financial-application.service.test.js
backend/src/domains/financeiro/presentation/tests/financial-admin.controller.test.js
```

## Fora do escopo

```text
gateway
Pix
boleto
cartao
pagamento externo
notificacao
criacao automatica universal de obrigacao financeira
alteracao de repository no controller
```
