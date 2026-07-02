# Sprint 9.29 - Auditoria De Duplicidade E Preparacao Para Constraint Fisica De DraftEnrollment

## Objetivo

Auditar a tabela `enrollments` e os caminhos de criacao de
`draftEnrollment` para preparar uma protecao fisica futura contra duplicidade.

Esta sprint nao alterou schema, migrations, indices, constraints, repository,
services, use cases, controllers, rotas, API publica, frontend, financeiro,
mensalidades, turmas ou legado.

## Metodologia

A auditoria combinou:

- leitura do fluxo de aplicacao;
- busca de caminhos de criacao e leitura de `draftEnrollment`;
- consultas somente leitura no MySQL remoto;
- revisao dos indices e FKs existentes via `information_schema`.

O script usado para a auditoria foi temporario, executou somente `SELECT` e
consultas em `information_schema`, e foi removido apos a execucao.

## Caminhos Encontrados

### Criacao Persistida

Fluxo principal encontrado:

```text
backend/src/domains/pessoas/application/services/enrollment-application.service.js
  createDraftEnrollmentAndPersist()
  createOrReusePersistedDraftEnrollment()
    EnrollmentDomainApplicationService.createDraftEnrollmentIdempotently()
      MySqlEnrollmentRepository.createDraftIfNotExists()
```

O caminho persistido oficial passa por:

```text
backend/src/domains/enrollments/application/services/enrollment-application.service.js
backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment.repository.js
```

### Leitura E Reutilizacao

O repository busca draft ativo com:

```sql
WHERE status = 'DRAFT'
  AND deleted_at IS NULL
  AND student_person_id = ?
  AND student_profile_id = ?
```

Se o draft existir, `createDraftIfNotExists()` reutiliza o registro.

### Fallback

Se a persistencia falhar, o orquestrador de `pessoas` cria um draft em memoria,
retorna warning e nao reporta persistencia concluida. Esse fallback nao grava
em `enrollments` e, portanto, nao cria duplicidade fisica.

## Consultas Somente Leitura Executadas

As consultas abaixo foram executadas somente para leitura:

```sql
SELECT DATABASE() AS databaseName;
```

```sql
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'enrollments'
ORDER BY ORDINAL_POSITION;
```

```sql
SELECT INDEX_NAME, NON_UNIQUE,
       GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS columns
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = 'enrollments'
GROUP BY INDEX_NAME, NON_UNIQUE
ORDER BY INDEX_NAME;
```

```sql
SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
FROM information_schema.key_column_usage
WHERE table_schema = DATABASE()
  AND table_name = 'enrollments'
  AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY CONSTRAINT_NAME, ORDINAL_POSITION;
```

```sql
SELECT COUNT(*) AS total
FROM enrollments;
```

```sql
SELECT status, COUNT(*) AS total
FROM enrollments
GROUP BY status
ORDER BY status;
```

```sql
SELECT COUNT(*) AS total
FROM enrollments
WHERE status = 'DRAFT'
  AND deleted_at IS NULL;
```

```sql
SELECT student_person_id, student_profile_id, COUNT(*) AS total,
       MIN(created_at) AS first_created_at,
       MAX(created_at) AS last_created_at
FROM enrollments
WHERE status = 'DRAFT'
  AND deleted_at IS NULL
GROUP BY student_person_id, student_profile_id
HAVING COUNT(*) > 1
ORDER BY total DESC, last_created_at DESC
LIMIT 50;
```

```sql
SELECT student_person_id, COUNT(*) AS total
FROM enrollments
WHERE status = 'DRAFT'
  AND deleted_at IS NULL
GROUP BY student_person_id
HAVING COUNT(*) > 1
ORDER BY total DESC
LIMIT 50;
```

```sql
SELECT student_profile_id, COUNT(*) AS total
FROM enrollments
WHERE status = 'DRAFT'
  AND deleted_at IS NULL
GROUP BY student_profile_id
HAVING COUNT(*) > 1
ORDER BY total DESC
LIMIT 50;
```

```sql
SELECT
  SUM(CASE WHEN student_person_id IS NULL OR student_person_id = '' THEN 1 ELSE 0 END) AS missing_student_person_id,
  SUM(CASE WHEN student_profile_id IS NULL OR student_profile_id = '' THEN 1 ELSE 0 END) AS missing_student_profile_id,
  SUM(CASE WHEN start_date IS NULL THEN 1 ELSE 0 END) AS missing_start_date
FROM enrollments
WHERE status = 'DRAFT'
  AND deleted_at IS NULL;
```

```sql
SELECT COUNT(*) AS total
FROM enrollments e
LEFT JOIN people p ON p.id = e.student_person_id
WHERE e.deleted_at IS NULL
  AND e.student_person_id IS NOT NULL
  AND p.id IS NULL;
```

```sql
SELECT COUNT(*) AS total
FROM enrollments e
LEFT JOIN person_profiles pp ON pp.id = e.student_profile_id
WHERE e.deleted_at IS NULL
  AND e.student_profile_id IS NOT NULL
  AND pp.id IS NULL;
```

## Resultados Obtidos

Banco auditado:

```text
bestt486_appj12
```

Tabela:

```text
enrollments: existe
people: existe
person_profiles: existe
```

Colunas encontradas em `enrollments`:

```text
id varchar(64) NOT NULL PRIMARY KEY
student_person_id varchar(64) NOT NULL
student_profile_id varchar(64) NOT NULL
status varchar(32) NOT NULL
start_date date NOT NULL
end_date date NULL
created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
deleted_at datetime NULL
```

Indices existentes:

