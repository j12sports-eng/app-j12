# Sprint 12.5 - Migration segura para obrigacoes financeiras de matricula

## Objetivo

Criar a estrutura persistente e idempotente para obrigacoes financeiras
originadas por Matricula, preparando o Financeiro para uma criacao real em
sprint futura.

Esta sprint nao cria cobranca real, mensalidade real, pagamento, gateway,
frontend, rota publica ou integracao com financeiro legado.

## Documentacao e estado anterior

Documentos revisados:

```text
docs/BACKEND/SPRINT_12_3.md
docs/BACKEND/SPRINT_12_4.md
docs/ARQUITETURA/FINANCIAL_ARCHITECTURE.md
backend/src/database/migrations/README.md
```

Lacuna que esta sprint resolve:

```text
ausencia de tabela segura com chave enrollment_id + obligation_type
```

Lacunas que permanecem fora desta sprint:

```text
fonte canonica de plano por enrollments.id
fonte canonica de valor por enrollments.id
fonte canonica de vencimento por enrollments.id
criacao real de mensalidade/cobranca/lancamento
```

## Migration

Arquivo:

```text
backend/src/database/migrations/20260702120000_create_enrollment_financial_obligations_table.js
```

Uso manual:

```bash
node backend/src/database/migrations/20260702120000_create_enrollment_financial_obligations_table.js status
node backend/src/database/migrations/20260702120000_create_enrollment_financial_obligations_table.js up
node backend/src/database/migrations/20260702120000_create_enrollment_financial_obligations_table.js down
```

Tabela criada:

```text
enrollment_financial_obligations
```

Colunas:

```text
id VARCHAR(64) NOT NULL
enrollment_id VARCHAR(64) NOT NULL
obligation_type VARCHAR(64) NOT NULL
status VARCHAR(32) NOT NULL DEFAULT 'PREPARED'
amount DECIMAL(12,2) NULL
currency VARCHAR(3) NULL
plan_id VARCHAR(64) NULL
due_date DATE NULL
source VARCHAR(50) NOT NULL DEFAULT 'ENROLLMENT'
created_by VARCHAR(191) NULL
created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
cancelled_at DATETIME NULL
cancelled_by VARCHAR(191) NULL
metadata_json LONGTEXT NULL
```

## Indices e FK

Indices:

```text
idx_enrollment_financial_obligations_enrollment_id (enrollment_id)
idx_enrollment_financial_obligations_status (status)
idx_enrollment_financial_obligations_due_date (due_date)
ux_enrollment_financial_obligations_enrollment_type (enrollment_id, obligation_type)
```

FK:

```text
fk_enrollment_financial_obligations_enrollment
enrollment_financial_obligations.enrollment_id -> enrollments.id
ON UPDATE CASCADE
ON DELETE RESTRICT
```

A migration valida que `enrollments` existe, usa InnoDB e possui `id
VARCHAR(64)` antes de criar a tabela.

## Repository

Repository criado:

```text
backend/src/domains/financeiro/infrastructure/repositories/mysql-enrollment-financial-obligation.repository.js
```

Metodos preparados:

```js
findEnrollmentFinancialObligation({
  enrollmentId,
  obligationType,
})
```

```js
createEnrollmentFinancialObligationRecord({
  enrollmentId,
  obligationType,
  status,
  amount,
  currency,
  planId,
  dueDate,
  source,
  createdBy,
  metadata,
})
```

O repository toca somente:

```text
enrollment_financial_obligations
```

Nao toca:

```text
j12_mensalidades
j12_financeiro_cobrancas
j12_pagamentos
financial_payments
gateway
```

## Idempotencia

Garantia fisica:

```text
UNIQUE (enrollment_id, obligation_type)
```

Se uma segunda tentativa disparar erro `ER_DUP_ENTRY/1062` da unique key
`ux_enrollment_financial_obligations_enrollment_type`, o repository trata como
caso idempotente e retorna o registro existente.

## Rollback

`down` remove a tabela apenas se ela estiver vazia.

Se houver qualquer linha, o rollback recusa `DROP TABLE` e exige plano aprovado
de limpeza/backup antes de remover dados financeiros preparados.

## Smoke tests

```text
ENROLLMENT_FINANCIAL_OBLIGATION_TABLE_CREATED=true
ENROLLMENT_FINANCIAL_OBLIGATION_FK_CREATED=true
ENROLLMENT_OBLIGATION_UNIQUE_INDEX_CREATED=true
ENROLLMENT_OBLIGATION_REPOSITORY_PREPARED=true
DUPLICATE_OBLIGATION_BLOCKED=true
NO_REAL_CHARGE_CREATED=true
NO_REAL_INSTALLMENT_CREATED=true
NO_PAYMENT_CREATED=true
NO_GATEWAY_INTEGRATION=true
NO_TEST_DATA_LEFT=true
```

## Validacoes executadas

Validacoes concluidas:

```text
node --check backend/src/database/migrations/20260702120000_create_enrollment_financial_obligations_table.js: aprovado
node --check nos arquivos JS alterados/criados: aprovado
node --test backend/src/domains/financeiro/application/tests/*.test.js: aprovado
node --test backend/src/domains/financeiro/infrastructure/repositories/*.test.js: aprovado
cmd /c node backend/src/database/migrations/20260702120000_create_enrollment_financial_obligations_table.js status: aprovado
cmd /c node backend/src/database/migrations/20260702120000_create_enrollment_financial_obligations_table.js up: aprovado
smoke transacional com rollback: aprovado
cmd /c npm run build: aprovado
```

## Smoke transacional real

Executado em MySQL/Percona 5.7.44 criando, apenas dentro de uma transacao:

```text
people
person_profiles
enrollments
enrollment_financial_obligations
```

Resultados:

```text
ENROLLMENT_FINANCIAL_OBLIGATION_FK_CREATED=true
ENROLLMENT_OBLIGATION_UNIQUE_INDEX_CREATED=true
FK_BLOCKED_INVALID_ENROLLMENT=true
DUPLICATE_OBLIGATION_BLOCKED=true
SMOKE_ROWS_INSIDE_TRANSACTION=1
NO_TEST_DATA_LEFT=true
NO_REAL_CHARGE_CREATED=true
NO_REAL_INSTALLMENT_CREATED=true
NO_PAYMENT_CREATED=true
NO_GATEWAY_INTEGRATION=true
```

## Bloqueios remanescentes

A tabela fica pronta para a Sprint 12.6, mas a obrigacao financeira real ainda
deve continuar bloqueada ate existir:

```text
fonte confiavel de plano
fonte confiavel de valor
fonte confiavel de vencimento
politica de status/baixa/cancelamento
integracao transacional aprovada com o fluxo de criacao real
```

## Fora do escopo

Nao foram alterados:

```text
frontend
mobile
API publica
Turmas
Agenda
Notificacoes
pagamentos/gateway
legado operacional
regras financeiras existentes
```
