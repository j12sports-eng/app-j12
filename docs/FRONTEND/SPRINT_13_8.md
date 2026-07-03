# Sprint 13.8 - Frontend administrativo da Agenda

## Objetivo

Preparar a interface administrativa da Agenda para consulta operacional por
aluno, matricula e turma, mantendo o frontend isolado do backend legado e
consumindo apenas endpoints administrativos protegidos da Agenda.

## Decisao tecnica

```text
PREPARACAO ISOLADA
```

O estado atual do repositorio nao possui rota backend administrativa de Agenda
montada em `/admin/agenda`. Por isso a sprint preparou a feature frontend com
API client, hooks, componentes e pagina, mas nao registrou rota TanStack nova
para evitar expor tela operacional quebrada.

## Arquivos criados

```text
src/features/agenda/api/agenda.api.ts
src/features/agenda/types/agenda.types.ts
src/features/agenda/hooks/useAgenda.ts
src/features/agenda/hooks/useAttendance.ts
src/features/agenda/components/AgendaTimeline.tsx
src/features/agenda/components/AttendanceBadge.tsx
src/features/agenda/components/ClassScheduleCard.tsx
src/features/agenda/pages/AgendaAdminPage.tsx
```

## API client

O client usa o wrapper central `api` de `src/lib/api.ts`, sem URL absoluta.

Endpoints preparados:

```text
GET /admin/agenda/students/:studentPersonId/:studentProfileId/summary
GET /admin/agenda/enrollments/:enrollmentId/summary
GET /admin/agenda/classes/:classId/schedules
```

## Hooks

```text
useAgenda
```

Consulta a Agenda por modo:

```text
student
enrollment
class
```

```text
useAttendance
```

Prepara um rascunho local de chamada sem persistir presenca, sem financeiro e
sem notificacao.

## Componentes

```text
AgendaTimeline
```

Renderiza loading, erro, estado vazio e horarios encontrados.

```text
AttendanceBadge
```

Renderiza estados de presenca:

```text
presenca registrada
ausencia
justificada
atraso
reposicao
pendente
sem presenca
```

```text
ClassScheduleCard
```

Renderiza turma, dias, horario, modalidade, unidade, professor, origem,
status da aula/turma e acao de preparar chamada.

## Pagina preparada

```text
AgendaAdminPage
```

Possui filtros por:

```text
aluno: studentPersonId + studentProfileId
matricula: enrollmentId
turma: classId
```

A pagina inclui metricas operacionais, timeline e painel de preparacao de
chamada. Ela usa `ProtectedRoute` para admin/coordenador, mas ainda nao foi
registrada em `src/routes/admin/agenda.tsx` porque a API administrativa backend
da Agenda ainda nao esta montada no estado atual do repositorio.

## Estados visuais cobertos

```text
loading
erro
sem horarios
horarios encontrados
presenca registrada
ausencia
turma inativa
matricula sem agenda
preparacao local de chamada
```

## Garantias

```text
AGENDA_ADMIN_UI_PREPARED=true
AGENDA_API_CLIENT_READY=true
AGENDA_TYPES_CREATED=true
AGENDA_HOOKS_CREATED=true
AGENDA_COMPONENTS_CREATED=true
ADMIN_ROUTE_BLOCKED_BY_AUTH_OR_ROUTER_GAP=true
NO_EXISTING_ROUTE_BROKEN=true
NO_BACKEND_SCHEMA_CHANGE=true
```

## Fora do escopo

```text
schema
migrations
backend
Matrículas
Turmas
Financeiro
Notificações
mobile
gateway
legado
```

## Limitacoes

```text
1. A UI esta preparada, mas nao operacional em rota real.
2. Falta montar/confirmar a API administrativa backend da Agenda.
3. A marcacao de presenca esta limitada a rascunho local; nao grava attendance.
4. Nao ha criacao de financeiro, notificacao, gateway ou alteracao de schema.
```

## Proximos passos - Sprint 13.9

```text
1. Montar a API administrativa backend da Agenda, se ainda inexistente.
2. Registrar a rota TanStack /admin/agenda quando o endpoint estiver disponivel.
3. Conectar a acao de presenca a um endpoint administrativo canonico.
4. Validar a UI com dados reais de matricula, turma e agenda persistida.
```
