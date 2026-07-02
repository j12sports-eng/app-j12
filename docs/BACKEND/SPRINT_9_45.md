# Sprint 9.45 - Preparacao de API Interna de Matriculas

## Objetivo

Preparar a camada interna de API do dominio de matriculas sem expor endpoints
publicos para o frontend e sem alterar o fluxo atual de criacao/confirmacao.

## Mapeamento HTTP Atual

Arquivos observados:

```text
backend/src/server.js
backend/src/routes/*.routes.js
backend/src/controllers/*.js
auth.js
```

Padrao atual:

```text
rotas Express ficam em backend/src/routes
controllers ficam em backend/src/controllers
rotas publicas sao registradas em backend/src/server.js via mount(...)
autenticacao usa requireAuth
autorizacao administrativa usa canManageSystem
erros sao normalizados pelo middleware global em backend/src/server.js
respostas usam envelope success/data ou success/error
```

Nao foi encontrado um namespace interno ja estabelecido e seguro para:

```text
/internal/*
autenticacao de servico interno
autorizacao propria para API interna de dominio
```

## Decisao Arquitetural

Como nao ha padrao seguro de rota interna registrada, esta sprint criou apenas
contrato e controller interno nao montado no Express.

Isso mantem:

```text
NO_PUBLIC_ENDPOINT_EXPOSED=true
NO_FRONTEND_CHANGE=true
```

## Contrato Criado

Arquivo:

```text
backend/src/domains/enrollments/application/http/enrollment-internal-api.contract.js
```

Endpoints futuros documentados:

```text
GET /internal/enrollments/status
GET /internal/enrollments/current-draft
GET /internal/enrollments/current-active
POST /internal/enrollments/:id/confirm
```

Todos estao marcados como:

```text
registered=false
routesRegistered=false
noPublicEndpointExposed=true
```

## Controller Interno

Arquivo:

```text
backend/src/domains/enrollments/application/http/enrollment-internal.controller.js
```

Classe:

```js
EnrollmentInternalController
```

Handlers preparados:

```text
getStatus()
getCurrentDraft()
getCurrentActive()
confirm()
```

Todos chamam exclusivamente a `EnrollmentFacade`:

```text
getEnrollmentStatusSummary()
findCurrentDraftEnrollment()
findCurrentActiveEnrollment()
confirmDraftEnrollment()
```

O controller nao:

```text
importa repository
acessa banco diretamente
duplica regras de negocio
registra Express router
altera backend/src/server.js
```

## Validacao de Payload Futuro

Contrato minimo esperado:

```text
status/current-draft/current-active:
  studentPersonId
  studentProfileId

confirm:
  params.id ou enrollmentId
  confirmedBy vindo do body ou usuario autenticado
```

## Tratamento de Erro Futuro

O controller deixa erros controlados da facade subirem para o middleware global
do Express quando uma rota for criada em sprint futura.

Tambem foi preparado `errorResponse()` para uso em handlers internos que
precisem responder sem middleware Express.

## Arquivos Alterados

```text
backend/src/domains/enrollments/application/http/enrollment-internal-api.contract.js
backend/src/domains/enrollments/application/http/enrollment-internal.controller.js
backend/src/domains/enrollments/application/http/index.js
backend/src/domains/enrollments/application/index.js
backend/src/domains/enrollments/index.js
docs/BACKEND/SPRINT_9_45.md
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
ENROLLMENT_INTERNAL_API_PREPARED=true
API_CONTRACT_DOCUMENTED=true
CONTROLLERS_USE_FACADE=true
NO_PUBLIC_ENDPOINT_EXPOSED=true
NO_FRONTEND_CHANGE=true
OFFICIAL_FLOW_STILL_WORKING=true
NO_TEST_DATA_LEFT=true
```

## Fora Do Escopo

Nao foram alterados:

```text
frontend
API publica
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
