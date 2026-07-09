# Sprint 17.9 - Frontend - Mata-mata

## Objetivo

Adicionar a tela administrativa de mata-mata do campeonato em
`/admin/campeonatos/$championshipId/mata-mata`, integrada ao fluxo Grupos -> Rodadas ->
Classificacao -> Mata-mata.

## Hooks

Arquivo `src/features/campeonatos/hooks/useChampionshipBracket.ts`:

- `useChampionshipBracket()`
- `useGenerateBracket()`
- `useUpdateBracketMatch()`
- `useDeleteBracket()`
- `useAdvanceBracket()`

As mutacoes invalidam o cache do mata-mata, classificacao e detalhe do campeonato quando aplicavel.

## API

Funcoes adicionadas em `src/features/campeonatos/api/championship.api.ts`:

- `getChampionshipBracket()`
- `generateChampionshipBracket()`
- `updateChampionshipBracketMatch()`
- `advanceChampionshipBracketMatch()`
- `deleteChampionshipBracket()`

## Componentes

Componentes adicionados:

- `ChampionshipBracketFilters.tsx`
- `ChampionshipGenerateBracketDialog.tsx`
- `ChampionshipBracketTree.tsx`
- `ChampionshipBracketMatchCard.tsx`

## Pagina e Rota

Pagina:

- `src/features/campeonatos/pages/ChampionshipBracketPage.tsx`

Rota:

- `src/routes/admin/campeonatos.$championshipId.mata-mata.tsx`

## Interface

A tela permite:

- visualizar arvore completa ou filtrada por fase
- gerar mata-mata automatico a partir da classificacao
- gerar mata-mata manual com placeholders
- editar equipes antes do inicio
- editar data, hora, quadra, status e placar
- definir vencedor manualmente ou pelo placar
- avancar vencedor para a fase seguinte
- remover chaveamento antes do inicio

## Estados

Estados tratados:

- carregamento com `SkeletonDashboard`
- erro com mensagem formatada por `formatApiErrorMessage`
- lista vazia sem chaveamento gerado
- fase sem jogos apos filtro
- mutacoes pendentes com botoes desabilitados

## Navegacao

Foram adicionados links de Mata-mata em:

- card administrativo do campeonato
- pagina de grupos
- pagina de rodadas
- pagina de classificacao
- pagina de mata-mata

## Testes

Arquivo adicionado:

- `src/features/campeonatos/tests/championship-brackets.frontend.test.mjs`

Cenarios cobertos:

- hooks React Query
- pagina e rota dedicada
- componentes de filtros, geracao, arvore e card
- endpoints REST de playoffs
- ausencia de escopos futuros como sumula, estatisticas e portal publico

## Fora do Escopo

Nao foram implementados nesta sprint:

- sumula digital
- estatisticas e rankings
- portal publico
- notificacoes automaticas
