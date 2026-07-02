# Sprint 9.20 - Create Enrollments Table Migration

## Objetivo

Criar a migration SQL versionada da tabela `enrollments`, seguindo o padrao
oficial definido na Sprint 9.19, sem executar SQL e sem integrar persistencia ao
fluxo atual.

## Migration Criada

Caminho:

```text
backend/src/database/migrations/20260629134546_create_enrollments_table.sql
```

O arquivo segue:

- pasta oficial `backend/src/database/migrations/`;
- nome `YYYYMMDDHHMMSS_create_enrollments_table.sql`;
- secoes `-- UP` e `-- DOWN`;
- execucao manual e controlada.

## Estrutura Da Tabela

Tabela:

```text
enrollments
```

Campos:

- `id VARCHAR(64) NOT NULL`;
- `student_person_id VARCHAR(64) NOT NULL`;
- `student_profile_id VARCHAR(64) NOT NULL`;
- `status VARCHAR(32) NOT NULL`;
- `start_date DATE NOT NULL`;
- `end_date DATE NULL`;
- `created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`;
- `updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`;
- `deleted_at DATETIME NULL`;
- `PRIMARY KEY (id)`.

Foi mantido o padrao MySQL ja usado no projeto:

```sql
ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## Foreign Keys

Definidas:

- `fk_enrollments_student_person`: `student_person_id -> people.id`;
- `fk_enrollments_student_profile`: `student_profile_id -> person_profiles.id`.

As FKs usam:

- `ON UPDATE CASCADE`;
- `ON DELETE RESTRICT`.

Isso preserva o contrato documentado na Sprint 9.17 para impedir remocao fisica
de Pessoa ou Perfil ainda referenciados por Matricula.

## Indices

Definidos:

- `idx_enrollments_student_person_id (student_person_id)`;
- `idx_enrollments_student_profile_id (student_profile_id)`;
- `idx_enrollments_status (status)`;
- `idx_enrollments_deleted_at (deleted_at)`;
- `idx_enrollments_student_status (student_person_id, status)`.

## Rollback

Rollback documentado na secao `-- DOWN` da migration:

```sql
DROP TABLE IF EXISTS enrollments;
```

Esse rollback nao foi executado nesta sprint.

## Confirmacao De Nao Execucao

Esta sprint criou apenas o arquivo SQL da migration.

Confirmado:

- SQL nao foi executado;
- nenhuma tabela foi criada;
- nenhum dado foi persistido;
- nenhum repository foi criado;
- nenhum service de persistencia foi criado;
- nenhuma integracao com o fluxo atual foi criada;
- nenhum endpoint, controller, rota, API ou frontend foi alterado;
- nenhum legado foi alterado;
- `/public/enrollments` nao foi alterado.

## Auditoria

Validacoes executadas:

```bash
npm run build
```

Resultado:

- `npm run build`: aprovado.
- `node --check`: nao aplicavel, nenhum JS foi criado ou alterado.
- Migration contem `-- UP`.
- Migration contem `-- DOWN`.
- Migration existe no caminho oficial.

## Proximos Passos

1. Revisar a migration em code review.
2. Aplicar manualmente em homologacao quando houver aprovacao operacional.
3. Validar FKs contra `people.id` e `person_profiles.id` no banco alvo.
4. Aplicar em producao somente com backup e registro de execucao.
5. Criar repository de `Enrollment` em sprint posterior, sem misturar com a
   execucao desta migration.
