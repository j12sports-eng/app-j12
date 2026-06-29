# Hooks

Documentacao dos hooks de dados e dominio do frontend.

## Indice

- [Resumo](#resumo)
- [Hooks de Portal](#hooks-de-portal)
- [Hooks Financeiros](#hooks-financeiros)
- [Hooks de Dashboard](#hooks-de-dashboard)
- [Hooks de Catalogo Publico](#hooks-de-catalogo-publico)
- [Hooks de Stores](#hooks-de-stores)
- [Pontos de Atencao](#pontos-de-atencao)
- [Links Relacionados](#links-relacionados)

## Resumo

O frontend usa uma combinacao de hooks customizados com `useState`/`useEffect`, `useSyncExternalStore` e React Query.

## Hooks de Portal

- `usePortalAluno`.
- `usePortalFinanceiro`.
- `usePortalPresencas`.
- `usePortalContrato`.
- `usePortalNotificacoes`.
- `useResponsavelAlunos`.
- `useResponsavelAlunoPerfil`.
- `useDashboardResponsavel`.

## Hooks Financeiros

- `useFinanceiroAdmin`.
- `useFinanceiroAluno`.
- `useFinanceiro`.
- `useResponsavelFinanceiro`.

Eles escutam eventos Socket.IO para refresh de dados.

## Hooks de Dashboard

- `useDashboardAluno`.
- `useDashboardResponsavel`.
- Hook recente `BirthdayHook` existe no worktree analisado e chama `/dashboard/birthdays`.

## Hooks de Catalogo Publico

Arquivo: `src/lib/public-catalog-hooks.ts`.

Usa React Query para:

- modalidades publicas.
- unidades publicas.
- turmas publicas.
- horarios publicos.

## Hooks de Stores

Stores exportam hooks:

- `useAlunos`.
- `useTurmas`.
- `usePlanos`.
- `useProfessores`.
- `useResponsaveis`.
- `useModalidades`.
- `useUnidades`.
- `useTrialClasses`.
- `useContratos`.
- `useSettingsState`.

## Pontos de Atencao

- Padrao de fetching nao e unico.
- Muitos hooks usam `any`.
- Alguns hooks imprimem logs no console.
- Definir ownership por dominio antes de refatorar.

## Links Relacionados

- [Estado Global](./ESTADO_GLOBAL.md)
- [Portais](./PORTAIS.md)
- [Sockets](../BACKEND/SOCKETS.md)

