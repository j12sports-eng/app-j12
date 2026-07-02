# Sprint 10.9 - Frontend Administrativo Real de Matriculas

## Objetivo

Consolidar a tela administrativa real de Matriculas, conectada aos endpoints
administrativos protegidos, para consulta do estado atual de matricula por
`studentPersonId` e `studentProfileId`.

## Mapeamento Real

Padroes encontrados e preservados:

```text
src/routes/admin/*.tsx para rotas TanStack Router
src/components/ProtectedRoute.tsx para autenticacao e roles
src/components/AppShell.tsx e AppSidebar.tsx para layout administrativo
src/lib/api.ts como API client centralizado
src/hooks/* para estado remoto em React
src/components/<dominio> para componentes reutilizaveis
sonner para toast
```

Nao existe pasta `frontend/`; o frontend esta em `src/` na raiz.

## Rota Administrativa

A rota real esta exposta em:

```text
/admin/enrollments
```

Ela esta registrada no TanStack Router e no menu lateral administrativo, com
acesso limitado a:

```text
admin
coordenador
```

## API Client

O arquivo `src/lib/enrollments-api.ts` usa o `api` central de `src/lib/api.ts`
e nao possui URL hardcoded fora do padrao de ambiente.

Endpoints consumidos:

```text
GET /admin/enrollments/status
GET /admin/enrollments/current-draft
GET /admin/enrollments/current-active
POST /admin/enrollments/:enrollmentId/confirm
```

## Tipos

Tipos consolidados:

```text
EnrollmentSummaryStatus = NONE | DRAFT | ACTIVE | CONFLICT
EnrollmentRecord
EnrollmentStudentScope
EnrollmentStatusSummary
ConfirmDraftEnrollmentResponse
```

## Hook

`src/hooks/useEnrollmentStatus.ts` centraliza:

```text
loadStatus()
confirmDraft()
loading
actionLoading
error
message
status
draftEnrollment
activeEnrollment
canConfirm
```

O hook valida entrada minima antes de consultar e sanitiza erros via
`formatApiErrorMessage`.

## Componentes

`src/components/enrollments/EnrollmentStatusBadge.tsx` renderiza os estados:

```text
NONE
DRAFT
ACTIVE
CONFLICT
```

A pagina administrativa exibe:

```text
status consolidado
badge visual
matricula DRAFT
matricula ACTIVE
confirmedAt
confirmedBy
loading
success
error
empty state
```

## Guarda da Confirmacao

A acao de confirmar matricula ficou habilitada somente quando:

```text
usuario tem role admin ou coordenador
status consolidado e DRAFT
existe draftEnrollment.id
nao existe ACTIVE conflitante
```

A rota backend administrativa tambem esta protegida por `requireAuth` e
`canManageSystem`.

## Arquivos Alterados

```text
src/routes/admin/enrollments.tsx
docs/FRONTEND/SPRINT_10_9.md
```

## Validacoes

```text
cmd /c npm run build: aprovado
build frontend separado: nao aplicavel
lint/typecheck frontend separado: nao aplicavel
Smoke test: aprovado
```

## Smoke Test

```text
ENROLLMENT_ADMIN_UI_ENABLED=true
ENROLLMENT_STATUS_VIEW_WORKING=true
DRAFT_STATUS_RENDERED=true
ACTIVE_STATUS_RENDERED=true
NONE_STATUS_RENDERED=true
CONFLICT_STATUS_RENDERED=true
CONFIRM_ACTION_GUARDED=true
API_CLIENT_USED=true
NO_EXISTING_ROUTE_BROKEN=true
NO_BACKEND_SCHEMA_CHANGE=true
```

## Nao Alterado

```text
schema
migrations
financeiro
turmas
agenda
notificacoes
mobile
legado
regras backend ja estabilizadas
```

## Bloqueios e Limitacoes

Nao houve bloqueio de auth ou router. A rota administrativa ficou exposta no
menu para `admin` e `coordenador`.

Nao foi criado fluxo financeiro, vinculo com turmas, agenda ou notificacoes.

## Proximos Passos

Evoluir a tela para busca por nome/documento do aluno quando houver endpoint de
consulta administrativa consolidado para pessoas/perfis.
