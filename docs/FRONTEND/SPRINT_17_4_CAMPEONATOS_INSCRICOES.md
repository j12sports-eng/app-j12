# Sprint 17.4 - Frontend de Inscricao de Equipes

## Objetivo

Criar a tela administrativa de inscricoes de equipes em campeonatos, sem implementar atletas, jogos, grupos ou tabelas.

## Rota

- `/admin/campeonatos/inscricoes`

## Tela

A pagina `ChampionshipRegistrationsPage` contem:

- selecao de campeonato;
- lista de equipes inscritas;
- lista de equipes disponiveis;
- pesquisa;
- paginacao;
- ordenacao;
- filtros por status;
- formulario de inscricao;
- cancelamento de inscricao;
- alteracao de status.

## Hooks

- `useChampionshipRegistrations()`
- `useAvailableChampionshipTeams()`
- `useRegisterTeam()`
- `useCancelRegistration()`
- `useUpdateRegistration()`

Os hooks usam React Query com `staleTime`, `gcTime`, cache por filtros e invalidacao apos mutacoes.

## Componentes

- `ChampionshipRegistrationForm`
- `ChampionshipRegistrationFilters`
- `ChampionshipRegistrationList`

## Autorizacao

A rota usa `ProtectedRoute roles={["admin", "coordenador"]}` no frontend e preserva o backend como fonte final de autorizacao.
