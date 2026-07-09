# Sprint 17.12 - Backend - Portal Publico de Campeonatos

## Objetivo

Entregar a camada backend publica do Portal de Campeonatos da J12, somente leitura, para consumo
do frontend publico da Sprint 17.12 Fase B.

O backend publico expoe apenas campeonatos publicados e dados esportivos sanitizados. Nao ha
endpoints publicos de escrita.

## Arquitetura Final

Base publica:

- `/public/campeonatos`
- `/api/public/campeonatos`

Camadas:

- `application/services/championship-public.service.js`: orquestra validacao, permissao publica,
  chamadas aos services esportivos e DTOs de saida.
- `application/validators/championship-public.validators.js`: valida filtros, paginacao,
  ordenacao e `championshipId`.
- `application/dtos/championship-public.dto.js`: monta payloads por whitelist e remove campos
  administrativos.
- `application/repositories/championship-public.repository.js`: contrato do repository publico.
- `infrastructure/repositories/mysql-championship-public.repository.js`: consulta apenas
  campeonatos `PUBLISHED` e equipes confirmadas.
- `presentation/controllers/championship-public.controller.js`: responde requests HTTP.
- `presentation/routes/championship-public.routes.js`: registra as rotas publicas GET.

Registro:

- `backend/src/server.js` monta as rotas em `/public/campeonatos` e `/api/public/campeonatos`.

## Endpoints Publicos

- `GET /api/public/campeonatos`
- `GET /api/public/campeonatos/:championshipId`
- `GET /api/public/campeonatos/:championshipId/grupos`
- `GET /api/public/campeonatos/:championshipId/equipes`
- `GET /api/public/campeonatos/:championshipId/jogos`
- `GET /api/public/campeonatos/:championshipId/classificacao`
- `GET /api/public/campeonatos/:championshipId/mata-mata`
- `GET /api/public/campeonatos/:championshipId/estatisticas`
- `GET /api/public/campeonatos/:championshipId/artilharia`

Nao existem rotas publicas `POST`, `PUT`, `PATCH` ou `DELETE`.

## Filtros e Paginacao

`GET /api/public/campeonatos` aceita:

- `page`
- `limit`
- `search`
- `category`
- `modality`
- `sortBy`: `category`, `modality`, `name`, `publishedAt`, `startDate`
- `sortDirection`: `ASC` ou `DESC`

Endpoints de colecao do detalhe aceitam `page` e `limit`, com limite maximo normalizado em 100.

## Payloads

### Lista de campeonatos

```json
{
  "items": [
    {
      "id": "camp-public",
      "name": "Copa J12",
      "description": "Copa publica",
      "category": "Sub-15",
      "modality": "Futsal",
      "status": "PUBLISHED",
      "startDate": "2026-08-01",
      "endDate": "2026-08-30",
      "publishedAt": "2026-07-10T10:00:00.000Z",
      "logo": {
        "publicUrl": "https://cdn.j12.test/copa.png",
        "mimeType": null,
        "originalName": null,
        "sizeBytes": null
      }
    }
  ],
  "limit": 20,
  "page": 1,
  "total": 1
}
```

### Equipes

```json
{
  "items": [
    {
      "registrationId": "insc-public",
      "teamId": "team-public",
      "teamName": "J12 Laranja",
      "acronym": "J12",
      "status": "CONFIRMED",
      "groupId": "grupo-a",
      "groupName": "Grupo A",
      "coach": "Treinador",
      "technicalCommission": [{ "name": "Treinador", "role": "Treinador" }]
    }
  ],
  "limit": 100,
  "page": 1,
  "total": 1
}
```

### Jogos

```json
{
  "items": [
    {
      "id": "jogo-1",
      "championshipId": "camp-public",
      "roundName": "Rodada 1",
      "matchDate": "2026-08-01",
      "startTime": "09:00",
      "status": "FINISHED",
      "home": { "teamName": "J12 Laranja", "registrationId": "insc-home", "score": 3 },
      "away": { "teamName": "Visitante", "registrationId": "insc-away", "score": 1 },
      "score": { "home": 3, "away": 1 }
    }
  ],
  "limit": 100,
  "page": 1,
  "total": 1
}
```

### Classificacao, mata-mata e estatisticas

Esses endpoints retornam snapshots publicos com equipes, posicoes, jogos, placares, rankings e
artilharia. Os DTOs removem campos internos e mantem apenas nomes, ids publicos, numeros de jogo,
placares e estatisticas publicaveis.

## Regras de Negocio

- Apenas campeonatos `PUBLISHED` e `deleted_at IS NULL` ficam acessiveis.
- Campeonatos privados, rascunho, arquivados, removidos ou inexistentes retornam `404`.
- Todo endpoint de detalhe chama `requirePublishedChampionship()` antes de consultar dados
  esportivos.
- `/equipes` lista apenas inscricoes `CONFIRMED`.
- `/grupos` remove inscricoes nao confirmadas antes de responder.
- Classificacao e estatisticas usam repositories somente leitura para evitar persistencia durante
  chamadas publicas `GET`.
- Payload publico e montado por whitelist; campos como `createdBy`, `updatedBy`, `createdAt`,
  `updatedAt`, `deletedAt`, `metadata`, `observations`, `storageKey`, `uploadedBy`, `phone`,
  `email` e documentos internos nao sao expostos.

## Fluxo de Navegacao

O frontend publico consome:

1. `GET /api/public/campeonatos` na rota `/campeonatos`.
2. `GET /api/public/campeonatos/:championshipId` na rota `/campeonatos/$championshipId`.
3. Endpoints de grupos, equipes, jogos, classificacao, mata-mata, estatisticas e artilharia para
   compor as secoes da pagina de detalhes.

Nenhuma rota administrativa `/api/admin/...` e usada pelo portal publico.

## Testes

Testes backend relevantes:

- `backend/src/domains/campeonatos/application/tests/championship-public.service.test.js`
- `backend/src/domains/campeonatos/presentation/tests/championship-public.routes.test.js`

Cobertura:

- campeonatos publicados;
- campeonatos privados;
- endpoints publicos somente leitura;
- sanitizacao de payload;
- grupos, equipes, jogos, classificacao, mata-mata, estatisticas e artilharia;
- paginacao e filtros;
- ausencia de rota publica de escrita.

## Decisoes Tecnicas

- Reuso dos services administrativos existentes para regras esportivas, evitando duplicar regra no
  portal publico.
- Repository publico dedicado para garantir filtro de publicacao e inscricoes confirmadas no acesso
  externo.
- DTOs publicos dedicados para impedir vazamento de campos administrativos.
- Rotas publicas registradas tambem com prefixo `/api` para compatibilidade com o proxy do frontend.

## Limitacoes

- Sem escrita publica.
- Sem autenticacao de torcedores/alunos.
- Sem upload de assets no portal publico.
- Sem recalculo persistente disparado por chamada publica.
