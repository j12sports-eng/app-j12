# Sprint 17.6 - Campeonatos - Grupos

## Objetivo

Implementar o gerenciamento administrativo de grupos por campeonato, permitindo criar grupos,
vincular equipes inscritas, mover equipes entre grupos e executar distribuicao inicial ou
redistribuicao.

Fora do escopo: jogos, rodadas, classificacao, sumulas, estatisticas, mata-mata e portal publico.

## Arquitetura

- Entity: `ChampionshipGroup` e `ChampionshipGroupRegistration`.
- DTO: `group-admin.dto.js`.
- Validators: `group.validators.js`.
- Service: `ChampionshipGroupService`.
- Repository: `MySqlChampionshipGroupRepository`.
- Controller: `ChampionshipGroupController`.
- Rotas no router administrativo existente de Campeonatos.
- Autorizacao: mesmo guard atual `requireAuth + canManageSystem`.

## Persistencia

Tabelas:

- `j12_campeonato_grupos`
- `j12_campeonato_grupo_inscricoes`

Campos principais de `j12_campeonato_grupos`:

- `id`
- `championship_id`
- `name`
- `display_order`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`

Campos principais de `j12_campeonato_grupo_inscricoes`:

- `id`
- `group_id`
- `registration_id`
- `draw_position`
- `created_at`
- `updated_at`

## Endpoints

Base: `/api/admin/campeonatos`.

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

## Payloads

Criar/editar grupo:

```json
{
  "name": "Grupo A",
  "displayOrder": 1
}
```

Vincular equipe inscrita:

```json
{
  "registrationId": "insc-1",
  "drawPosition": 1
}
```

Mover equipe:

```json
{
  "targetGroupId": "grupo-2",
  "drawPosition": 2
}
```

Sortear ou redistribuir:

```json
{
  "groupCount": 4,
  "shuffle": true
}
```

## Regras

- Nao cria grupo para campeonato inexistente.
- Nao permite nomes duplicados dentro do mesmo campeonato.
- Grupo com equipes vinculadas nao pode ser removido.
- Apenas inscricoes `PENDING` ou `CONFIRMED` podem compor grupos.
- Inscricao `CANCELLED` nao pode ser vinculada a grupos.
- Uma inscricao so pode estar em um grupo por vez.
- `sortear` falha se ja houver equipes em grupos.
- `redistribuir` refaz os vinculos existentes de forma transacional.
- Nao cria jogos, rodadas, classificacao, sumulas ou mata-mata.

## Testes

- Validators: `championship-group.validators.test.js`.
- Service: `championship-group.service.test.js`.
- Controller: `championship-group.controller.test.js`.
- Router: `championship-admin.routes.test.js`.
