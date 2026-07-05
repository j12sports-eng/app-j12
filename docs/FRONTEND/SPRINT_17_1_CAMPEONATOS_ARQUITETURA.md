# Sprint 17.1 - Frontend do Modulo Campeonatos

## Objetivo

Criar a infraestrutura frontend do modulo Campeonatos sem implementar operacao esportiva completa.

## Estrutura criada

- `src/features/campeonatos/api`
- `src/features/campeonatos/hooks`
- `src/features/campeonatos/types`
- `src/features/campeonatos/constants`
- `src/features/campeonatos/utils`
- `src/features/campeonatos/components`
- `src/features/campeonatos/pages`
- `src/features/campeonatos/schemas`
- `src/features/campeonatos/tests`

## API

`src/features/campeonatos/api/championship.api.ts` centraliza o contrato HTTP:

- `listChampionships`
- `getChampionship`
- `createChampionship`
- `updateChampionship`
- `deleteChampionship`

## Hooks

`src/features/campeonatos/hooks/useChampionships.ts` usa React Query:

- `useChampionships`
- `useChampionship`
- `useCreateChampionship`
- `useUpdateChampionship`
- `useDeleteChampionship`

## Componentes

- `ChampionshipCard`
- `ChampionshipForm`
- `ChampionshipFilters`
- `ChampionshipStatusBadge`

## Pagina

- `ChampionshipsAdminPage`

A pagina possui layout administrativo base com loading, empty e error states. A logica esportiva completa fica para as proximas sprints.

## Rota

- `src/routes/admin/campeonatos.tsx`
- URL: `/admin/campeonatos`

`routeTree.gen.ts` deve ser regenerado automaticamente pelo TanStack Router/build.

## Navegacao

O menu lateral administrativo passa a exibir `Campeonatos` para `admin` e `coordenador`.
