# Sprint 9.49 - Endpoints Administrativos de Matriculas

## Objetivo

Preparar e registrar endpoints administrativos do dominio de matriculas para
consulta e confirmacao controlada, usando exclusivamente `EnrollmentFacade` na
borda de controller.

Esta sprint evolui a API interna preparada na Sprint 9.48 para um contrato
administrativo protegido, sem integrar frontend e sem efeitos colaterais em
Financeiro ou Turmas.

## Padrao Administrativo Confirmado

O backend ja possui padrao seguro para rotas administrativas:

```text
requireAuth
canManageSystem
```

`canManageSystem` libera:

```text
admin
coordenador
perfil = admin
```

Por isso, as rotas foram registradas no servidor atual, mantendo protecao por
autenticacao e autorizacao antes de qualquer handler administrativo.

## Endpoints Registrados

Base principal:

```text
/admin/enrollments
```

Base compativel com o padrao `/api` existente:

```text
/api/admin/enrollments
```

Endpoints:

```text
GET /admin/enrollments/status
GET /admin/enrollments/current-draft
GET /admin/enrollments/current-active
POST /admin/enrollments/:enrollmentId/confirm
```

Tambem disponiveis com prefixo `/api`:

```text
GET /api/admin/enrollments/status
GET /api/admin/enrollments/current-draft
GET /api/admin/enrollments/current-active
POST /api/admin/enrollments/:enrollmentId/confirm
```

## Arquivos Criados

```text
backend/src/domains/enrollments/presentation/controllers/enrollment-admin.controller.js
backend/src/domains/enrollments/presentation/routes/enrollment-admin.routes.js
docs/BACKEND/SPRINT_9_49.md
```

## Arquivos Atualizados

```text
backend/src/domains/enrollments/presentation/controllers/index.js
backend/src/domains/enrollments/presentation/routes/index.js
backend/src/server.js
```

## Controller Administrativo

Arquivo:

```text
backend/src/domains/enrollments/presentation/controllers/enrollment-admin.controller.js
```

Classe:

```text
EnrollmentAdminController
```

Handlers:

```text
getStatus()
getCurrentDraft()
getCurrentActive()
confirmDraft()
```

Delegacoes para `EnrollmentFacade`:

```text
getStatus -> getEnrollmentStatusSummary()
getCurrentDraft -> findCurrentDraftEnrollment()
getCurrentActive -> findCurrentActiveEnrollment()
confirmDraft -> confirmDraftEnrollment()
```

O controller nao chama:

```text
repositories
SQL
Prisma
services de infraestrutura
Financeiro
Turmas
legado
metodos privados
```

## Router Administrativo

Arquivo:

```text
backend/src/domains/enrollments/presentation/routes/enrollment-admin.routes.js
```

Factory:

```text
createEnrollmentAdminRouter()
```

Middlewares aplicados antes dos endpoints:

```text
requireAuth
ensureEnrollmentAdminAccess
```

`ensureEnrollmentAdminAccess` usa `canManageSystem`, preservando o padrao
administrativo ja existente.

## Validacao de Entrada

Consultas exigem query string:

```text
studentPersonId
studentProfileId
```

Confirmacao exige:

```text
params.enrollmentId
confirmedBy
```

`confirmedBy` pode vir do body:

```json
{
  "confirmedBy": "admin-user-id-or-email"
}
```

Se omitido, o controller usa o usuario autenticado como fallback:

```text
auth.email
auth.login
auth.username
auth.id
```

Sem `confirmedBy` resolvido, a borda retorna erro controlado `400`.

## Respostas

Sucesso:

```json
{
  "success": true,
  "data": {}
}
```

Erro controlado:

```json
{
  "success": false,
  "code": "ENROLLMENT_ADMIN_INPUT_REQUIRED",
  "error": "studentPersonId and studentProfileId are required."
}
```

Erros controlados do dominio sao mapeados para status HTTP:

```text
400 - entrada obrigatoria ausente
404 - matricula nao encontrada
409 - matricula ja ativa, status invalido ou conflito ACTIVE
```

Erros inesperados seguem para o middleware global do Express, que nao retorna
stack trace no payload.

## Confirmacao Administrativa

Endpoint:

```text
POST /admin/enrollments/:enrollmentId/confirm
```

Comportamento esperado:

```text
confirma somente DRAFT
persiste confirmed_at pelo repository existente
persiste confirmed_by pelo repository existente
retorna erro controlado se ja estiver ACTIVE
retorna erro controlado se houver ACTIVE conflitante
nao gera financeiro
nao vincula turma
```

## Efeitos Colaterais

Esta sprint nao altera:

```text
frontend
schema
migrations
financeiro
mensalidades
turmas
agenda
notificacoes
app legado
repositories
SQL
regras internas ja consolidadas
```

## Smoke Tests

Smoke test administrativo validou:

```text
ADMIN_ENROLLMENT_ENDPOINTS_PREPARED=true
ADMIN_ROUTES_REGISTERED_OR_DOCUMENTED=true
ADMIN_CONTROLLERS_USE_FACADE=true
ADMIN_STATUS_ENDPOINT_READY=true
ADMIN_CURRENT_DRAFT_ENDPOINT_READY=true
ADMIN_CURRENT_ACTIVE_ENDPOINT_READY=true
ADMIN_CONFIRM_ENDPOINT_READY=true
CONFIRM_ENDPOINT_PRESERVES_AUDIT=true
NO_PUBLIC_ENDPOINT_EXPOSED_UNSAFELY=true
NO_FINANCIAL_SIDE_EFFECTS=true
NO_CLASS_SIDE_EFFECTS=true
OFFICIAL_FLOW_STILL_WORKING=true
NO_TEST_DATA_LEFT=true
```

## Validacoes

Validacoes executadas:

```text
node --check backend/src/domains/enrollments/presentation/controllers/enrollment-admin.controller.js
node --check backend/src/domains/enrollments/presentation/routes/enrollment-admin.routes.js
node --check backend/src/server.js
node --test backend/src/domains/enrollments/application/tests/*.test.js
cmd /c npm run build
```

Resultado:

```text
node --check arquivos alterados: aprovado
Smoke test: aprovado
cmd /c npm run build: aprovado
```

## Limitacoes

- Os endpoints administrativos ainda nao foram integrados ao frontend.
- As rotas dependem do token atual do backend e do padrao `canManageSystem`.
- A confirmacao nao dispara integracoes externas; Financeiro e Turmas continuam
  somente preparados por contratos internos.

## Proximos Passos

- Criar consumidor frontend administrativo quando o fluxo de operacao for
  aprovado.
- Adicionar testes HTTP automatizados com servidor em modo test.
- Definir politica de auditoria operacional para registrar quem acionou cada
  confirmacao no nivel de logs, se necessario.
