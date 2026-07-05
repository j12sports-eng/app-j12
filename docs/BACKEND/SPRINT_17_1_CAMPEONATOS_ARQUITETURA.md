# Sprint 17.1 - Arquitetura do Modulo Campeonatos

## Objetivo

Criar apenas a infraestrutura backend do modulo Campeonatos, sem implementar equipes, atletas, jogos, tabelas, mata-mata, sumulas, estatisticas, classificacao ou portal publico.

## Estrutura criada

- `backend/src/domains/campeonatos/application`
  - `dtos`
  - `repositories`
  - `services`
  - `validators`
- `backend/src/domains/campeonatos/domain`
  - `entities`
- `backend/src/domains/campeonatos/infrastructure`
  - `repositories`
- `backend/src/domains/campeonatos/presentation`
  - `controllers`
  - `routes`
  - `tests`
- `backend/src/domains/campeonatos/shared`
  - `constants`
  - `enums`
  - `utils`

## Entidades base

- `Championship`
- `Category`
- `Phase`
- `Round`

As entidades sao estruturas base para as proximas sprints e nao carregam regras esportivas complexas.

## Repository

Contrato:

- `ChampionshipRepository`

Implementacao:

- `MySqlChampionshipRepository`

Tabela criada de forma idempotente:

- `j12_campeonatos`

## Service

`ChampionshipApplicationService` expoe apenas operacoes basicas:

- `create`
- `update`
- `remove`
- `findById`
- `findAll`
- `publish`
- `archive`

## Validacoes

Validador administrativo cobre:

- nome obrigatorio
- categoria obrigatoria
- modalidade obrigatoria
- data inicial
- data final
- status
- consistencia basica entre data inicial e final

## Rotas

Base:

- `/admin/campeonatos`
- `/api/admin/campeonatos`

Endpoints:

- `GET /admin/campeonatos`
- `GET /admin/campeonatos/:id`
- `POST /admin/campeonatos`
- `PUT /admin/campeonatos/:id`
- `DELETE /admin/campeonatos/:id`

As rotas usam `requireAuth` e `canManageSystem`, seguindo Agenda, Financeiro, Quadras e Notificacoes.

## Fora do escopo

- Equipes
- Atletas
- Jogos
- Tabelas
- Mata-mata
- Sumulas
- Estatisticas
- Classificacao
- Portal publico

## Observacao tecnica

O projeto atual nao possui Prisma ativo no runtime. Para preservar a arquitetura vigente, a Sprint 17.1 usa Express + MySQL direto via `backend/src/config/db.js`.
