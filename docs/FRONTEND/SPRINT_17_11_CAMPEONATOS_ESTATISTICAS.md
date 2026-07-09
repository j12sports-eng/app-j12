# Sprint 17.11 - Frontend - Estatisticas e Rankings

## Objetivo

Adicionar a interface administrativa de estatisticas e rankings em
`/admin/campeonatos/$championshipId/estatisticas`, consumindo exclusivamente as APIs da Fase A.

## Hooks

Arquivo `src/features/campeonatos/hooks/useChampionshipStatistics.ts`:

- `useChampionshipStatistics()`
- `useChampionshipRankings()`
- `useTopScorers()`
- `useTeamStatistics()`
- `usePlayerStatistics()`
- `useRecalculateStatistics()`

`useTeamStatistics()` e `usePlayerStatistics()` usam `select` sobre o mesmo cache de
`useChampionshipStatistics()`, evitando chamadas duplicadas para equipes e atletas.

## API

Funcoes adicionadas em `src/features/campeonatos/api/championship.api.ts`:

- `getChampionshipStatistics()`
- `getChampionshipRankings()`
- `getChampionshipTopScorers()`
- `recalculateChampionshipStatistics()`

Endpoints consumidos:

- `GET /api/admin/campeonatos/:championshipId/estatisticas`
- `GET /api/admin/campeonatos/:championshipId/rankings`
- `GET /api/admin/campeonatos/:championshipId/artilharia`
- `POST /api/admin/campeonatos/:championshipId/estatisticas/recalcular`

## Componentes

Componentes adicionados:

- `ChampionshipStatisticsPage.tsx`
- `ChampionshipStatisticsCards.tsx`
- `ChampionshipRankingsTabs.tsx`
- `ChampionshipTopScorersTable.tsx`
- `ChampionshipTeamStatisticsTable.tsx`
- `ChampionshipPlayerStatisticsTable.tsx`
- `ChampionshipStatisticsFilters.tsx`
- `ChampionshipStatisticsSummary.tsx`

## Fluxo

A pagina carrega:

- dados do campeonato
- snapshot consolidado de estatisticas
- rankings gerais
- artilharia dedicada

O botao `Recalcular` chama a API administrativa e invalida o cache de estatisticas. A tela nao
calcula regras de negocio; apenas filtra, pagina e renderiza os contratos retornados pelo backend.

## Filtros

Filtros visuais:

- pesquisa por equipe, atleta, sigla, identificador ou camisa
- itens por pagina

As tabelas possuem:

- overflow horizontal
- paginacao
- loading state
- empty state
- error state

## Navegacao

Rota criada:

- `src/routes/admin/campeonatos.$championshipId.estatisticas.tsx`

Entrada adicionada no card administrativo do campeonato:

- `Campeonato -> Estatisticas`

Nao foi criada navegacao paralela.

## Atualizacao Automatica

`src/features/campeonatos/hooks/useMatchReport.ts` agora invalida
`championshipStatisticsQueryKeys` quando uma sumula ou evento e criado, alterado, finalizado,
reaberto ou removido. Nao foi adicionado polling.

## Testes

Arquivo adicionado:

- `src/features/campeonatos/tests/championship-statistics.frontend.test.mjs`

Cenarios cobertos:

- hooks React Query
- pagina e rota dedicada
- componentes de filtros, rankings e tabelas
- endpoints REST e tipos frontend
- invalidação automatica por mutacoes da sumula
- ausencia de polling e portal publico

## Fora do Escopo

Nao foram implementados nesta fase:

- regras de negocio no frontend
- portal publico do campeonato
- polling
- alteracoes em modulos externos a Campeonatos
