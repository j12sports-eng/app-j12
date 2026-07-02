# Sprint 13.6 - Busca de aluno no painel financeiro

## Objetivo

Remover a dependencia operacional de digitar manualmente `studentPersonId` e
`studentProfileId` no painel financeiro administrativo.

## Entrega

O painel `FinancialAdminEnrollmentPanel` passa a buscar alunos por:

```text
nome
CPF
e-mail
id da Pessoa
id do Perfil
```

Ao selecionar um resultado, o painel preenche o escopo Pessoa/Perfil e carrega
o resumo financeiro do aluno.

## Arquitetura

O frontend usa apenas o client central:

```text
src/lib/api.ts
```

Na versao final consolidada pela Sprint 13.7, a busca usa:

```text
GET /api/admin/financial/students/search
```

## Arquivos

```text
src/features/financial/api/financial.api.ts
src/features/financial/hooks/useFinancialStudentScopeSearch.ts
src/features/financial/pages/FinancialAdminEnrollmentPanel.tsx
src/features/financial/types/financial.types.ts
```

## Garantias

```text
NO_HARDCODED_API_URL=true
NO_PAYMENT_CREATED=true
NO_GATEWAY_INTEGRATION=true
NO_LEGACY_FINANCE_WRITE=true
EXISTING_MANUAL_SCOPE_INPUTS_PRESERVED=true
```

## Proximos passos para Sprint 13.7

```text
Consolidar o endpoint de busca no backend Financeiro por FinancialFacade, para
que o painel financeiro nao precise consumir diretamente a rota administrativa
de Matriculas.
```