```text
PRIMARY (id) UNIQUE
idx_enrollments_deleted_at (deleted_at)
idx_enrollments_status (status)
idx_enrollments_student_person_id (student_person_id)
idx_enrollments_student_profile_id (student_profile_id)
idx_enrollments_student_status (student_person_id,status)
```

Foreign keys existentes:

```text
fk_enrollments_student_person: student_person_id -> people.id
fk_enrollments_student_profile: student_profile_id -> person_profiles.id
```

Dados atuais:

```text
total de enrollments: 0
drafts ativos: 0
duplicidades por student_person_id + student_profile_id: 0
duplicidades por student_person_id: 0
duplicidades por student_profile_id: 0
orfandade em people: 0
orfandade em person_profiles: 0
```

Como a tabela esta vazia, nao ha saneamento previo obrigatorio neste momento.

## Chave Logica Do Draft

A identidade logica de um `draftEnrollment` ativo e:

```text
student_person_id + student_profile_id + status DRAFT + deleted_at IS NULL
```

O campo `start_date` pertence ao draft, mas nao deve fazer parte da identidade
logica inicial. Incluir `start_date` permitiria multiplos drafts ativos para o
mesmo aluno/perfil em datas diferentes, contrariando o comportamento atual de
reutilizacao.

## Risco Atual De Duplicidade

Risco atual: baixo no fluxo oficial, mas nao nulo no nivel fisico.

Motivos:

- o fluxo oficial usa `createDraftIfNotExists()`;
- a criacao esta protegida por `GET_LOCK()` e `RELEASE_LOCK()`;
- a leitura acontece dentro do lock;
- nao ha duplicidades nos dados atuais;
- ainda nao existe constraint ou indice unico fisico na tabela.

Um insert manual, script externo ou caminho futuro que use `repository.create()`
diretamente ainda poderia criar duplicidade fisica se nao passar pelo caminho
idempotente.

## Estados E Multiplicidade

Estados previstos pelo dominio:

```text
DRAFT
PENDING
ACTIVE
SUSPENDED
CANCELLED
FINISHED
```

A constraint futura deve mirar somente `DRAFT` ativo (`deleted_at IS NULL`).
Estados historicos, finalizados, cancelados ou soft-deletados podem exigir
regras diferentes e nao devem ser bloqueados pela mesma constraint neste
momento.

## Proposta De Constraint Futura

MySQL nao oferece partial unique index simples no mesmo formato de PostgreSQL.
Um indice unico direto em:

```text
student_person_id, student_profile_id, status, deleted_at
```

nao e suficiente, porque MySQL permite multiplas linhas com `NULL` em coluna de
indice unico. Como `deleted_at IS NULL` representa o registro ativo, isso nao
bloquearia duplicidades de drafts ativos com seguranca.

Proposta recomendada para a Sprint 9.30:

1. confirmar versao MySQL e suporte a generated columns/functional indexes;
2. executar auditoria pre-migration novamente;
3. criar generated columns tecnicas que so tenham valor para draft ativo;
4. criar indice unico sobre essas generated columns.

Exemplo conceitual, nao executado nesta sprint:

```sql
ALTER TABLE enrollments
  ADD COLUMN active_draft_student_person_id VARCHAR(64)
    GENERATED ALWAYS AS (
      CASE
        WHEN status = 'DRAFT' AND deleted_at IS NULL THEN student_person_id
        ELSE NULL
      END
    ) STORED,
  ADD COLUMN active_draft_student_profile_id VARCHAR(64)
    GENERATED ALWAYS AS (
      CASE
        WHEN status = 'DRAFT' AND deleted_at IS NULL THEN student_profile_id
        ELSE NULL
      END
    ) STORED,
  ADD UNIQUE INDEX ux_enrollments_active_draft_student_profile (
    active_draft_student_person_id,
    active_draft_student_profile_id
  );
```

Essa abordagem permite multiplos registros nao ativos porque MySQL aceita
multiplos `NULL` em indice unico, mas bloqueia mais de um `DRAFT` ativo para a
mesma combinacao `student_person_id + student_profile_id`.

## Plano Seguro De Implantacao

Antes da Sprint 9.30:

1. repetir as consultas de duplicidade em producao/homologacao;
2. bloquear a migration se houver duplicidades;
3. confirmar versao MySQL e suporte ao recurso escolhido;
4. criar migration com rollback claro;
5. testar insert duplicado em ambiente controlado;
6. garantir que o fluxo oficial continue usando `createDraftIfNotExists()`.

Rollback futuro conceitual:

```sql
ALTER TABLE enrollments
  DROP INDEX ux_enrollments_active_draft_student_profile,
  DROP COLUMN active_draft_student_person_id,
  DROP COLUMN active_draft_student_profile_id;
```

Este rollback nao foi executado nesta sprint porque nenhuma migration foi
criada ou aplicada.

## Limitacoes

- A tabela estava vazia no momento da auditoria, entao nao houve validacao em
  massa real de dados historicos.
- A constraint futura depende da versao e recursos do MySQL disponiveis no
  ambiente.
- O fluxo oficial esta protegido por lock, mas a ausencia de constraint ainda
  permite duplicidade por acessos externos ou uso indevido de `create()`.

## Validacoes

Resultados da auditoria somente leitura:

```text
ENROLLMENTS_DUPLICATE_AUDIT_READY=true
NO_DUPLICATE_DRAFTS_FOUND=true
UNIQUE_DRAFT_CONSTRAINT_PLAN_DOCUMENTED=true
NO_SCHEMA_CHANGE=true
READ_ONLY_AUDIT_COMPLETED=true
```

Validacoes tecnicas:

```bash
node --check backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment.repository.js
cmd /c npm run build
```

Resultado: aprovado ao final da sprint.
