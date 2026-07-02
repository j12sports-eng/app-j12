# Sprint 9.48 - API Interna de Matriculas usando EnrollmentFacade

## Objetivo

Implementar a primeira camada real de API interna para o dominio de
matriculas, usando exclusivamente a `EnrollmentFacade` como ponto de entrada e
sem expor endpoints publicos ao frontend.

## Padrao Backend Mapeado

Arquivos analisados:

```text
backend/src/server.js
backend/src/routes/alunos.routes.js
backend/src/routes/dashboard.routes.js
backend/src/controllers/aluno-completo.controller.js
backend/auth.js
```

Padrao atual:

```text
rotas Express ficam em backend/src/routes ou modulos equivalentes
controllers recebem req/res/next
autenticacao usa requireAuth
autorizacao administrativa usa canManageSystem
erros inesperados sao encaminhados para next(error)
respostas usam success/data ou success/error conforme rota
rotas publicas sao montadas explicitamente em backend/src/server.js
```

Nao foi encontrado namespace interno seguro ja montado para:

```text
/internal/*
```

## Decisao de Registro

As rotas internas foram criadas como factory isolada, mas nao foram registradas
em `backend/src/server.js`.

Motivo:

```text
nao existe padrao seguro atual para publicar namespace interno
registrar em server.js exporia a rota na superficie HTTP atual
esta sprint deve preservar NO_PUBLIC_ENDPOINT_EXPOSED=true
```

## Endpoints Internos Preparados

Base futura:

```text
/internal/enrollments
```

Rotas preparadas:

```text
GET /internal/enrollments/status
GET /internal/enrollments/current-draft
GET /internal/enrollments/current-active
POST /internal/enrollments/:enrollmentId/confirm
```

Arquivo de rotas:

```text
backend/src/domains/enrollments/presentation/routes/enrollment-internal.routes.js
```

Export principal:

```js
createEnrollmentInternalRouter()
```

Middleware preparado:

```text
requireAuth
ensureInternalEnrollmentAccess
canManageSystem
```

## Controller Criado

Arquivo:

```text
backend/src/domains/enrollments/presentation/controllers/enrollment-internal.controller.js
```

Classe:

```js
EnrollmentInternalController
```

Handlers:

```text
getStatus()
getCurrentDraft()
getCurrentActive()
confirmDraft()
```

Delegacoes:

```text
getStatus -> EnrollmentFacade.getEnrollmentStatusSummary()
getCurrentDraft -> EnrollmentFacade.findCurrentDraftEnrollment()
getCurrentActive -> EnrollmentFacade.findCurrentActiveEnrollment()
confirmDraft -> EnrollmentFacade.confirmDraftEnrollment()
```

O controller nao importa:

```text
repository
SQL
Prisma
Financeiro
Turmas
services de infraestrutura
modulos legados
```

## Validacao de Entrada

Leituras exigem:

```text
studentPersonId
studentProfileId
```

Confirmacao exige:

```text
enrollmentId por req.params.enrollmentId
confirmedBy opcional via body ou usuario autenticado
```

Entrada invalida responde:

```json
{
  "success": false,
  "code": "ENROLLMENT_INTERNAL_INPUT_REQUIRED",
  "error": "mensagem controlada",
  "missingFields": []
}
```

## Tratamento de Erro

Erros de validacao da borda retornam `400`.

Erros vindos da `EnrollmentFacade` sao encaminhados para `next(error)`, seguindo
o middleware global do Express quando a rota for registrada em sprint futura.

## Efeitos Colaterais

Esta sprint nao:

```text
monta rotas em server.js
cria endpoint publico
chama repository no controller
executa SQL no controller
gera cobranca
cria mensalidade
vincula turma
altera schema
executa migration
altera frontend
```

## Arquivos Alterados

```text
backend/src/domains/enrollments/presentation/controllers/enrollment-internal.controller.js
backend/src/domains/enrollments/presentation/controllers/index.js
backend/src/domains/enrollments/presentation/routes/enrollment-internal.routes.js
backend/src/domains/enrollments/presentation/routes/index.js
backend/src/domains/enrollments/presentation/index.js
backend/src/domains/enrollments/index.js
docs/BACKEND/SPRINT_9_48.md
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
ENROLLMENT_INTERNAL_API_READY=true
INTERNAL_ROUTES_REGISTERED_OR_DOCUMENTED=true
CONTROLLERS_USE_FACADE=true
STATUS_ENDPOINT_CALLS_FACADE=true
CURRENT_DRAFT_ENDPOINT_CALLS_FACADE=true
CURRENT_ACTIVE_ENDPOINT_CALLS_FACADE=true
CONFIRM_ENDPOINT_CALLS_FACADE=true
NO_PUBLIC_ENDPOINT_EXPOSED=true
NO_FINANCIAL_SIDE_EFFECTS=true
NO_CLASS_SIDE_EFFECTS=true
OFFICIAL_FLOW_STILL_WORKING=true
NO_TEST_DATA_LEFT=true
```

## Proximos Passos

Antes de registrar a rota:

```text
definir namespace interno oficial
confirmar politica de autenticacao/autorizacao para /internal/*
montar router sob ENROLLMENT_INTERNAL_ROUTE_BASE_PATH
adicionar testes HTTP com request/response reais
validar que a rota nao entra em namespace publico do frontend
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
repositories
SQL
```
