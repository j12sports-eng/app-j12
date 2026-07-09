# Sprint 17.7 - Campeonatos: Rodadas e Jogos

## Escopo

- API client para rodadas e jogos em `src/features/campeonatos/api/championship.api.ts`.
- Tipos, constantes e formatadores de fase/status.
- Hook `useChampionshipRounds` com React Query para rodadas, jogos e mutations.
- Componentes de filtros, formulario de rodada, formulario de jogo e lista operacional.
- Pagina `ChampionshipRoundsPage` e rota `/admin/campeonatos/$championshipId/rodadas`.
- Navegacao a partir dos cards de Campeonatos e da pagina de Grupos.

## Funcionalidades

- Listar, criar, editar e remover rodadas vazias.
- Criar jogos manuais entre equipes do mesmo grupo.
- Atualizar status operacional do jogo.
- Mover jogo entre rodadas.
- Remover jogo.
- Gerar confrontos a partir dos grupos cadastrados.

## Fora do Escopo

Nao foram adicionados upload, placar, classificacao, mata-mata, sumulas ou estatisticas.
