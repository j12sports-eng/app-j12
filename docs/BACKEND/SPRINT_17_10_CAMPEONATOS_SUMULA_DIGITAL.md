# Sprint 17.10 - Campeonatos - Sumula Digital

## Objetivo

Implementar a sumula digital administrativa do dominio Campeonatos, vinculada aos jogos da fase de
grupos e sem iniciar funcionalidades da Sprint 17.11. A sumula passa a registrar eventos da partida
e sincroniza o placar oficial do jogo ao ser finalizada.

## Arquitetura

Artefatos backend adicionados em `backend/src/domains/campeonatos`:

- `shared/constants/match-report.constants.js`
- `domain/entities/match-report.entity.js`
- `application/dtos/match-report-admin.dto.js`
- `application/validators/match-report.validators.js`
- `application/repositories/championship-match-report.repository.js`
- `application/services/championship-match-report.service.js`
- `infrastructure/repositories/mysql-championship-match-report.repository.js`
- `presentation/controllers/championship-match-report.controller.js`
- rotas plugadas em `presentation/routes/championship-admin.routes.js`

## Banco de Dados

Tabela `j12_campeonato_sumulas`:

- `id`
- `match_id`
- `championship_id`
- `status`
- `referee`
- `assistant_referee`
- `scorer`
- `observations`
- `home_score`
- `away_score`
- `started_at`
- `finished_at`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`

Tabela `j12_campeonato_sumula_eventos`:

- `id`
- `report_id`
- `match_id`
- `championship_id`
- `team_registration_id`
- `player_id`
- `related_player_id`
- `event_type`
- `minute`
- `period`
- `description`
- `metadata_json`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`

## Endpoints

Base administrativa existente: `/api/admin/campeonatos`.

- `POST /jogos/:matchId/sumula`
- `GET /jogos/:matchId/sumula`
- `PATCH /jogos/:matchId/sumula`
- `POST /jogos/:matchId/sumula/abrir`
- `POST /jogos/:matchId/sumula/eventos`
- `PATCH /jogos/:matchId/sumula/eventos/:eventId`
- `DELETE /jogos/:matchId/sumula/eventos/:eventId`
- `POST /jogos/:matchId/sumula/finalizar`
- `POST /jogos/:matchId/sumula/reabrir`

## Regras Implementadas

- Uma sumula e unica por jogo.
- Eventos pertencem ao jogo e a sumula do jogo informado.
- Gols, cartoes, faltas, substituicoes e W.O. exigem equipe do jogo.
- Gols, cartoes e faltas exigem atleta ativo da equipe informada.
- Substituicao exige atleta que entra e atleta que sai na mesma equipe.
- Observacoes e tempo tecnico podem ser registrados sem atleta.
- Sumula finalizada bloqueia edicao de dados e eventos.
- Reabertura libera edicao novamente, mantendo o resultado do jogo ate nova finalizacao.
- Placar final sem W.O. precisa bater com os gols registrados.
- W.O. permite placar final informado sem exigir gols equivalentes.
- Finalizacao chama `ChampionshipRoundService.updateMatch()` com `homeScore`, `awayScore` e
  `FINISHED`, mantendo a recalculacao de classificacao ja existente.

## Testes

Cobertura adicionada:

- `application/tests/championship-match-report.service.test.js`
- `application/tests/championship-match-report.repository.test.js`
- `presentation/tests/championship-admin.routes.test.js`

Cenarios cobertos:

- criacao da sumula
- abertura
- registro de gol
- calculo de placar por eventos
- finalizacao e sincronizacao do placar do jogo
- bloqueio apos finalizacao
- reabertura
- W.O. com placar final informado
- rejeicao de atleta invalido
- exposicao das rotas REST
- persistencia basica do repository MySQL com query runner falso

## Fora do Escopo

Nao foram implementados nesta sprint:

- estatisticas e rankings
- portal publico
- notificacoes automaticas
- integracoes externas
- novas regras de mata-mata
