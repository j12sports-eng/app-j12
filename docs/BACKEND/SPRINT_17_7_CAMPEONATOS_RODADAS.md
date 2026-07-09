# Sprint 17.7 - Campeonatos: Rodadas e Jogos

## Escopo

- Backend administrativo para rodadas e jogos da fase de grupos.
- Repository de aplicacao `ChampionshipRoundRepository`.
- Implementacao MySQL `MySqlChampionshipRoundRepository`.
- Service `ChampionshipRoundService` com validacoes de campeonato, grupo, inscricoes ativas, duplicidade de confronto e conflito de quadra/horario.
- Controller `ChampionshipRoundController` e integracao no router administrativo de Campeonatos.
- Geracao automatica de confrontos por grupo usando inscricoes `PENDING` e `CONFIRMED`.

## Rotas

Base: `/admin/campeonatos` e `/api/admin/campeonatos`.

- `GET /:championshipId/rodadas`
- `POST /:championshipId/rodadas`
- `GET /:championshipId/rodadas/:roundId`
- `PATCH /:championshipId/rodadas/:roundId`
- `DELETE /:championshipId/rodadas/:roundId`
- `POST /:championshipId/rodadas/gerar-jogos`
- `GET /:championshipId/jogos`
- `POST /:championshipId/rodadas/:roundId/jogos`
- `PATCH /:championshipId/jogos/:matchId`
- `PATCH /:championshipId/jogos/:matchId/mover`
- `DELETE /:championshipId/jogos/:matchId`

## Persistencia

- `j12_campeonato_rodadas`: rodadas por campeonato, fase e numero.
- `j12_campeonato_jogos`: jogos com rodada, grupo, mandante, visitante, data, horario, quadra e status.
- Schema criado de forma idempotente no repository MySQL, seguindo o padrao vigente do dominio.

## Fora do Escopo

Nao foram implementados placares, classificacao, mata-mata, sumulas ou estatisticas.
