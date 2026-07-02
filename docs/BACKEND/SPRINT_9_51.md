# Sprint 9.51 - Integracao de Matriculas com Financeiro

## Objetivo

Preparar a primeira integracao interna entre o dominio de Matriculas
(`enrollments`) e o modulo Financeiro, permitindo validar uma matricula
`ACTIVE` antes de planejar uma obrigacao financeira futura.

Esta sprint nao cria cobranca, mensalidade, pagamento ou lancamento financeiro
real.

## Mapeamento do Modulo Financeiro

Arquivos operacionais encontrados:

```text
backend/src/services/financeiro.service.js
backend/src/routes/financeiro.routes.js
backend/src/controllers/financeiro.controller.js
backend/routes/financeiro.js
backend/services/student-finance.js
```

Fronteira de dominio reservada, ainda sem service/repository real migrado:

```text
backend/src/domains/financeiro/index.js
backend/src/domains/financeiro/README.md
```

Tabelas financeiras mapeadas no schema MySQL atual:

```text
j12_financeiro_cobrancas
j12_mensalidades
j12_pagamentos
financial_payments
financeiro
j12_planos
```

O fluxo atual de mensalidades usa `j12_alunos.id`, `j12_alunos.plano_id`,
`j12_planos` e competencia/referencia. Nao foi encontrada tabela dedicada que
relacione:

```text
enrollments.id <-> j12_financeiro_cobrancas.id
enrollments.id <-> j12_mensalidades.id
```

Tambem nao foi encontrado repository/service financeiro de dominio que aceite
`enrollmentId` como chave idempotente confiavel.

## Decisao Tecnica

Contrato/documentacao preparatoria.

Nao foi implementada obrigacao financeira real porque a estrutura financeira
atual ainda esta acoplada ao cadastro legado `j12_alunos` e nao possui vinculo
fisico ou contrato de dominio para `enrollments.id`.

Persistir agora exigiria escolher uma cobranca por `aluno_id` sem preservar a
origem `enrollmentId`, o que nao garantiria:

```text
idempotencia por matricula
unicidade de obrigacao financeira por matricula
auditoria de origem
rollback isolado de integracao
snapshot do pagador/responsavel financeiro por enrollment
```

## Implementacao

Arquivos de aplicacao ajustados:

```text
backend/src/domains/enrollments/application/contracts/enrollment-financial-link.contract.js
backend/src/domains/enrollments/application/services/enrollment-financial.service.js
backend/src/domains/enrollments/application/services/enrollment-application.service.js
backend/src/domains/enrollments/application/services/index.js
backend/src/domains/enrollments/application/facades/enrollment.facade.js
```

Novo service interno:

```js
prepareEnrollmentFinancialObligation({
  enrollmentId,
  requestedBy,
  studentPersonId,
  studentProfileId,
  planId,
  planName,
  competence,
  dueDate,
  amount,
  metadata,
})
```

O service:

```text
valida enrollmentId e requestedBy
consulta a matricula persistida por id
bloqueia matricula inexistente
bloqueia status diferente de ACTIVE
confere studentPersonId/studentProfileId quando informados
retorna contrato preparatorio
nao chama Financeiro
nao cria cobranca
nao cria mensalidade
nao cria lancamento financeiro
```

Erros controlados adicionados:

```text
ENROLLMENT_FINANCIAL_OBLIGATION_INPUT_REQUIRED
ENROLLMENT_FINANCIAL_OBLIGATION_ENROLLMENT_NOT_FOUND
ENROLLMENT_FINANCIAL_OBLIGATION_INVALID_ENROLLMENT_STATUS
ENROLLMENT_FINANCIAL_OBLIGATION_STUDENT_LINK_MISSING
ENROLLMENT_FINANCIAL_OBLIGATION_STUDENT_MISMATCH
ENROLLMENT_FINANCIAL_LINK_INVALID_ENROLLMENT_STATUS
```

## Contrato Atualizado

Arquivo:

```text
backend/src/domains/enrollments/application/contracts/enrollment-financial-link.contract.js
```

O contrato foi atualizado para:

