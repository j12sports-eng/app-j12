# Sprint 9.54 - API publica de Matriculas

## Objetivo

Preparar a API publica segura do dominio de Matriculas (`enrollments`) para
consumo futuro pelo frontend administrativo, usando exclusivamente
`EnrollmentFacade` na camada de controller.

## Decisao Tecnica

Endpoints publicos registrados com protecao segura.

O backend ja possui padrao de autenticacao/autorizacao reutilizavel:

```text
requireAuth
canManageSystem
```

Por isso, a API foi exposta em `/enrollments` e `/api/enrollments`, mas todas
as rotas exigem usuario autenticado com perfil administrativo/gestor.

## Endpoints Registrados

```text
GET /enrollments/status
GET /enrollments/current-draft
GET /enrollments/current-active
POST /enrollments/:enrollmentId/confirm
```

Tambem foram registrados os aliases com prefixo `/api`:

```text
GET /api/enrollments/status
GET /api/enrollments/current-draft
GET /api/enrollments/current-active
POST /api/enrollments/:enrollmentId/confirm
```

As rotas legadas/publicas de captacao permanecem separadas:

```text
/public/enrollments
/api/public/enrollments
```

## Arquivos Criados

```text
backend/src/domains/enrollments/presentation/controllers/enrollment-public.controller.js
backend/src/domains/enrollments/presentation/routes/enrollment-public.routes.js
docs/BACKEND/SPRINT_9_54.md
```

## Arquivos Ajustados

```text
backend/src/domains/enrollments/presentation/controllers/index.js
backend/src/domains/enrollments/presentation/routes/index.js
backend/src/server.js
```

## Controller

O controller publico chama somente `EnrollmentFacade`.

Metodos usados:

```text
getEnrollmentStatusSummary()
findCurrentDraftEnrollment()
findCurrentActiveEnrollment()
confirmDraftEnrollment()
```

O controller nao acessa:

```text
repositories
SQL
Prisma
services de infraestrutura
Financeiro
Turmas
Agenda
Notificacoes
legado
```

## Validacao de Entrada

Consultas de status/draft/active exigem:

```text
studentPersonId
studentProfileId
```

Confirmacao exige:

```text
enrollmentId
confirmedBy
```

`confirmedBy` e resolvido preferencialmente pelo usuario autenticado
(`email`, `login`, `username` ou `id`) para reduzir risco de spoofing em payload.

Entradas invalidas retornam erro controlado:

```text
ENROLLMENT_PUBLIC_INPUT_REQUIRED
```

## Tratamento de Erros

Foram mapeados erros controlados para respostas HTTP:

```text
ACTIVE_ENROLLMENT_ALREADY_EXISTS -> 409
CONFIRM_DRAFT_ENROLLMENT_ID_REQUIRED -> 400
CONFIRM_DRAFT_ENROLLMENT_INVALID_STATUS -> 409
CONFIRM_DRAFT_ENROLLMENT_NOT_FOUND -> 404
ENROLLMENT_PROCEED_BLOCKED -> 409
ENROLLMENT_PROCEED_CONFLICT -> 409
ENROLLMENT_PUBLIC_ALREADY_ACTIVE -> 409
ENROLLMENT_PUBLIC_INPUT_REQUIRED -> 400
```

Erros desconhecidos continuam para o handler global do backend.

## Seguranca

As rotas usam:

```text
requireAuth
ensureEnrollmentPublicAccess
canManageSystem
```

Usuarios sem perfil permitido recebem:

```text
403
```

Perfis aceitos pelo padrao atual:

```text
admin
coordenador
perfil=admin
```

## Smoke Tests

Smoke esperado:

```text
PUBLIC_ENROLLMENT_API_READY=true
PUBLIC_ROUTES_SECURED=true
PUBLIC_CONTROLLERS_USE_FACADE=true
PUBLIC_STATUS_ENDPOINT_READY=true
PUBLIC_CURRENT_DRAFT_ENDPOINT_READY=true
PUBLIC_CURRENT_ACTIVE_ENDPOINT_READY=true
PUBLIC_CONFIRM_ENDPOINT_READY=true
CONFIRM_ENDPOINT_PRESERVES_AUDIT=true
NO_FINANCIAL_SIDE_EFFECTS=true
NO_CLASS_SIDE_EFFECTS=true
NO_SCHEDULE_SIDE_EFFECTS=true
NO_NOTIFICATION_SIDE_EFFECTS=true
OFFICIAL_FLOW_STILL_WORKING=true
NO_TEST_DATA_LEFT=true
```

## Side Effects

A confirmacao publica chama apenas o fluxo oficial:

```text
EnrollmentFacade.confirmDraftEnrollment()
```

Nao gera:

```text
financeiro
turma
agenda
notificacao real
mensalidade
```

## Rollback

Rollback de codigo:

```text
remover enrollment-public.controller.js
remover enrollment-public.routes.js
remover exports adicionados nos index.js
remover montagem em backend/src/server.js
remover esta documentacao
```

Nao ha rollback de banco porque nenhuma migration foi criada e nenhum dado foi
gravado pela sprint.

## Fora Do Escopo

Nao foram alterados:

```text
frontend
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
regras internas ja consolidadas
```

## Proximos Passos

1. Adicionar testes HTTP reais quando houver harness padronizado para rotas
   autenticadas.
2. Avaliar tenant/unidade quando o dominio de unidade estiver consolidado em
   Matriculas.
3. Conectar o frontend administrativo aos endpoints protegidos.
