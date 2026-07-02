# Sprint 12.7 - Baixa e status da obrigacao financeira da matricula

## Objetivo

Implementar o fluxo interno de status da obrigacao financeira originada por
Matricula, sem integrar gateway, sem processar pagamento real e sem alterar API
publica, frontend, Matriculas, Turmas, Agenda ou Notificacoes.

## Documentacao e estado anterior

Documentos revisados:

```text
docs/BACKEND/SPRINT_12_5.md
docs/BACKEND/SPRINT_12_6.md
```

Base persistente existente:

```text
enrollment_financial_obligations.status
enrollment_financial_obligations.updated_at
enrollment_financial_obligations.cancelled_at
enrollment_financial_obligations.cancelled_by
enrollment_financial_obligations.metadata_json
```

## Decisao tecnica

Fluxo de status real implementado.

A tabela ja possui campos suficientes para:

```text
status operacional
data de atualizacao
auditoria de cancelamento
auditoria complementar em metadata_json
```

Nao foi criada migration.

## Metodos internos

Criados no service/facade Financeiro:

```js
markEnrollmentFinancialObligationAsPaid({
  obligationId,
  paidAt,
  paidBy,
  paymentReference,
})
```

```js
cancelEnrollmentFinancialObligation({
  obligationId,
  cancelledAt,
  cancelledBy,
  reason,
})
```

```js
markEnrollmentFinancialObligationAsOverdue({
  obligationId,
  checkedAt,
})
```

## Status existentes

Status suportados pelo fluxo interno:

```text
PREPARED
PENDING
OVERDUE
PAID
CANCELLED
```

`PREPARED` permanece suportado porque e o status criado na Sprint 12.6 para a
obrigacao interna inicial. Para a Sprint 12.7, `PREPARED` e `PENDING` sao
tratados como estados abertos antes de baixa/cancelamento/vencimento.

## Transicoes permitidas

```text
PENDING -> PAID
PENDING -> CANCELLED
PENDING -> OVERDUE
PREPARED -> PAID
PREPARED -> CANCELLED
PREPARED -> OVERDUE
OVERDUE -> PAID
OVERDUE -> CANCELLED
```

## Transicoes bloqueadas

```text
PAID -> PENDING
PAID -> CANCELLED
CANCELLED -> PAID
CANCELLED -> PENDING
CANCELLED -> OVERDUE
```

Transicoes invalidas retornam erro controlado:

```text
FINANCIAL_OBLIGATION_INVALID_STATUS_TRANSITION
```

## Auditoria

Auditoria persistida:

```text
metadata_json.statusAudit[]
metadata_json.statusFlowVersion = sprint-12.7
metadata_json.noPaymentCreated = true
metadata_json.noGatewayIntegration = true
metadata_json.noNotificationSideEffects = true
```

Cancelamento tambem grava:

```text
cancelled_at
cancelled_by
```

Baixa manual como `PAID` grava apenas status e auditoria interna. Ela nao cria
registro em `j12_pagamentos`, `financial_payments`, gateway, Pix, boleto ou
cartao.

## Repository

Metodos adicionados:

```js
findEnrollmentFinancialObligationById({ obligationId })
updateEnrollmentFinancialObligationStatus({
  obligationId,
  status,
  currentStatuses,
  cancelledAt,
  cancelledBy,
  metadata,
})
```

O update usa guarda de transicao:

```text
WHERE id = ? AND status IN (...)
```

Isso evita sobrescrever estados terminais se o registro tiver mudado entre a
leitura e a escrita.

## Smoke tests

```text
FINANCIAL_OBLIGATION_STATUS_FLOW_ENABLED=true
PENDING_CAN_BE_MARKED_PAID=true
PENDING_CAN_BE_CANCELLED=true
PENDING_CAN_BE_MARKED_OVERDUE=true
OVERDUE_CAN_BE_MARKED_PAID=true
INVALID_STATUS_TRANSITION_BLOCKED=true
PAYMENT_AUDIT_PERSISTED_IF_AVAILABLE=true
NO_GATEWAY_INTEGRATION=true
NO_NOTIFICATION_SIDE_EFFECTS=true
NO_TEST_DATA_LEFT=true
```

## Smoke transacional real

Executado em MySQL/Percona criando, apenas dentro de uma transacao:

```text
people
person_profiles
enrollments
enrollment_financial_obligations
```

Resultados:

```text
FINANCIAL_OBLIGATION_STATUS_FLOW_ENABLED=true
PENDING_CAN_BE_MARKED_PAID=true
PENDING_CAN_BE_CANCELLED=true
PENDING_CAN_BE_MARKED_OVERDUE=true
OVERDUE_CAN_BE_MARKED_PAID=true
INVALID_STATUS_TRANSITION_BLOCKED=true
PAYMENT_AUDIT_PERSISTED_IF_AVAILABLE=true
SMOKE_ROWS_INSIDE_TRANSACTION=3
NO_GATEWAY_INTEGRATION=true
NO_NOTIFICATION_SIDE_EFFECTS=true
NO_TEST_DATA_LEFT=true
```

## Validacoes executadas

```text
node --check arquivos alterados: aprovado
node --test backend/src/domains/financeiro/application/tests/*.test.js: aprovado
node --test backend/src/domains/financeiro/infrastructure/repositories/*.test.js: aprovado
smoke transacional com rollback: aprovado
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
gateway/pagamentos externos
legado operacional
regras ja estabilizadas
```

## Proximos passos

Integracao com gateway, conciliacao de pagamentos, baixa automatica e
notificacoes financeiras devem ficar para sprints futuras com contrato proprio.
