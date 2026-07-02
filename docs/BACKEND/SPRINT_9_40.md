# Sprint 9.40 - Enrollment Facade

## Objetivo

Criar uma fachada de aplicacao para centralizar as operacoes internas do
dominio de matriculas em um unico ponto de entrada, preparando integracoes
futuras com Pessoas, Turmas, Financeiro, Agenda e API sem espalhar dependencias.

## Arquivos

```text
backend/src/domains/enrollments/application/facades/enrollment.facade.js
backend/src/domains/enrollments/application/index.js
```

## Fachada Criada

Classe:

```js
EnrollmentFacade
```

Metodos expostos:

```text
createDraftEnrollment()
createDraftEnrollmentAndPersist()
createDraftEnrollmentIdempotently()
findCurrentDraftEnrollment()
findDraftEnrollment()
findCurrentActiveEnrollment()
getEnrollmentStatusSummary()
ensureEnrollmentCanProceed()
ensureNoActiveEnrollment()
confirmDraftEnrollment()
```

## Regra Arquitetural

A fachada apenas delega chamadas para `EnrollmentApplicationService`.

Ela nao:

```text
reimplementa regras de negocio
consulta repository concreto
executa SQL
cria endpoints
altera controllers ou rotas
integra frontend
```

## Registro

`application/index.js` exporta `EnrollmentFacade` junto aos contratos e services
da camada de aplicacao. O entrypoint principal do dominio continua expondo a
camada `application`, entao consumidores internos podem usar:

```js
const { application } = require(".../domains/enrollments");
const { EnrollmentFacade } = application;
```

## Decisao Tecnica

O construtor aceita `enrollmentService`/`enrollmentApplicationService` para
testes e composicoes futuras. Quando nenhum service e injetado, instancia
`EnrollmentApplicationService` usando apenas `enrollmentFactory` e
`enrollmentRepository` recebidos por parametro.

Assim, a fachada permanece desacoplada de adapters concretos e a composicao da
infraestrutura continua fora da camada de aplicacao.

## Smoke Test

Smoke test valida:

```text
ENROLLMENT_FACADE_CREATED=true
FACADE_DELEGATES_TO_SERVICES=true
NO_BUSINESS_RULE_DUPLICATION=true
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
schema
migrations
financeiro
mensalidades
turmas
legado
```
