# Sprint 17.5 - Campeonatos - Atletas das Inscricoes

## Objetivo

Gerenciar o elenco de cada equipe inscrita em campeonato. O atleta pertence a uma inscricao (`registrationId`) e a modelagem ja deixa `athleteId` nullable para futura integracao com cadastro global, sem implementar essa integracao nesta sprint.

## Arquitetura

- Entity: `ChampionshipRegistrationPlayer`.
- DTO: `toRegistrationPlayerAdminDto`.
- Validators: `registration-player.validators.js`.
- Service: `ChampionshipRegistrationPlayerService`.
- Repository: `MySqlChampionshipRegistrationPlayerRepository`.
- Controller: `ChampionshipRegistrationPlayerController`.
- Rotas no router administrativo existente de Campeonatos.
- Autorizacao: mesmo guard atual `requireAuth + canManageSystem`.

## Persistencia

Tabela: `j12_campeonato_inscricao_atletas`.

Campos principais:

- `id`
- `registration_id`
- `athlete_id` nullable
- `name`
- `birth_date`
- `document`
- `shirt_number`
- `position`
- `captain`
- `active`
- `created_at`
- `updated_at`

Indices:

- `registration_id`
- `registration_id, shirt_number, active`
- `registration_id, captain, active`
- `athlete_id`
- `active`
- `name`

## Endpoints

Base: `/api/admin/campeonatos`.

- `POST /inscricoes/:registrationId/atletas`
- `GET /inscricoes/:registrationId/atletas`
- `GET /inscricoes/:registrationId/atletas/:playerId`
- `PATCH /inscricoes/:registrationId/atletas/:playerId`
- `DELETE /inscricoes/:registrationId/atletas/:playerId`
- `PATCH /inscricoes/:registrationId/atletas/:playerId/capitao`

## Payloads

Criacao/edicao:

```json
{
  "athleteId": null,
  "name": "Ana Souza",
  "birthDate": "2012-05-10",
  "document": "123456",
  "shirtNumber": 10,
  "position": "Ala",
  "captain": true,
  "active": true
}
```

Definir capitao:

```json
{
  "captain": true
}
```

Filtros da listagem:

- `search`
- `position`
- `status`: `ACTIVE` ou `INACTIVE`
- `sortBy`: `shirtNumber`, `name`, `position`, `createdAt`, `updatedAt`
- `sortDirection`: `ASC` ou `DESC`
- `page`
- `limit`

## Regras

- Nao cadastra atleta em inscricao inexistente.
- Atleta sempre e consultado/alterado pelo par `registrationId + playerId`.
- Inscricao cancelada bloqueia criacao, edicao, exclusao e definicao de capitao.
- Numero de camisa nao pode repetir entre atletas ativos da mesma inscricao.
- Apenas um atleta ativo pode ser capitao por inscricao.
- Atleta inativo nao pode ser capitao.
- Exclusao e logica: `active = false` e `captain = false`.
- Nao ha validacoes de jogos, sumulas, grupos ou tabelas.

## Limitacoes

- `athleteId` e apenas referencia futura.
- Nao ha upload de documentos.
- Nao ha integracao com cadastro global de atletas/alunos.
- Nao ha comissao tecnica nesta sprint.
