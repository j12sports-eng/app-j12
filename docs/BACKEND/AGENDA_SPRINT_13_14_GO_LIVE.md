# Sprint 13.14 - Agenda Go Live

## Escopo consolidado

- Revisao do backend de Agenda: facade, services, routes, controller,
  repository MySQL, validacoes e permissoes.
- Revisao do frontend de Agenda: hooks, pagina administrativa, calendario,
  drag-and-drop, recorrencias, tipagens e estados de UX.
- Otimizacoes de React Query, code splitting e projecao de recorrencias no
  navegador.
- Testes unitarios e de integracao do dominio executados antes do encerramento.

## Ajustes aplicados

- `useAgenda` agora usa `keepPreviousData`, `staleTime`, `gcTime` e desativa
  refetch em foco de janela.
- `useAgendaConflictValidation` usa nomenclatura padronizada
  `THIS_OCCURRENCE`, cache curto e sem refetch em foco.
- `useAgendaCalendar` valida overflow de datas e evita materializar longas
  listas de dias para recorrencias sem limite maximo.
- `/admin/agenda` passou a carregar a pagina administrativa por lazy loading.
- `ClassScheduleCard` foi memoizado.
- Controles segmentados da Agenda receberam `aria-pressed`.
- Tipagens de Agenda agora representam os metadados opcionais de notificacao.
- Testes cobrem que notificacoes so sao chamadas quando ha destinatarios
  explicitos.

## Validacoes executadas

```text
node --test backend/src/domains/agenda/application/tests/agenda-application.service.test.js backend/src/domains/agenda/application/tests/agenda-conflict-validation.service.test.js backend/src/domains/agenda/application/tests/agenda-recurrence.service.test.js backend/src/domains/agenda/application/tests/agenda.facade.test.js backend/src/domains/agenda/infrastructure/repositories/mysql-agenda.repository.test.js backend/src/domains/agenda/presentation/tests/agenda-admin.controller.test.js
```

Resultado: 48 testes passando.

```text
cmd /c npx eslint src/features/agenda src/routes/admin/agenda.tsx backend/src/domains/agenda/application/tests/agenda-application.service.test.js backend/src/domains/agenda/application/services/agenda-application.service.js backend/src/domains/agenda/application/facades/agenda.facade.js backend/src/domains/agenda/presentation/routes/agenda-admin.routes.js
```

Resultado: sem erros.

```text
cmd /c npx tsc --noEmit
```

Resultado: sem erros.

```text
node --test backend/src/domains/notificacoes/application/tests/agenda-notification.contract.test.js backend/src/domains/notificacoes/application/tests/agenda-notification.service.test.js backend/src/domains/notificacoes/infrastructure/repositories/mysql-notification.repository.test.js backend/src/domains/notificacoes/presentation/tests/notification-center.controller.test.js
```

Resultado: 14 testes passando no smoke complementar Agenda -> Notificacoes.

```text
cmd /c npm run build
```

Resultado: build client e SSR concluido com sucesso.

## Producao

- SSR/Vite: lazy loading e TypeScript validados.
- PM2/Nginx: sem mudanca de porta, path ou variavel obrigatoria.
- MySQL: queries continuam parametrizadas no adapter `MySqlAgendaRepository`.
- Prisma: nao ha `schema.prisma` no repositorio atual; nao houve alteracao
  Prisma aplicavel nesta sprint.
- Segurança: rotas administrativas continuam sob `requireAuth` +
  `canManageSystem`.
- UX: loading, empty e error states preservados em calendario e timeline.
