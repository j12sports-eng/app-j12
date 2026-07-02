# Sprint 9.18 - Enrollments SQL Migration

Status: bloqueada por padrao de migrations indefinido.

## Objetivo

Criar uma migration SQL ativa para a futura tabela `enrollments`, baseada no
contrato validado na Sprint 9.17.

Esta sprint nao deveria executar SQL automaticamente, criar repository,
integrar fluxo, endpoint, controller, rota, API, frontend, contrato,
financeiro, turma, plano ou alterar legado.

## Resultado

A migration nao foi criada nesta execucao.

Motivo: o padrao de pasta de migrations do projeto ainda nao esta claro.

Evidencias encontradas:

- `docs/BANCO/MIGRACOES.md` declara que nao ha ferramenta de migration
  versionada detectada.
- `docs/BANCO/MIGRACOES.md` lista como etapa futura "Criar pasta de migrations
  versionada".
- `docs/ARQUITETURA/PADROES_BACKEND.md` cita o padrao alvo
  `backend/src/database/migrations/`.
- O pedido da Sprint 9.18 cita `backend/database/migrations/`.
- Nenhuma das pastas `backend/database/migrations/` ou
  `backend/src/database/migrations/` existe no workspace.
- O unico SQL backend existente fora de propostas/documentos e
  `backend/sql/schema.sql`, usado como schema legado, nao como migration
  versionada.

Pela regra da sprint, quando o padrao de migrations nao estiver claro, a
execucao deve parar e o impedimento deve ser documentado. Portanto, nao foi
criada uma migration fora de um padrao aprovado.

## Migration Planejada

Quando o padrao de migrations for aprovado, a migration devera criar:

```sql
CREATE TABLE IF NOT EXISTS enrollments
```

Campos previstos:

- `id VARCHAR(64) PRIMARY KEY`;
- `student_person_id VARCHAR(64) NOT NULL`;
- `student_profile_id VARCHAR(64) NOT NULL`;
- `status VARCHAR(32) NOT NULL`;
- `start_date DATE NOT NULL`;
- `end_date DATE NULL`;
- `created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`;
- `updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`;
- `deleted_at DATETIME NULL`.

Foreign keys previstas:

- `student_person_id -> people.id`;
- `student_profile_id -> person_profiles.id`.

Indices previstos:

- `idx_enrollments_student_person_id`;
- `idx_enrollments_student_profile_id`;
- `idx_enrollments_status`;
- `idx_enrollments_deleted_at`;
- `idx_enrollments_student_status`.

Rollback previsto:

```sql
DROP TABLE IF EXISTS enrollments;
```

## Confirmacoes De Escopo

- Nenhum SQL foi executado.
- Nenhum dado foi persistido.
- Nenhuma migration ativa foi criada.
- Nenhum repository concreto foi criado.
- Nenhum Prisma, adapter ou service de persistencia foi criado.
- Nenhuma integracao com o fluxo atual foi criada.
- Nenhum endpoint, controller, rota, API ou frontend foi alterado.
- Nenhum EventBus, contrato, financeiro, turma ou plano foi criado.
- Nenhum modulo legado foi alterado.
- `/public/enrollments` nao foi alterado.

## Auditoria Executada

Comandos de auditoria:

```bash
rg --files | rg "(^|/|\\)(migrations?|database|sql)(/|\\)|\\.sql$)"
rg -n "migration|migrations|CREATE TABLE IF NOT EXISTS|DROP TABLE IF EXISTS" backend docs package.json scripts
npm run build
```

Resultado:

- `npm run build`: aprovado.
- `node --check`: nao aplicavel, nenhum JS foi criado ou alterado.
- Busca confirmou ausencia de pasta de migrations versionada ativa.
- Busca confirmou ausencia de migration `enrollments` criada.

## Proximos Passos

1. Aprovar explicitamente a pasta oficial de migrations.
2. Escolher entre `backend/database/migrations/` e
   `backend/src/database/migrations/`, ou documentar outro caminho oficial.
3. Criar a migration `create_enrollments_table.sql` no caminho aprovado.
4. Manter a migration sem execucao automatica ate uma sprint propria de
   aplicacao em banco.
