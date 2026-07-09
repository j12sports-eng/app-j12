# Sprint 17.5 - Frontend - Atletas das Inscricoes

## Objetivo

Adicionar a tela administrativa de elenco da equipe inscrita, acessada a partir da lista de inscricoes de campeonatos.

## Rota

- `/admin/campeonatos/inscricoes/:registrationId/atletas`

Arquivo:

- `src/routes/admin/campeonatos.inscricoes.$registrationId.atletas.tsx`

## Hooks

- `useChampionshipRegistrationPlayers()`
- `useChampionshipRegistrationPlayer()`
- `useCreateRegistrationPlayer()`
- `useUpdateRegistrationPlayer()`
- `useDeleteRegistrationPlayer()`
- `useSetCaptain()`

Os hooks usam React Query com cache por inscricao e invalidacao apos criacao, edicao, exclusao logica e definicao de capitao.

## Componentes

- `ChampionshipRegistrationPlayersPage.tsx`
- `ChampionshipRegistrationPlayersList.tsx`
- `ChampionshipRegistrationPlayerForm.tsx`
- `ChampionshipRegistrationPlayersFilters.tsx`

## Fluxo

1. O administrador acessa `/admin/campeonatos/inscricoes`.
2. Cada inscricao exibe a acao `Elenco`.
3. A tela de elenco carrega a inscricao e lista seus atletas.
4. O usuario pode cadastrar, editar, excluir logicamente ou definir capitao.
5. A lista e atualizada automaticamente apos cada mutacao.

## Filtros e ordenacao

- Busca por nome/documento/camisa.
- Filtro por posicao.
- Filtro por status ativo/inativo.
- Ordenacao por camisa, nome, posicao, cadastro ou atualizacao.
- Paginacao com o padrao visual das inscricoes.

## Bloqueios

Quando a inscricao esta cancelada:

- A tela permanece consultavel.
- Formulario e acoes de alteracao ficam bloqueados.
- O backend tambem rejeita alteracoes.

## Limitacoes

- Sem upload de documentos.
- Sem jogos, grupos, tabelas, classificacao ou sumulas.
- `athleteId` e campo opcional para integracao futura, sem busca em cadastro global nesta sprint.
