# Sprint 13.9 - Calendario completo da Agenda

## Objetivo

Adicionar uma visualizacao completa de calendario administrativo para a Agenda,
com navegacao por dia, semana e mes, usando os hooks e componentes existentes
da Sprint 13.8.

## Entrega

```text
AGENDA_ADMIN_CALENDAR_ENABLED=true
AGENDA_DAY_VIEW_ENABLED=true
AGENDA_WEEK_VIEW_ENABLED=true
AGENDA_MONTH_VIEW_ENABLED=true
AGENDA_DATE_NAVIGATION_ENABLED=true
AGENDA_PERIOD_SELECTION_ENABLED=true
AGENDA_EVENTS_HIGHLIGHTED=true
AGENDA_EXISTING_HOOKS_REUSED=true
AGENDA_TANSTACK_ROUTE_REGISTERED=true
NO_BACKEND_CHANGE=true
NO_SCHEMA_CHANGE=true
NO_FINANCIAL_SIDE_EFFECTS=true
NO_NOTIFICATION_SIDE_EFFECTS=true
```

## Arquitetura

```text
src/routes/admin/agenda.tsx
  -> AgendaAdminPage
      -> useAgenda
      -> useAttendance
      -> AgendaCalendar
          -> useAgendaCalendar
          -> ClassScheduleCard
          -> AttendanceBadge
```

O calendario nao cria presenca, financeiro, notificacao ou registros de backend.
Ele apenas organiza visualmente os `AgendaSchedule[]` ja retornados pelo hook
administrativo da Agenda.

## Arquivos principais

```text
src/features/agenda/components/AgendaCalendar.tsx
src/features/agenda/hooks/useAgendaCalendar.ts
src/features/agenda/pages/AgendaAdminPage.tsx
src/features/agenda/types/agenda.types.ts
src/routes/admin/agenda.tsx
src/components/AppSidebar.tsx
src/routeTree.gen.ts
```

## Visualizacoes

```text
Dia
```

Lista detalhada dos eventos do dia selecionado, reutilizando
`ClassScheduleCard`.

```text
Semana
```

Grade responsiva com sete dias, contagem por dia, eventos compactos,
status de presenca e acao de preparar chamada.

```text
Mes
```

Grade mensal responsiva com dias do periodo, contagem e destaque dos eventos
principais.

## Navegacao

O calendario inclui:

```text
periodo anterior
proximo periodo
voltar para hoje
input de data
seletor Dia/Semana/Mes
```

A navegacao respeita o modo selecionado:

```text
Dia: avanca/retorna 1 dia
Semana: avanca/retorna 7 dias
Mes: avanca/retorna 1 mes
```

## Eventos

Eventos com `scheduleDate` ou `attendanceDate` sao exibidos na data concreta.
Eventos recorrentes derivados de `daysOfWeek` ou `dayOfWeek` sao projetados no
periodo visivel.

Estados destacados:

```text
hoje
presenca registrada
ausencia
turma inativa/cancelada
evento recorrente
evento pendente
```

## Rota

```text
/admin/agenda
```

Registrada via TanStack Router e protegida pela propria `AgendaAdminPage`
com `ProtectedRoute` para `admin` e `coordenador`.

## Limitacoes

```text
1. A API administrativa de Agenda ainda precisa estar disponivel no backend.
2. A acao de presenca continua como preparacao local via useAttendance.
3. O calendario projeta recorrencias simples por dia da semana quando a API
   ainda nao retorna aulas concretas por data.
4. Nao houve alteracao de schema, migrations ou backend.
```

## Validacoes executadas

```text
cmd /c npx eslint src/features/agenda/pages/AgendaAdminPage.tsx src/features/agenda/components/AgendaCalendar.tsx src/features/agenda/hooks/useAgendaCalendar.ts src/features/agenda/types/agenda.types.ts src/routes/admin/agenda.tsx src/components/AppSidebar.tsx
cmd /c npx tsc --noEmit --pretty false
cmd /c npm run build
```

## Proximos passos

```text
1. Conectar o endpoint backend administrativo real da Agenda.
2. Substituir projecoes recorrentes por aulas concretas quando a API retornar
   datas persistidas.
3. Criar endpoint protegido para registrar presenca a partir de agendaItemId.
4. Validar a rota /admin/agenda com dados reais em ambiente integrado.
```
