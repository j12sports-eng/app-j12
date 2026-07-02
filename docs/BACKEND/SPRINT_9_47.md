# Sprint 9.47 - Camada de Testes do Dominio de Matriculas

## Objetivo

Criar uma base organizada de testes automatizados para o dominio de matriculas,
cobrindo os comportamentos internos ja consolidados sem alterar regras de
negocio, API, frontend, banco, schema ou migrations.

## Padrao de Testes Encontrado

Nao foi encontrada uma suite de testes existente no projeto.

Comandos e arquivos avaliados:

```text
package.json
backend/package.json
rg --files | rg "test|spec|__tests__"
```

Resultado:

```text
nao existe script npm test no package.json raiz
nao existe script npm test no backend/package.json
nao existe estrutura padrao de testes backend previamente criada
```

Decisao tecnica:

```text
usar node:test e node:assert/strict
criar testes no proprio dominio de matriculas
usar fakes em memoria
nao tocar banco
nao criar dados permanentes
nao alterar scripts do package.json nesta sprint
```

## Arquivos de Teste Criados

```text
backend/src/domains/enrollments/application/tests/enrollment-application.service.test.js
backend/src/domains/enrollments/application/tests/enrollment.facade.test.js
```

## Cobertura Criada

`enrollment-application.service.test.js` cobre:

```text
criacao de DRAFT
reuso idempotente de DRAFT
leitura de DRAFT
leitura de ACTIVE
confirmacao DRAFT -> ACTIVE
auditoria confirmedAt / confirmedBy
guard contra ACTIVE existente
status summary NONE
status summary DRAFT
status summary ACTIVE
status summary CONFLICT
guard ensureEnrollmentCanProceed
bloqueio de ACTIVE quando nao permitido
bloqueio de CONFLICT sempre
```

`enrollment.facade.test.js` cobre:

```text
delegacao para findCurrentDraftEnrollment
delegacao para findCurrentActiveEnrollment
delegacao para getEnrollmentStatusSummary
delegacao para ensureEnrollmentCanProceed
delegacao para ensureNoActiveEnrollment
delegacao de criacao idempotente
emissao de EnrollmentDraftCreated apenas quando criado
delegacao de confirmDraftEnrollment
emissao de EnrollmentConfirmed
contratos preparatorios de Turmas e Financeiro sem chamadas ao service
```

## Isolamento

Os testes usam:

```text
FakeEnrollmentRepository em memoria
fake EnrollmentApplicationService para a facade
fake eventDispatcher em memoria
```

Os testes nao usam:

```text
banco real
transacao real
schema
migrations
controllers
rotas
frontend
financeiro
turmas
```

## Comandos de Teste

Como nao existe script `npm test`, o comando validado para esta sprint e:

```bash
node --test backend/src/domains/enrollments/application/tests/*.test.js
```

O comando abaixo fica bloqueado por ausencia de script:

```bash
cmd /c npm test
```

## Validacoes

Validacoes previstas:

```text
cmd /c npm run build
node --check nos arquivos de teste
node --test nos arquivos de teste
smoke test documental
```

Smoke esperado:

```text
ENROLLMENT_TEST_LAYER_PREPARED=true
DRAFT_FLOW_TESTED=true
ACTIVE_FLOW_TESTED=true
CONFIRMATION_FLOW_TESTED=true
GUARDS_TESTED=true
STATUS_SUMMARY_TESTED=true
FACADE_TESTED=true
NO_TEST_DATA_LEFT=true
```

## Arquivos Alterados

```text
backend/src/domains/enrollments/application/tests/enrollment-application.service.test.js
backend/src/domains/enrollments/application/tests/enrollment.facade.test.js
docs/BACKEND/SPRINT_9_47.md
```

## Fora Do Escopo

Nao foram alterados:

```text
frontend
API publica
controllers
rotas publicas
schema
migrations
financeiro
mensalidades
turmas
agenda
notificacoes
app
legado
```
