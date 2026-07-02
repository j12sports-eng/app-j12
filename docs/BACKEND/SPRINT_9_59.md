# Sprint 9.59 - Performance e Otimizacao do Dominio de Matriculas

## Objetivo

Auditar a performance do dominio de Matriculas com foco nas queries reais do
repository, indices existentes, status consolidado, dashboard operacional e
integracoes futuras, sem alterar comportamento, schema, API publica ou frontend.

## Escopo executado

Foi realizada auditoria somente leitura no banco configurado.

Comandos conceituais executados:

```sql
SHOW INDEX FROM enrollments;

SELECT COLUMN_NAME, EXTRA, GENERATION_EXPRESSION
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'enrollments'
  AND COLUMN_NAME IN (
    'active_draft_student_person_id',
    'active_draft_student_profile_id'
  );

SELECT status, COUNT(*) AS total
FROM enrollments
GROUP BY status
ORDER BY status;

SELECT COUNT(*) AS total
FROM enrollments
WHERE confirmed_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY);
```

Tambem foram executados `EXPLAIN` nas queries principais do
`MySqlEnrollmentRepository`.

Observacao operacional:

```text
a primeira tentativa de auditoria foi bloqueada pelo sandbox por EACCES no MySQL externo
a auditoria foi repetida com permissao e usou somente SELECT/SHOW/EXPLAIN
nenhum dado foi inserido, atualizado ou removido
```

## Estado da tabela auditada

```text
enrollments: existe
total por status: vazio
confirmadas nos ultimos 30 dias: 0
cardinalidade reportada pelos indices: 0
```

A tabela estava vazia no momento da auditoria. Por isso, os planos de execucao
servem para validar uso estrutural de indices, mas nao comprovam gargalo real
em volume de producao.

## Queries analisadas

### Busca por id

Repository:

```sql
SELECT *
FROM enrollments
WHERE id = ?
LIMIT 1
```

Uso:

```text
findById()
confirmDraftEnrollment()
servicos preparatorios de Financeiro/Agenda/Notificacoes
```

Resultado:

```text
EXPLAIN: no matching row in const table
indice esperado: PRIMARY(id)
risco: baixo
```

### Busca DRAFT por aluno/perfil

Repository:

```sql
SELECT *
FROM enrollments
WHERE status = ?
  AND deleted_at IS NULL
  AND student_person_id = ?
  AND student_profile_id = ?
ORDER BY created_at DESC, id DESC
LIMIT 1
```

Resultado observado:

```text
key: idx_enrollments_student_person_id
rows: 1
Extra: Using index condition; Using where; Using filesort
```

Leitura:

```text
usa indice por student_person_id
filtra status, deleted_at e student_profile_id depois
faz filesort para created_at/id
```

### Busca ACTIVE por aluno/perfil

Repository:

```sql
SELECT *
FROM enrollments
WHERE status = ?
  AND deleted_at IS NULL
  AND student_person_id = ?
  AND student_profile_id = ?
ORDER BY confirmed_at DESC, updated_at DESC, created_at DESC, id DESC
LIMIT 1
```

Resultado observado:

```text
key: idx_enrollments_student_person_id
rows: 1
Extra: Using index condition; Using where; Using filesort
```

Leitura:

```text
usa indice por student_person_id
confirmed_at nao possui indice dedicado
filesort pode virar gargalo futuro se houver muitos registros por aluno/perfil
```

### Busca DRAFT por student_person_id

Repository:

```sql
SELECT *
FROM enrollments
WHERE status = ?
  AND deleted_at IS NULL
  AND student_person_id = ?
ORDER BY created_at DESC, id DESC
LIMIT 1
```

Resultado observado:

```text
key: idx_enrollments_student_person_id
rows: 1
Extra: Using index condition; Using where; Using filesort
```

### Busca DRAFT por student_profile_id

Repository:

```sql
SELECT *
FROM enrollments
WHERE status = ?
  AND deleted_at IS NULL
  AND student_profile_id = ?
ORDER BY created_at DESC, id DESC
LIMIT 1
```

Resultado observado:

```text
key: idx_enrollments_student_profile_id
rows: 1
Extra: Using index condition; Using where; Using filesort
```

### Auditoria de duplicidade DRAFT

Migration/status:

```sql
SELECT student_person_id, student_profile_id
FROM enrollments
WHERE status = 'DRAFT'
  AND deleted_at IS NULL
GROUP BY student_person_id, student_profile_id
HAVING COUNT(*) > 1
```

Resultado observado:

```text
key: idx_enrollments_status
rows: 1
Extra: Using index condition; Using where; Using temporary; Using filesort
```

Leitura:

```text
nao e fluxo runtime frequente
aceitavel como verificacao de migration/status
deve continuar fora de paths transacionais de usuario
```

## Indices existentes

```text
PRIMARY(id)
ux_enrollments_active_draft_student_profile(active_draft_student_person_id, active_draft_student_profile_id)
idx_enrollments_student_person_id(student_person_id)
idx_enrollments_student_profile_id(student_profile_id)
idx_enrollments_status(status)
idx_enrollments_deleted_at(deleted_at)
idx_enrollments_student_status(student_person_id, status)
```

## Generated columns e constraint fisica DRAFT

Colunas geradas encontradas:

