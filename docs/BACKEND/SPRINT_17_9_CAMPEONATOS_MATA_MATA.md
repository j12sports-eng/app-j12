# Sprint 17.9 - Campeonatos - Mata-mata

## Objetivo

Implementar a administracao do mata-mata do dominio Campeonatos sem alterar as entregas das
Sprints 17.1 a 17.8. O fluxo usa a classificacao como base para gerar a arvore automaticamente e
tambem permite criar chaveamentos manuais antes do inicio da fase.

## Arquitetura

Artefatos backend adicionados no dominio `backend/src/domains/campeonatos`:

- `shared/constants/bracket.constants.js`
- `domain/entities/bracket.entity.js`
- `application/dtos/bracket-admin.dto.js`
- `application/validators/bracket.validators.js`
- `application/repositories/championship-bracket.repository.js`
- `application/services/championship-bracket.service.js`
- `infrastructure/repositories/mysql-championship-bracket.repository.js`
- `presentation/controllers/championship-bracket.controller.js`
- rotas plugadas em `presentation/routes/championship-admin.routes.js`

## Banco de Dados

Tabela `j12_campeonato_chaveamentos`:

- `id`
- `championship_id`
- `initial_phase`
- `display_order`
- `status`
- `mode`
- `team_count`
- `include_third_place`
- `champion_registration_id`
- `runner_up_registration_id`
- `third_place_registration_id`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`

Tabela `j12_campeonato_chaveamento_jogos`:

- `id`
- `bracket_id`
- `championship_id`
- `phase`
- `display_order`
- `round_order`
- `home_registration_id`
- `away_registration_id`
- `winner_registration_id`
- `next_match_id`
- `next_match_slot`
- `third_place_match_id`
- `third_place_slot`
- `match_date`
- `start_time`
- `court`
- `status`
- `home_score`
- `away_score`
- `result_updated_by`
- `result_updated_at`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`

## Endpoints

Base administrativa existente: `/api/admin/campeonatos`.

- `POST /:championshipId/playoffs/gerar`
- `GET /:championshipId/playoffs`
- `GET /:championshipId/playoffs/:phase`
- `PATCH /playoffs/matches/:matchId`
- `POST /playoffs/matches/:matchId/avancar`
- `DELETE /:championshipId/playoffs`

## Regras Implementadas

- Geracao automatica usa `ChampionshipStandingService.recalculate()` e ranqueia por
  `overallPosition`.
- Geracao manual cria a arvore com confrontos informados e placeholders vazios.
- Fases suportadas: `ROUND_OF_32`, `ROUND_OF_16`, `QUARTER_FINAL`, `SEMI_FINAL`, `FINAL` e
  `THIRD_PLACE`.
- Equipe nao pode aparecer duas vezes na mesma fase.
- Confronto nao pode ter a mesma equipe nos dois lados.
- Vencedor precisa ser mandante ou visitante do confronto.
- Placar empatado nao finaliza jogo sem vencedor explicito.
- Vencedor avanca para o proximo confronto pelo slot `HOME` ou `AWAY`.
- Perdedor da semifinal alimenta a disputa de terceiro lugar quando habilitada.
- Final define campeao e vice-campeao.
- Chaveamento iniciado nao pode ser removido nem recalculado.
- Equipes de confrontos iniciados nao podem ser alteradas.

## Testes

Cobertura adicionada:

- `application/tests/championship-bracket.service.test.js`
- `presentation/tests/championship-admin.routes.test.js`

Cenarios cobertos:

- geracao automatica pela classificacao
- geracao manual com placeholders
- integridade dos links entre fases
- avancamento de vencedor
- finalizacao com campeao e vice
- equipe repetida
- fase invalida
- bloqueio de remocao apos inicio
- exposicao das rotas REST

## Fora do Escopo

Nao foram implementados nesta sprint:

- sumula digital
- estatisticas e rankings
- portal publico
- notificacoes automaticas
