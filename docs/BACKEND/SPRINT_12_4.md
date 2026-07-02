# Sprint 12.4 - Gerar Obrigacao Financeira Inicial da Matricula

## Objetivo

Preparar a criacao da primeira obrigacao financeira a partir de uma Matricula
`ACTIVE`, usando o contrato de plano, valor e vencimento definido na Sprint
12.3.

Esta sprint nao cria cobranca, mensalidade, lancamento financeiro, pagamento,
gateway, rota publica ou migration.

## Documentacao e estado anterior

Documentos/codigo revisados:

```text
docs/BACKEND/SPRINT_12_3.md
docs/ARQUITETURA/FINANCIAL_ARCHITECTURE.md
docs/BACKEND/SPRINT_9_51.md
backend/src/domains/financeiro/application/services/financial-application.service.js
backend/src/domains/financeiro/application/facades/financial.facade.js
backend/src/domains/enrollments/application/services/enrollment-financial.service.js
```

Estado encontrado:

```text
FinancialFacade existe no dominio Financeiro
prepareEnrollmentBillingContract() retorna blockers quando plano/valor/vencimento nao sao confiaveis
financeiro operacional legado continua baseado em j12_alunos/j12_planos
nao ha tabela segura enrollment_id + obligation_type
```

## Decisao tecnica

Obrigacao financeira inicial bloqueada/preparada.

Nao houve criacao real porque ainda nao existe fonte canonica segura para
plano, valor e vencimento por `enrollments.id`, nem tabela/chave de idempotencia
para impedir duplicidade por:

```text
enrollment_id + obligation_type
```

## Implementacao

Metodo criado no dominio Financeiro:

```js
createInitialEnrollmentFinancialObligation({
  enrollmentId,
  requestedBy,
})
```

Fluxo:

```text
valida enrollmentId e requestedBy via contrato da Sprint 12.3
busca Enrollment persistido por enrollmentReader
valida status ACTIVE pelo billing contract
resolve plano/valor/vencimento por billingSourceReader quando existir
bloqueia se houver blockers do contrato financeiro
bloqueia se contrato estiver pronto mas nao houver schema idempotente seguro
retorna chave logica de idempotencia deterministica
nao persiste nada
```

## Contrato de retorno

Campos principais:

```text
initialFinancialObligationPrepared=true
created=false
persisted=false
obligationCreated=false
obligationId=null
obligationType=INITIAL_ENROLLMENT_OBLIGATION
blocked=true
noChargeCreated=true
noInstallmentCreated=true
noPaymentCreated=true
noSchemaChange=true
```

## Idempotencia

Chave logica preparada:

```text
enrollment:<enrollmentId>:obligation:INITIAL_ENROLLMENT_OBLIGATION
```

Campos esperados para migration futura:

```text
enrollment_id
obligation_type
```

Como nao existe tabela/constraint aprovada para essa chave, a duplicidade real
continua bloqueada por schema/rule gap e nenhuma escrita e executada.

## Blockers

Blockers vindos do billing contract:

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

Blocker adicional quando o contrato financeiro estiver pronto, mas ainda nao
houver schema seguro:

```text
FINANCIAL_OBLIGATION_SCHEMA_OR_IDEMPOTENCY_GAP
```

## Smoke tests

Caminho adotado: bloqueado/preparado.

```text
INITIAL_FINANCIAL_OBLIGATION_PREPARED=true
FINANCIAL_OBLIGATION_BLOCKED_BY_BILLING_CONTRACT=true
NO_FAKE_CHARGE_CREATED=true
NO_FAKE_INSTALLMENT_CREATED=true
NO_FAKE_PAYMENT_CREATED=true
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
Turmas
Agenda
Notificacoes
pagamentos/gateway
schema
migrations
legado operacional
```

## Proximos passos

1. Definir fonte canonica de plano/valor/vencimento por `enrollments.id`.
2. Criar migration aprovada para obrigacoes financeiras iniciais com chave
   `enrollment_id + obligation_type`.
3. Implementar repository transacional/idempotente somente apos a migration.
4. Criar smoke com rollback quando houver escrita real aprovada.