```text
active_draft_student_person_id
  VIRTUAL GENERATED
  CASE WHEN status = 'DRAFT' AND deleted_at IS NULL THEN student_person_id ELSE NULL END

active_draft_student_profile_id
  VIRTUAL GENERATED
  CASE WHEN status = 'DRAFT' AND deleted_at IS NULL THEN student_profile_id ELSE NULL END
```

Unique index:

```text
ux_enrollments_active_draft_student_profile(
  active_draft_student_person_id,
  active_draft_student_profile_id
)
```

Decisao:

```text
constraint fisica de DRAFT continua adequada
nenhuma alteracao foi feita nesse indice
```

## Facade e chamadas duplicadas

Pontos mapeados:

```text
findCurrentDraftEnrollment -> 1 query DRAFT
findCurrentActiveEnrollment -> 1 query ACTIVE
getEnrollmentStatusSummary -> 2 queries paralelas: DRAFT + ACTIVE
ensureNoActiveEnrollment -> 1 query ACTIVE
confirmDraftEnrollment -> findById + ensureNoActiveEnrollment + updateStatus + findById pos-update
createDraftIfNotExists -> lock + busca DRAFT + insert quando necessario + findById pos-insert
```

Leitura:

```text
nao ha N+1 no dominio atual porque as operacoes trabalham em um unico escopo aluno/perfil
getEnrollmentStatusSummary faz duas queries por design para detectar CONFLICT
as duas queries rodam em Promise.all e nao foram encontradas chamadas em loop/listagem no dominio
confirmacao executa multiplas queries, mas cada uma preserva regra de concorrencia e resultado atual
```

Nao foi feita otimizacao de codigo porque reduzir queries neste momento poderia
alterar semantica de conflito, idempotencia ou auditoria pos-update sem
evidencia de gargalo real.

## Dashboard operacional

Estado atual:

```text
dashboard operacional e contrato preparatorio
nao existe query agregada real
nao existe rota HTTP dedicada ao dashboard
nao ha N+1 relacionado ao dashboard no runtime atual
```

Risco futuro:

```text
metricas por confirmed_at precisam de filtro de data obrigatorio
confirmed_at nao possui indice dedicado
enrollments nao possui unit_id/tenant_id para escopo multi-unidade
totalConflict deve ser query agregada unica, nao loop chamando status summary
```

## Gargalos encontrados

Gargalos potenciais, nao comprovados por volume:

```text
Using filesort nas buscas DRAFT/ACTIVE por aluno/perfil por causa dos ORDER BY
confirmed_at sem indice para metricas futuras de confirmacao por periodo
query de duplicidade DRAFT usa temporary/filesort, mas esta restrita a auditoria/migration
status consolidado usa duas queries por escopo; aceitavel hoje, mas nao deve ser usado em loop de lista
```

Nao houve gargalo comprovado:

```text
tabela vazia
rows estimado = 1 nos EXPLAIN principais
nenhum endpoint de listagem operacional em massa no dominio de Matriculas
dashboard ainda sem query real
```

## Decisao tecnica

Auditoria/documentacao apenas.

Nao foi criada migration.

Nao foi aplicada otimizacao de codigo.

Motivos:

```text
sem volume real nao ha evidencia para novo indice
novo indice em tabela transacional deve considerar lock, cardinalidade e rollback
as queries atuais tem LIMIT 1 e filtros por aluno/perfil/status
os filesorts observados sao potenciais, nao gargalo medido
nao ha dashboard real nem listagens sem paginacao no dominio
```

## Recomendacoes futuras

Quando houver volume real de producao:

```text
rodar EXPLAIN ANALYZE ou metricas equivalentes com dados reais
avaliar indice composto para DRAFT:
  (student_person_id, student_profile_id, status, deleted_at, created_at)
avaliar indice composto para ACTIVE:
  (student_person_id, student_profile_id, status, deleted_at, confirmed_at)
avaliar indice para dashboard por periodo:
  (status, deleted_at, confirmed_at)
incluir unit_id/tenant_id antes de dashboard multi-unidade real
evitar usar getEnrollmentStatusSummary em loops de listagem
implementar dashboard com query agregada unica e filtros obrigatorios
```

Cache:

```text
nao recomendado agora
so considerar cache para dashboard agregado futuro
cache exigira politica clara de invalidacao em DRAFT_CREATED, DRAFT_CONFIRMED, cancelamentos e soft delete
```

## Validacoes

```text
node --check arquivos JS alterados: nao aplicavel; apenas documentacao foi criada
cmd /c npm run build: aprovado
node --test backend/src/domains/enrollments/application/tests/*.test.js: aprovado
smoke test somente leitura: aprovado
```

## Smoke test

Caminho adotado: auditoria/documentacao apenas.

```text
ENROLLMENT_PERFORMANCE_AUDIT_COMPLETED=true
ENROLLMENT_INDEXES_REVIEWED=true
MAIN_QUERIES_EXPLAINED=true
NO_N_PLUS_ONE_FOUND_OR_DOCUMENTED=true
DASHBOARD_PERFORMANCE_REVIEWED=true
NO_SCHEMA_CHANGE=true
NO_BEHAVIOR_CHANGE=true
OFFICIAL_FLOW_STILL_WORKING=true
NO_TEST_DATA_LEFT=true
```

## Nao alterado

```text
frontend
API publica
regras de negocio
financeiro
mensalidades
turmas
agenda
notificacoes
app mobile
legado
fluxo publico de criacao de aluno
confirmacao de matricula
constraint fisica de DRAFT
schema/migrations
```
