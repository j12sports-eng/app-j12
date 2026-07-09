# Sprint 17.8 - Campeonatos: Classificacao

## Escopo

- API client para classificacao em `src/features/campeonatos/api/championship.api.ts`.
- Tipos, constantes e formatadores de criterios de desempate.
- Hook `useChampionshipStandings` com React Query para listagem e recalc.
- Componentes de filtros e tabela de classificacao.
- Pagina `ChampionshipStandingsPage` e rota `/admin/campeonatos/$championshipId/classificacao`.
- Navegacao a partir dos cards de Campeonatos e das paginas de Grupos/Rodadas.

## Funcionalidades

- Visualizar classificacao geral.
- Visualizar classificacao por grupo.
- Filtrar por grupo.
- Ajustar criterios de desempate.
- Atualizar e recalcular classificacao manualmente.
- Exibir estados de carregamento, erro e lista vazia.

## Fora do Escopo

Nao foram adicionados mata-mata, sumulas, estatisticas ou portal publico.
