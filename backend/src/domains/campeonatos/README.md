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

## Fora do escopo

Upload definitivo de logo/escudo, CRUD de equipes, CRUD especifico de comissao tecnica, atletas, jogos, tabelas, mata-mata, sumulas, estatisticas, classificacao e portal publico serao tratados nas proximas sprints.

## Rotas

Base: `/admin/campeonatos` e `/api/admin/campeonatos`.

- `GET /`
- `GET /:id`
- `POST /`
- `POST /:id/publish`
- `POST /:id/archive`
- `PUT /:id`
- `DELETE /:id`

## Persistencia

O projeto atual usa MySQL direto via `backend/src/config/db.js`. A tabela `j12_campeonatos` e criada de forma idempotente pelo repository para manter compatibilidade com o padrao vigente.
