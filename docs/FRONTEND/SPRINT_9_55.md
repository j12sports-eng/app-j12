# Sprint 9.55 - Frontend Administrativo de Matriculas

## Objetivo

Preparar a primeira camada administrativa do frontend para matriculas, mantendo
o fluxo publico atual intacto e consumindo apenas a API administrativa protegida.

## Estrutura Frontend Encontrada

Padroes reais usados:

```text
src/routes/admin/*.tsx para paginas administrativas TanStack Router
src/components/ProtectedRoute.tsx para auth/roles
src/components/AppShell.tsx e AppSidebar.tsx para layout administrativo
src/lib/api.ts como cliente HTTP padrao autenticado
src/hooks/* com useState/useEffect/useCallback para estado remoto
src/components/<dominio> para componentes reutilizaveis
```

Nao existe pasta `frontend/`; o frontend esta em `src/` na raiz.

## API Admin Encontrada

O backend ja registra:

```text
/admin/enrollments
/api/admin/enrollments
```

Endpoints mapeados:

```text
GET /admin/enrollments/status?studentPersonId=&studentProfileId=
GET /admin/enrollments/current-draft?studentPersonId=&studentProfileId=
GET /admin/enrollments/current-active?studentPersonId=&studentProfileId=
POST /admin/enrollments/:enrollmentId/confirm
```

A rota backend usa `requireAuth` e `canManageSystem`.

## Arquivos Criados

```text
src/lib/enrollments-api.ts
src/hooks/useEnrollmentStatus.ts
src/components/enrollments/EnrollmentStatusBadge.tsx
src/routes/admin/enrollments.tsx
docs/FRONTEND/SPRINT_9_55.md
```

## Arquivos Alterados

```text
src/components/AppSidebar.tsx
src/routeTree.gen.ts (gerado automaticamente pelo TanStack Router no build)
```

## API Client

`src/lib/enrollments-api.ts` centraliza o contrato administrativo:

```text
getEnrollmentStatusSummary()
getCurrentDraftEnrollment()
getCurrentActiveEnrollment()
confirmDraftEnrollment()
canConfirmEnrollmentSummary()
```

O client usa `api` de `src/lib/api.ts`, preservando auth, timeout, envelope
`success/data` e tratamento padrao.

## Tipos

Foram tipados:

```text
EnrollmentSummaryStatus = NONE | DRAFT | ACTIVE | CONFLICT
EnrollmentRecord
EnrollmentStudentScope
EnrollmentStatusSummary
ConfirmDraftEnrollmentResponse
```

## Hook

`useEnrollmentStatus()` expoe:

```text
scope
summary
draftEnrollment
activeEnrollment
status
loading
actionLoading
error
message
canConfirm
loadStatus()
confirmDraft()
```

## UI Criada

Foi criada a rota:

```text
/admin/enrollments
```

Protecao:

```text
ProtectedRoute roles=["admin", "coordenador"]
```

A tela permite:

```text
consultar status consolidado por studentPersonId + studentProfileId
visualizar DRAFT
visualizar ACTIVE
visualizar NONE
visualizar CONFLICT
exibir loading
exibir erro controlado
confirmar DRAFT apenas quando nao houver ACTIVE conflitante
```

## Guardas

A confirmacao fica desabilitada quando:

```text
nao houve consulta
status e NONE
status e ACTIVE
status e CONFLICT
DRAFT nao possui id valido
request esta em andamento
```

Nao foi criada nenhuma integracao com financeiro, turmas, agenda ou
notificacoes.

## Navegacao

`src/components/AppSidebar.tsx` recebeu o item "Matriculas" para
admin/coordenador. O mobile bottom nav nao foi alterado; no mobile a rota fica
disponivel pelo menu lateral existente.

## Validacoes Executadas

```text
cmd /c npm run build: aprovado
build frontend separado: nao aplicavel
cmd /c npm run lint: reprovado por pendencias preexistentes fora do escopo
npx eslint arquivos da Sprint 9.55: aprovado
GET http://127.0.0.1:3000/admin/enrollments: 200
smoke test: aprovado
```

Nao existe `frontend/package.json`; portanto nao ha build separado com
`--prefix frontend`.

O lint global encontrou 460 problemas ja existentes em arquivos fora desta
sprint, principalmente formatacao Prettier em backend/domains/componentes
antigos e regras em `src/lib/alunos-store.ts`. Os arquivos criados/alterados
pela Sprint 9.55 passaram no ESLint isolado.

## Smoke Test Esperado

```text
FRONTEND_ENROLLMENT_ADMIN_UI_READY=true
ENROLLMENT_API_CLIENT_CREATED=true
ENROLLMENT_TYPES_CREATED=true
ENROLLMENT_STATUS_VIEW_READY=true
DRAFT_STATUS_RENDERED=true
ACTIVE_STATUS_RENDERED=true
CONFLICT_STATUS_RENDERED=true
CONFIRM_ACTION_GUARDED=true
NO_EXISTING_ROUTE_BROKEN=true
NO_BACKEND_SCHEMA_CHANGE=true
```

## Riscos

```text
a tela consulta por ids tecnicos porque ainda nao ha contrato frontend para buscar aluno/perfil por nome nesta sprint
confirmacao depende da permissao backend canManageSystem alem do ProtectedRoute frontend
routeTree.gen.ts e gerado automaticamente pelo TanStack Router durante build/dev
```

## Proximos Passos

```text
adicionar busca administrativa por aluno quando houver contrato seguro
adicionar filtros/listagem quando o backend expuser endpoint paginado
evoluir confirmacao para dialog se o fluxo operacional exigir dupla confirmacao
integrar turmas/financeiro apenas em sprint dedicada
```