```text
contractVersion=sprint-9.51
requiredEnrollmentStatus=ACTIVE
blockedBySchemaOrModuleGap=true
financialCreationBlockedBySchemaOrModuleGap=true
requiresDedicatedEnrollmentFinancialLinkTable=true
duplicateFinancialObligationCheckAvailable=false
chargeCreated=false
installmentCreated=false
financialEntryCreated=false
persisted=false
```

## Smoke Tests

Smoke preparatorio validado por testes unitarios:

```text
ENROLLMENT_FINANCIAL_INTEGRATION_PREPARED=true
FINANCIAL_MODULE_MAPPED=true
FINANCIAL_LINK_CONTRACT_DOCUMENTED=true
FINANCIAL_CREATION_BLOCKED_BY_SCHEMA_OR_MODULE_GAP=true
NO_CHARGE_CREATED=true
NO_INSTALLMENT_CREATED=true
NO_FINANCIAL_ENTRY_CREATED=true
OFFICIAL_FLOW_STILL_WORKING=true
NO_TEST_DATA_LEFT=true
```

Cenarios cobertos:

```text
ACTIVE Enrollment prepara contrato sem escrita
DRAFT Enrollment e bloqueada
matricula inexistente retorna erro controlado
repeticao da chamada retorna chave idempotente sem criar dados
student ids divergentes sao bloqueados
```

## Validacoes

Validacoes executadas nesta sprint:

```text
node --check backend/src/domains/enrollments/application/contracts/enrollment-financial-link.contract.js
node --check backend/src/domains/enrollments/application/services/enrollment-financial.service.js
node --check backend/src/domains/enrollments/application/services/enrollment-application.service.js
node --check backend/src/domains/enrollments/application/services/index.js
node --check backend/src/domains/enrollments/application/facades/enrollment.facade.js
node --check backend/src/domains/enrollments/application/tests/enrollment-financial.service.test.js
node --check backend/src/domains/enrollments/application/tests/enrollment-application.service.test.js
node --check backend/src/domains/enrollments/application/tests/enrollment.facade.test.js
node --test backend/src/domains/enrollments/application/tests/*.test.js
cmd /c npm run build
```

## Migration Futura Necessaria

Antes de criar obrigacao financeira real, criar estrutura dedicada, por exemplo:

```text
enrollment_financial_links
```

Colunas sugeridas:

```text
id
enrollment_id
student_person_id
student_profile_id
charge_id
installment_id
competence
amount
due_date
status
created_by
created_at
updated_at
metadata_json
```

Regras sugeridas:

```text
FK enrollment_id -> enrollments.id
unicidade por enrollment_id + competence + tipo ativo
referencia para j12_financeiro_cobrancas ou j12_mensalidades
snapshot de pagador/responsavel financeiro
status preparado/criado/cancelado/falhou
idempotencia por enrollment_id
```

## Riscos

- Financeiro atual ainda esta em rotas/services legados e usa `aluno_id`.
- Ha mais de uma representacao de mensalidade/cobranca em convivencia.
- Criar cobranca real sem `enrollmentId` persistido pode duplicar obrigacoes.
- Plano, valor e vencimento ainda precisam de fonte canonica para o novo
  dominio de Matriculas.

## Rollback

Rollback de codigo:

```text
remover o service preparatorio
remover o metodo da facade
voltar contractVersion para a versao anterior
remover a documentacao da sprint
```

Nao ha rollback de banco porque nenhuma migration foi criada e nenhum dado foi
gravado.

## Fora Do Escopo

Nao foram alterados:

```text
frontend
API publica
turmas
agenda
notificacoes
app
legado
fluxo publico de criacao de aluno
regras de confirmacao de matricula
schema
migrations
```

## Proximos Passos

1. Criar migration `enrollment_financial_links`.
2. Definir fonte canonica de plano, valor, competencia e vencimento por
   matricula.
3. Criar adapter/service financeiro de dominio que aceite `enrollmentId`.
4. Implementar criacao real com transacao e chave idempotente.
5. Cobrir rollback com teste de escrita em transacao.
