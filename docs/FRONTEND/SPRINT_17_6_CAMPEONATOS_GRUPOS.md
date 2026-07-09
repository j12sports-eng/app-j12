# Sprint 17.6 - Frontend - Grupos de Campeonatos

## Objetivo

Adicionar a tela administrativa de grupos por campeonato, acessada a partir do card do campeonato.

## Rota

- `/admin/campeonatos/:championshipId/grupos`

Arquivo:

- `src/routes/admin/campeonatos.$championshipId.grupos.tsx`

## Hooks

- `useChampionshipGroups()`
- `useChampionshipGroup()`
- `useCreateChampionshipGroup()`
- `useUpdateChampionshipGroup()`
- `useDeleteChampionshipGroup()`
- `useAssignRegistrationToGroup()`
- `useRemoveRegistrationFromGroup()`
- `useMoveRegistrationBetweenGroups()`
- `useDrawChampionshipGroups()`
- `useRedistributeChampionshipGroups()`

Os hooks usam React Query com cache por campeonato e invalidacao apos criacao, edicao,
remocao, vinculo, movimentacao, sorteio e redistribuicao.

## Componentes

- `ChampionshipGroupsPage.tsx`
- `ChampionshipGroupFilters.tsx`
- `ChampionshipGroupForm.tsx`
- `ChampionshipGroupList.tsx`

## Fluxo

1. O administrador acessa `/admin/campeonatos`.
2. Cada card de campeonato exibe a acao `Grupos`.
3. A tela de grupos carrega campeonato, grupos e inscricoes.
4. O usuario pode criar/editar grupos.
5. O usuario pode vincular equipes pendentes ou confirmadas que ainda nao estao em grupo.
6. O usuario pode mover ou retirar equipes de grupos.
7. O usuario pode sortear ou redistribuir equipes entre grupos.

## Limitacoes

- Nao ha jogos, rodadas, classificacao, sumulas ou mata-mata.
- O sorteio distribui inscricoes administrativas entre grupos.
- A tela nao faz upload de arquivos.
