# Sprint 17.12 - Campeonatos Portal Publico

## Objetivo

Implementar a Fase A do Portal Publico de Campeonatos no backend, sem iniciar frontend.

O escopo entrega uma API publica, somente leitura, para consumo do portal de campeonatos da J12.

## Endpoints publicos

Base:

- `/public/campeonatos`
- `/api/public/campeonatos`

Rotas implementadas:

- `GET /api/public/campeonatos`
- `GET /api/public/campeonatos/:championshipId`
- `GET /api/public/campeonatos/:championshipId/grupos`
- `GET /api/public/campeonatos/:championshipId/equipes`
- `GET /api/public/campeonatos/:championshipId/jogos`
- `GET /api/public/campeonatos/:championshipId/classificacao`
- `GET /api/public/campeonatos/:championshipId/mata-mata`
- `GET /api/public/campeonatos/:championshipId/estatisticas`
- `GET /api/public/campeonatos/:championshipId/artilharia`

Nao foram criados endpoints `POST`, `PUT`, `PATCH` ou `DELETE` no namespace publico.

## Arquitetura

### Application

Arquivos adicionados:

- `backend/src/domains/campeonatos/application/services/championship-public.service.js`
- `backend/src/domains/campeonatos/application/validators/championship-public.validators.js`
- `backend/src/domains/campeonatos/application/repositories/championship-public.repository.js`

O `ChampionshipPublicService` e a camada que:

- valida a entrada publica;
- exige que o campeonato esteja publicado antes de buscar dados esportivos;
- reutiliza services administrativos de grupos, jogos, classificacao, mata-mata e estatisticas;
- aplica DTOs publicos para sanitizar a resposta.

### Infrastructure

Arquivo adicionado:

- `backend/src/domains/campeonatos/infrastructure/repositories/mysql-championship-public.repository.js`

O repository publico:

- lista apenas campeonatos `PUBLISHED`;
- detalha apenas campeonato `PUBLISHED`;
- lista equipes apenas de inscricoes `CONFIRMED`;
- filtra registros removidos com `deleted_at IS NULL`;
- nao retorna observacoes internas, metadados administrativos, usuarios de auditoria ou documentos.

### Presentation

Arquivos adicionados:

- `backend/src/domains/campeonatos/presentation/controllers/championship-public.controller.js`
- `backend/src/domains/campeonatos/presentation/routes/championship-public.routes.js`

As rotas publicas sao registradas em:

- `backend/src/server.js`

## Seguranca

Regras implementadas:

- campeonato privado, rascunho, arquivado, removido ou inexistente retorna `404`;
- todos os endpoints validam publicacao pelo repository publico antes de chamar services esportivos;
- payload publico e montado por whitelist nos DTOs;
- campos administrativos como `createdBy`, `updatedBy`, `createdAt`, `updatedAt`, `deletedAt`,
  `metadata`, `observations`, `storageKey`, `uploadedBy` e equivalentes nao sao expostos;
- equipes pendentes, recusadas ou canceladas nao aparecem em `/equipes`;
- grupos publicos removem inscricoes nao confirmadas antes de montar a resposta;
- endpoints publicos sao somente leitura no contrato HTTP.

Para classificacao e estatisticas, a factory publica usa services administrativos com repositories
de persistencia em modo somente leitura, evitando persistir recalculos durante chamadas `GET`.

## Testes

Testes adicionados:

- `backend/src/domains/campeonatos/application/tests/championship-public.service.test.js`
- `backend/src/domains/campeonatos/presentation/tests/championship-public.routes.test.js`

Coberturas:

- campeonatos publicados;
- campeonatos privados;
- grupos;
- equipes;
- jogos;
- classificacao;
- mata-mata;
- estatisticas;
- artilharia;
- paginacao;
- sanitizacao do payload;
- ausencia de rota publica de escrita.

## Exports

Foram revisados e atualizados:

- `backend/src/domains/campeonatos/application/dtos/index.js`
- `backend/src/domains/campeonatos/application/repositories/index.js`
- `backend/src/domains/campeonatos/application/services/index.js`
- `backend/src/domains/campeonatos/application/validators/index.js`
- `backend/src/domains/campeonatos/infrastructure/repositories/index.js`
- `backend/src/domains/campeonatos/presentation/controllers/index.js`
- `backend/src/domains/campeonatos/presentation/routes/index.js`
- `backend/src/domains/campeonatos/shared/constants/championship.constants.js`

## Fora do escopo

- Frontend do portal publico.
- Autenticacao de torcedores/alunos.
- Endpoints de escrita publica.
- Upload de assets.
- Fase B do Portal Publico.
