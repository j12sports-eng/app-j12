# Sprint 9.34 - Auditoria De Confirmacao De Matricula

## Objetivo

Adicionar suporte fisico no banco para persistir os metadados de confirmacao
de matricula:

```text
confirmed_at
confirmed_by
```

Esta sprint complementa a Sprint 9.33, que preparou
`confirmDraftEnrollment()` para confirmar uma matricula persistida de `DRAFT`
para `ACTIVE`.

## Arquivos Alterados

```text
backend/src/database/migrations/20260629232350_add_enrollment_confirmation_audit_columns.js
backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment.repository.js
docs/BACKEND/SPRINT_9_34.md
```

## Migration

Migration criada:

```text
backend/src/database/migrations/20260629232350_add_enrollment_confirmation_audit_columns.js
```

Colunas adicionadas em `enrollments`, somente se ainda nao existirem:

```sql
confirmed_at DATETIME NULL
confirmed_by VARCHAR(191) NULL
```

A migration usa `information_schema.columns` antes de executar cada
`ALTER TABLE`, valida a existencia da tabela `enrollments` e interrompe se
encontrar colunas existentes com tipos incompativeis.

Comandos suportados:

```bash
node backend/src/database/migrations/20260629232350_add_enrollment_confirmation_audit_columns.js status
node backend/src/database/migrations/20260629232350_add_enrollment_confirmation_audit_columns.js up
node backend/src/database/migrations/20260629232350_add_enrollment_confirmation_audit_columns.js down
```

## Repository

Arquivo atualizado:

```text
backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment.repository.js
```

Ao confirmar para `ACTIVE`, o repository passa a persistir:

```text
status = ACTIVE
confirmed_at = valor recebido ou CURRENT_TIMESTAMP
confirmed_by = valor recebido ou NULL
updated_at = CURRENT_TIMESTAMP
```

`confirmed_by` permanece nullable para permitir confirmacoes internas sem
usuario definido, conforme o contrato atual.

## Smoke Test

Smoke test de escrita executado com transacao e rollback.

Cenarios validados:

```text
CONFIRMATION_AUDIT_COLUMNS_CREATED=true
DRAFT_CAN_BE_CONFIRMED_WITH_AUDIT=true
CONFIRMED_AT_PERSISTED=true
CONFIRMED_BY_PERSISTED=true
NO_FINANCIAL_SIDE_EFFECTS=true
NO_CLASS_SIDE_EFFECTS=true
NO_TEST_DATA_LEFT=true
```

## Fora Do Escopo

Nao foram alterados:

```text
frontend
API publica
controllers
rotas
financeiro
mensalidades
turmas
legado
/public/enrollments
fluxo publico de criacao de aluno
```

## Observacoes

- O schema real usa MySQL/MariaDB via `mysql2`, com `DATETIME` e
  `VARCHAR(191)`, apesar de documentacoes antigas mencionarem PostgreSQL.
- A migration e manual e nao e chamada por build, startup ou deploy scripts.
