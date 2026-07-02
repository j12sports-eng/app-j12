# Sprint 12.6 - Persistencia real da obrigacao financeira inicial da matricula

## Objetivo

Implementar a persistencia real do registro financeiro interno da primeira
obrigacao de uma Matricula `ACTIVE`, usando a tabela segura criada na Sprint
12.5.

Esta sprint nao cria pagamento, gateway, baixa, cobranca externa,
mensalidade legada, agenda, notificacao, frontend ou rota publica.

## Documentacao e estado anterior

Documentos revisados:

```text
docs/BACKEND/SPRINT_12_3.md
docs/BACKEND/SPRINT_12_4.md
docs/BACKEND/SPRINT_12_5.md
```

Base segura recebida da Sprint 12.5:

```text
enrollment_financial_obligations
UNIQUE (enrollment_id, obligation_type)
FK enrollment_financial_obligations.enrollment_id -> enrollments.id
```

## Decisao tecnica

Persistencia real implementada no service de aplicacao Financeiro.

O metodo:

```js
createInitialEnrollmentFinancialObligation({
  enrollmentId,
  requestedBy,
})
```

agora segue este fluxo:

```text
1. valida enrollmentId/requestedBy
2. busca a Matricula via enrollmentReader
3. prepara o billing contract da Sprint 12.3
4. bloqueia sem escrita se houver blockers
5. bloqueia sem escrita se nao houver repository idempotente injetado
6. persiste em enrollment_financial_obligations quando contrato e repository estao prontos
7. reutiliza registro existente em duplicidade controlada pela unique key
```

## Persistencia

Tabela gravada:

```text
enrollment_financial_obligations
```

Campos de criacao:

```text
enrollment_id
obligation_type = INITIAL_ENROLLMENT_OBLIGATION
status = PREPARED
amount
currency
plan_id
due_date
source = ENROLLMENT
created_by
metadata_json
```

O registro criado e uma obrigacao financeira interna preparada. Ele nao e:

```text
pagamento
baixa
cobranca externa
gateway
mensalidade legada
lancamento financeiro legado
```

## Idempotencia

A idempotencia fisica e garantida por:

```text
enrollment_id + obligation_type
```

Se uma segunda chamada tentar criar a mesma obrigacao, o repository trata a
duplicidade da unique key e retorna o registro existente como reutilizado.

Marcadores do retorno:

```text
created=true quando o registro foi criado
reused=true quando o registro existente foi reutilizado
persisted=true quando ha registro interno gravado ou reutilizado
noPaymentCreated=true sempre
noGatewayIntegration=true sempre
```

## Blockers

A criacao real continua bloqueada, sem escrita, quando o billing contract nao
possui fonte confiavel de:

```text
plano
valor
vencimento
ciclo
moeda
Matricula ACTIVE
escopo de aluno
```

Tambem continua bloqueada se o metodo for usado sem repository financeiro
idempotente injetado. Isso preserva compatibilidade com consumidores que ainda
usam apenas a preparacao do contrato.

## Smoke tests

Caminho implementado:

```text
INITIAL_FINANCIAL_OBLIGATION_PERSISTENCE_ENABLED=true
ACTIVE_ENROLLMENT_CREATED_OBLIGATION_RECORD=true
DRAFT_ENROLLMENT_BLOCKED=true
BILLING_CONTRACT_BLOCKERS_HANDLED=true
DUPLICATE_OBLIGATION_REUSED=true
UNIQUE_INDEX_PROTECTED_DUPLICATE=true
NO_PAYMENT_CREATED=true
NO_GATEWAY_INTEGRATION=true
NO_NOTIFICATION_SIDE_EFFECTS=true
NO_TEST_DATA_LEFT=true
```

## Validacoes executadas

```text
node --test backend/src/domains/financeiro/application/tests/*.test.js: aprovado
node --test backend/src/domains/financeiro/infrastructure/repositories/*.test.js: aprovado
```

Validacoes finais da sprint:

```text
node --check arquivos alterados: aprovado
smoke transacional com rollback: aprovado
cmd /c npm run build: aprovado
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
INITIAL_FINANCIAL_OBLIGATION_PERSISTENCE_ENABLED=true
ACTIVE_ENROLLMENT_CREATED_OBLIGATION_RECORD=true
DRAFT_ENROLLMENT_BLOCKED=true
BILLING_CONTRACT_BLOCKERS_HANDLED=true
DUPLICATE_OBLIGATION_REUSED=true
UNIQUE_INDEX_PROTECTED_DUPLICATE=true
SMOKE_ROWS_INSIDE_TRANSACTION=1
NO_PAYMENT_CREATED=true
NO_GATEWAY_INTEGRATION=true
NO_NOTIFICATION_SIDE_EFFECTS=true
NO_TEST_DATA_LEFT=true
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
regras de matricula ja estabilizadas
```

## Proximos passos

Definir, em sprint futura, a fonte canonica operacional de plano, valor e
vencimento para producao/homologacao quando ela ainda nao estiver disponivel
para uma Matricula real.
