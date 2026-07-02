# Sprint 9.24 - Executar Migration Enrollments Em Ambiente Controlado

## Objetivo

Executar manualmente a migration da tabela `enrollments` em ambiente controlado
e validar a estrutura criada antes de qualquer integracao de persistencia ao
fluxo de Matricula.

## Ambiente

Ambiente configurado pelo projeto via `.env` e `backend/.env`:

```text
DB_HOST=108.167.168.27
DB_PORT=3306
DB_NAME=bestt486_appj12
DB_USER=bestt486_appj12
```

Nenhuma credencial sensivel foi documentada.

## Migration Executada

Arquivo:

```text
backend/src/database/migrations/20260629134546_create_enrollments_table.sql
```

Foi executado somente o bloco `-- UP`:

```sql
CREATE TABLE IF NOT EXISTS enrollments (...)
```

Comando utilizado:

```bash
cmd /c node -e "<script que le o arquivo versionado, extrai o bloco -- UP e executa via backend/src/config/db.js>"
```

Resultado:

```text
SPRINT_9_24_MIGRATION_UP_OK={"warningStatus":0,"affectedRows":0}
```

Nenhum `-- DOWN` foi executado e nenhum dado real de Matricula foi criado.

## Precheck

Antes da execucao, foi feita validacao somente leitura:

```text
enrollments=false
people=true
person_profiles=true
```

As colunas referenciadas existiam e eram compativeis:

```text
people.id VARCHAR(64) PRIMARY KEY
person_profiles.id VARCHAR(64) PRIMARY KEY
```

## Validacao Da Tabela

Smoke test somente leitura:

```text
ENROLLMENTS_TABLE_EXISTS=true
```

Tabela validada:

```text
TABLE_NAME=enrollments
ENGINE=InnoDB
CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci
```

Colunas confirmadas:

- `id`;
- `student_person_id`;
- `student_profile_id`;
- `status`;
- `start_date`;
- `end_date`;
- `created_at`;
- `updated_at`;
- `deleted_at`.

## Validacao Das FKs

FKs confirmadas:

- `fk_enrollments_student_person`: `student_person_id -> people.id`;
- `fk_enrollments_student_profile`: `student_profile_id -> person_profiles.id`.

Regras confirmadas:

- `ON UPDATE CASCADE`;
- `ON DELETE RESTRICT`.

## Validacao Dos Indices

Indices confirmados:

- `PRIMARY`;
- `idx_enrollments_student_person_id`;
- `idx_enrollments_student_profile_id`;
- `idx_enrollments_status`;
- `idx_enrollments_deleted_at`;
- `idx_enrollments_student_status`.

## Itens Nao Alterados

Nao houve alteracao em:

- repository;
- services;
- UseCases;
- controllers;
- rotas;
- APIs;
- frontend;
- legado;
- `/public/enrollments`.

Tambem nao houve integracao de persistencia nesta sprint.

## Auditoria

Executado:

```bash
npm run build
```

`node --check` nao foi necessario porque nenhum JS foi alterado nesta sprint.

Confirmado:

- migration executada manualmente;
- tabela `enrollments` existe;
- FKs existem;
- indices existem;
- engine/collation/charset conferidos;
- nenhum dado real de Matricula criado;
- nenhuma funcionalidade de backend/frontend alterada.

## Proximos Passos

1. Reexecutar a verificacao `tableExists("enrollments")` antes da Sprint 9.25.
2. Integrar persistencia ao orquestrador somente em sprint propria.
3. Validar estrategia de consistencia entre Pessoa, Perfil, Relacionamento e
   Matricula antes de ligar o fluxo real.
4. Manter `CreateEnrollmentUseCase` sem conhecer repository concreto.
