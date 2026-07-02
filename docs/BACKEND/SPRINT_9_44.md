# Sprint 9.44 - Preparacao de Integracao Matriculas e Financeiro

## Objetivo

Preparar a integracao interna entre o dominio de matriculas e o modulo
Financeiro sem gerar cobrancas, mensalidades, pagamentos ou lancamentos reais.

## Mapeamento do Modulo Financeiro

Arquivos atuais encontrados:

```text
backend/src/routes/financeiro.routes.js
backend/src/controllers/financeiro.controller.js
backend/src/services/financeiro.service.js
backend/src/domains/financeiro/index.js
backend/src/domains/financeiro/README.md
backend/src/config/db.js
```

O dominio `backend/src/domains/financeiro` ainda e uma fronteira reservada. Os
fluxos ativos continuam em rotas/controllers/services legados.

Servico atual que gera mensalidades:

```text
backend/src/services/financeiro.service.js
```

Rotas atuais:

```text
backend/src/routes/financeiro.routes.js
```

Controller atual:

```text
backend/src/controllers/financeiro.controller.js
```

## Persistencia Financeira Atual

Tabelas identificadas:

```text
j12_financeiro_cobrancas
j12_mensalidades
j12_pagamentos
financial_payments
financeiro
j12_planos
```

Representacao atual:

```text
cobranca: j12_financeiro_cobrancas
mensalidade: j12_mensalidades
pagamento: j12_pagamentos / financial_payments
plano: j12_planos
espelho legado: financeiro
```

Campos relevantes para uma futura geracao a partir de matricula:

```text
enrollmentId
studentPersonId
studentProfileId
planId
amount
competence
dueDate
requestedBy
```

## Viculo Matricula-Financeiro

Nao foi encontrada tabela dedicada para vincular `enrollments` a cobrancas ou
mensalidades.

Conclusao:

```text
sera necessaria migration futura para uma tabela de relacionamento
matricula/financeiro antes de persistir vinculos reais.
```

Nome conceitual sugerido para futura migration:

```text
enrollment_financial_links
```

## Evento Futuro

O evento recomendado para iniciar a integracao futura e:

```text
EnrollmentConfirmed
```

Motivo:

```text
a geracao financeira deve ocorrer somente depois que a matricula estiver ACTIVE.
```

Nenhum listener, worker, fila externa ou integracao foi criado nesta sprint.

## Contrato Criado

Arquivo:

```text
backend/src/domains/enrollments/application/contracts/enrollment-financial-link.contract.js
```

Metodo:

```js
prepareEnrollmentFinancialLink({
  enrollmentId,
  studentPersonId,
  studentProfileId,
  requestedBy,
  enrollmentStatus,
  planId,
  planName,
  competence,
  dueDate,
  amount,
  metadata,
})
```

Tambem foi exposto pela `EnrollmentFacade`:

```js
facade.prepareEnrollmentFinancialLink(...)
```

## Comportamento

O contrato:

```text
valida enrollmentId, studentPersonId, studentProfileId e requestedBy
retorna requiredEnrollmentStatus=ACTIVE
retorna futureTriggerEvent=EnrollmentConfirmed
mapeia tabelas e servicos financeiros atuais
marca chargeCreated=false
marca installmentCreated=false
marca financialEntryCreated=false
marca externalIntegrationsTriggered=false
marca persisted=false
marca requiresMigration=true
```

Ele nao:

```text
consulta Financeiro
cria cobranca
cria mensalidade
cria pagamento
cria lancamento financeiro
executa migration
altera schema
aciona Turmas
aciona Agenda
aciona Notificacoes
aciona App
```

## Regras Minimas Futuras

Para gerar cobranca real em sprint futura:

```text
matricula deve estar ACTIVE
integracao deve ser disparada por EnrollmentConfirmed ou handler interno explicito
plano ativo do aluno deve ser resolvido antes do calculo
valor, competencia e vencimento devem ser determinados de forma idempotente
duplicidade deve ser evitada por matricula, aluno e competencia
vinculo matricula/financeiro deve ser persistido em tabela propria
falhas financeiras nao devem corromper confirmacao de matricula
```

## Arquivos Alterados

```text
backend/src/domains/enrollments/application/contracts/enrollment-financial-link.contract.js
backend/src/domains/enrollments/application/contracts/index.js
backend/src/domains/enrollments/application/facades/enrollment.facade.js
docs/BACKEND/SPRINT_9_44.md
```

## Validacoes

Validacoes previstas:

```text
cmd /c npm run build
node --check nos arquivos alterados
smoke test interno
```

Smoke esperado:

```text
ENROLLMENT_FINANCIAL_INTEGRATION_PREPARED=true
FINANCIAL_MODULE_MAPPED=true
FINANCIAL_LINK_CONTRACT_DOCUMENTED=true
NO_CHARGE_CREATED=true
NO_INSTALLMENT_CREATED=true
NO_FINANCIAL_ENTRY_CREATED=true
OFFICIAL_FLOW_STILL_WORKING=true
NO_TEST_DATA_LEFT=true
```

## Fora Do Escopo

Nao foram alterados:

```text
frontend
API publica
controllers
rotas
turmas
agenda
notificacoes
app
legado
schema
migrations
```
