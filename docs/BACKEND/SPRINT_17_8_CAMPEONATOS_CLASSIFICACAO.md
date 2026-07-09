# Sprint 17.8 - Campeonatos: Classificacao

## Escopo

- Backend administrativo para classificacao da fase de grupos.
- Repository de aplicacao `ChampionshipStandingRepository`.
- Implementacao MySQL `MySqlChampionshipStandingRepository`.
- Service `ChampionshipStandingService` com calculo por grupos, classificacao geral,
  criterios de desempate e persistencia idempotente.
- Controller `ChampionshipStandingController` e integracao no router administrativo de Campeonatos.
- Recalculo automatico quando resultados completos de jogos sao criados, alterados ou removidos.

## Rotas

Base: `/admin/campeonatos` e `/api/admin/campeonatos`.

- `GET /:championshipId/classificacao`
- `POST /:championshipId/classificacao/recalcular`
- `GET /:championshipId/grupos/:groupId/classificacao`

## Persistencia

- `j12_campeonato_classificacao`: snapshot calculado por campeonato, grupo e inscricao.
- O calculo usa apenas equipes inscritas com status `PENDING` ou `CONFIRMED`.
- Jogos `CANCELLED` ou `POSTPONED` nao entram na tabela.
- Jogos sem placar completo nao entram na tabela.

## Fora do Escopo

Nao foram implementados mata-mata, sumulas, estatisticas ou portal publico.
