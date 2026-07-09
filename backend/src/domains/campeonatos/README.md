# Dominio Campeonatos

Infraestrutura criada na Sprint 17.1 e gerenciamento administrativo concluido na Sprint 17.2.

## Escopo desta sprint

- Estrutura de dominio em camadas: `application`, `domain`, `infrastructure`, `presentation` e `shared`.
- Entidades base: `Championship`, `Category`, `Phase` e `Round`.
- Contrato `ChampionshipRepository` e implementacao `MySqlChampionshipRepository`.
- Service administrativo com operacoes basicas: `create`, `update`, `remove`, `findById`, `findAll`, `publish` e `archive`.
- Validacoes basicas de nome, categoria, modalidade, datas e status.
- Validacao de periodo tambem em atualizacao parcial de datas.
- Rotas administrativas protegidas por `requireAuth` e `canManageSystem`.
- Metadado `CHAMPIONSHIP_ADMIN_ACCESS_POLICY` preparado para permissao granular futura, sem alterar o guard atual.
- Estrutura `metadata.logo` preparada para referencia futura de logo, sem upload real nesta sprint.
- Estrutura de equipe preparada para escudo/logo futuro por referencia (`fileId`, `storageKey`, `publicUrl`), sem upload real.
- Estrutura de comissao tecnica preparada no contrato de equipe, sem CRUD especifico.
- Inscricao de equipes em campeonatos com status `PENDING`, `CONFIRMED`, `REFUSED` e `CANCELLED`.
- Relacionamento administrativo entre Campeonato e Equipe sem atletas, jogos ou tabelas.
- Gerenciamento de atletas por inscricao de equipe, com capitao unico, camisa unica e exclusao logica.
- Gerenciamento administrativo de grupos por campeonato, com vinculo e redistribuicao de equipes inscritas.
- Gerenciamento administrativo de rodadas e jogos da fase de grupos, com criacao manual,
  movimentacao entre rodadas, status operacional e geracao automatica de confrontos por grupo.
- Classificacao administrativa da fase de grupos, com tabela geral, tabela por grupo,
  criterios de desempate e recalc a partir dos resultados completos.
- Mata-mata administrativo, com geracao automatica/manual, avancos e atualizacao de partidas.
- Sumula digital administrativa, com abertura, eventos, placar final, finalizacao e reabertura.
- Estatisticas administrativas do campeonato, equipes, atletas, rankings e artilharia.

## Fora do escopo

Upload definitivo de logo/escudo, CRUD especifico de comissao tecnica e portal publico
permanecem fora do escopo desta entrega.

## Rotas

Base: `/admin/campeonatos` e `/api/admin/campeonatos`.

- `GET /`
- `GET /:id`
- `POST /`
- `POST /:id/publish`
- `POST /:id/archive`
- `PUT /:id`
- `DELETE /:id`
- `GET /inscricoes`
- `GET /:championshipId/inscricoes`
- `GET /inscricoes/:registrationId`
- `GET /inscricoes/equipes-disponiveis`
- `POST /inscricoes`
- `PATCH /inscricoes/:registrationId/status`
- `PATCH /inscricoes/:registrationId`
- `POST /inscricoes/:registrationId/cancelar`
- `DELETE /inscricoes/:registrationId`
- `GET /inscricoes/:registrationId/atletas`
- `POST /inscricoes/:registrationId/atletas`
- `GET /inscricoes/:registrationId/atletas/:playerId`
- `PATCH /inscricoes/:registrationId/atletas/:playerId`
- `DELETE /inscricoes/:registrationId/atletas/:playerId`
- `PATCH /inscricoes/:registrationId/atletas/:playerId/capitao`
- `GET /:championshipId/grupos`
- `POST /:championshipId/grupos`
- `POST /:championshipId/grupos/sortear`
- `POST /:championshipId/grupos/redistribuir`
- `GET /:championshipId/grupos/:groupId`
- `PATCH /:championshipId/grupos/:groupId`
- `DELETE /:championshipId/grupos/:groupId`
- `POST /:championshipId/grupos/:groupId/inscricoes`
- `PATCH /:championshipId/grupos/:groupId/inscricoes/:registrationId/mover`
- `DELETE /:championshipId/grupos/:groupId/inscricoes/:registrationId`
- `GET /:championshipId/classificacao`
- `POST /:championshipId/classificacao/recalcular`
- `GET /:championshipId/grupos/:groupId/classificacao`
- `GET /:championshipId/rodadas`
- `POST /:championshipId/rodadas`
- `POST /:championshipId/rodadas/gerar-jogos`
- `GET /:championshipId/rodadas/:roundId`
- `PATCH /:championshipId/rodadas/:roundId`
- `DELETE /:championshipId/rodadas/:roundId`
- `GET /:championshipId/jogos`
- `POST /:championshipId/rodadas/:roundId/jogos`
- `PATCH /:championshipId/jogos/:matchId`
- `PATCH /:championshipId/jogos/:matchId/mover`
- `DELETE /:championshipId/jogos/:matchId`
- `POST /:championshipId/playoffs/gerar`
- `GET /:championshipId/playoffs`
- `GET /:championshipId/playoffs/:phase`
- `PATCH /playoffs/matches/:matchId`
- `POST /playoffs/matches/:matchId/avancar`
- `DELETE /:championshipId/playoffs`
- `POST /jogos/:matchId/sumula`
- `GET /jogos/:matchId/sumula`
- `PATCH /jogos/:matchId/sumula`
- `POST /jogos/:matchId/sumula/abrir`
- `POST /jogos/:matchId/sumula/eventos`
- `PATCH /jogos/:matchId/sumula/eventos/:eventId`
- `DELETE /jogos/:matchId/sumula/eventos/:eventId`
- `POST /jogos/:matchId/sumula/finalizar`
- `POST /jogos/:matchId/sumula/reabrir`
- `GET /:championshipId/estatisticas`
- `POST /:championshipId/estatisticas/recalcular`
- `GET /:championshipId/rankings`
- `GET /:championshipId/artilharia`

## Persistencia

O projeto atual usa MySQL direto via `backend/src/config/db.js`. As tabelas `j12_campeonatos`,
`j12_campeonato_inscricoes`, `j12_campeonato_inscricao_atletas`, `j12_campeonato_grupos`,
`j12_campeonato_grupo_inscricoes`, `j12_campeonato_rodadas`, `j12_campeonato_jogos` e
`j12_campeonato_classificacao`, alem das tabelas de mata-mata, sumula e estatisticas,
sao criadas de forma idempotente pelos repositories para manter compatibilidade com o padrao vigente.
