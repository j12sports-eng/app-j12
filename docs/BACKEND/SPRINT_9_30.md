# Sprint 9.30 - Protecao Fisica Contra Duplicidade De DraftEnrollment

## Objetivo

Implementar e validar uma protecao fisica no banco para impedir mais de um
`draftEnrollment` ativo para a mesma combinacao:

```text
student_person_id + student_profile_id
```

O escopo ficou restrito a migration e documentacao. Nao houve alteracao em
frontend, API publica, controllers, rotas, services, use cases, repository,
financeiro, mensalidades, turmas, legado, `/public/enrollments` ou regras de
negocio de matricula.

## Auditoria Previa

A auditoria somente leitura foi executada antes de qualquer nova acao de
migration nesta sprint:

```bash
node backend/src/database/migrations/20260629190607_add_active_draft_unique_constraint_to_enrollments.js status
```

Resultado:

```text
ENROLLMENTS_TABLE_EXISTS=true
NO_DUPLICATE_DRAFTS_FOUND=true
```

O banco auditado foi:

```text
bestt486_appj12
```

Versao reportada pelo banco:

```text
5.7.44-48 - Percona Server (GPL)
```

Nao foram encontradas duplicidades de `DRAFT` ativo.

## Schema Real Confirmado

Colunas obrigatorias confirmadas em `enrollments`:

```text
deleted_at datetime
status varchar(32)
student_person_id varchar(64)
student_profile_id varchar(64)
```

Valor real usado para draft:

```text
DRAFT
```

Chave logica protegida:

```text
status = 'DRAFT'
deleted_at IS NULL
student_person_id
student_profile_id
```

## Migration Criada

Arquivo:

```text
backend/src/database/migrations/20260629190607_add_active_draft_unique_constraint_to_enrollments.js
```

A migration e manual e idempotente:

- valida a existencia da tabela `enrollments`;
- valida tipos das colunas usadas pela constraint;
- interrompe se houver duplicidade ativa de `DRAFT`;
- cria colunas geradas apenas se ainda nao existirem;
- cria o indice unico apenas se ainda nao existir;
- possui rollback via comando `down`.

## Generated Columns

Colunas tecnicas usadas para filtrar apenas `DRAFT` ativo:

```text
active_draft_student_person_id varchar(64) VIRTUAL GENERATED
active_draft_student_profile_id varchar(64) VIRTUAL GENERATED
```

Expressoes:

```sql
CASE
  WHEN status = 'DRAFT' AND deleted_at IS NULL THEN student_person_id
  ELSE NULL
END
```

```sql
CASE
  WHEN status = 'DRAFT' AND deleted_at IS NULL THEN student_profile_id
  ELSE NULL
END
```

Observacao tecnica: a Sprint 9.29 trouxe exemplo conceitual com `STORED`.
No ambiente real MySQL/Percona 5.7.44-48, as colunas estao como
`VIRTUAL GENERATED` e foram indexadas com sucesso. Essa escolha mantem o
comportamento esperado, evita armazenar dados derivados e preserva compatibilidade
com o schema aplicado.

## Indice Unico

Indice criado/validado:

```text
ux_enrollments_active_draft_student_profile
```

Colunas do indice:

```text
active_draft_student_person_id,
active_draft_student_profile_id
```

Como MySQL permite multiplos `NULL` em indice unico, registros que nao sejam
`DRAFT` ativo nao entram na unicidade efetiva. Para `DRAFT` ativo, as duas
colunas recebem os ids reais e o banco bloqueia duplicidade fisica.

## Execucao Da Migration

Comando executado:

```bash
node backend/src/database/migrations/20260629190607_add_active_draft_unique_constraint_to_enrollments.js up
```

Resultado observado no ambiente:

```text
SKIP_COLUMN_EXISTS=active_draft_student_person_id
SKIP_COLUMN_EXISTS=active_draft_student_profile_id
SKIP_INDEX_EXISTS=ux_enrollments_active_draft_student_profile
DRAFT_UNIQUE_CONSTRAINT_CREATED=true
```

No banco auditado, os objetos fisicos ja estavam presentes no momento da
execucao. O `up` confirmou que a migration e idempotente e compativel com o
estado atual.

## Smoke Test Com Rollback

Foi executado smoke test transacional com rollback:

```bash
node sprint-9-30-smoke.tmp.cjs
```

O teste:

- abriu transacao;
- criou `people` e `person_profiles` temporarios;
- inseriu o primeiro `DRAFT`;
- tentou inserir segundo `DRAFT` para o mesmo aluno/perfil;
- confirmou bloqueio por `ER_DUP_ENTRY`;
- inseriu status nao `DRAFT`;
- validou o fluxo oficial `createDraftIfNotExists()`;
- executou rollback;
- confirmou ausencia de dados de teste.

Resultado:

```text
ENROLLMENTS_TABLE_EXISTS=true
NO_DUPLICATE_DRAFTS_FOUND=true
DRAFT_UNIQUE_CONSTRAINT_CREATED=true
FIRST_DRAFT_INSERT_ALLOWED=true
SECOND_DRAFT_INSERT_BLOCKED=true
NON_DRAFT_STATUS_ALLOWED=true
OFFICIAL_IDEMPOTENT_FLOW_STILL_WORKING=true
NO_TEST_DATA_LEFT=true
```

## Validacoes

Comandos executados:

```bash
node --check backend/src/database/migrations/20260629190607_add_active_draft_unique_constraint_to_enrollments.js
cmd /c npm run build
```

Resultados:

```text
node --check migration: aprovado
cmd /c npm run build: aprovado
Auditoria pre-migration: aprovada
Smoke test com rollback: aprovado
```

## Rollback

Rollback disponivel pela propria migration:

```bash
node backend/src/database/migrations/20260629190607_add_active_draft_unique_constraint_to_enrollments.js down
```

O rollback remove, nesta ordem:

```text
ux_enrollments_active_draft_student_profile
active_draft_student_profile_id
active_draft_student_person_id
```

Nao remove dados de negocio.

## Riscos

- A protecao depende de generated columns e indice unico suportados pelo
  MySQL/Percona do ambiente.
- A regra protege apenas `DRAFT` ativo (`deleted_at IS NULL`), conforme escopo
  da sprint.
- Outros status continuam liberados para multiplicidade conforme regras futuras
  do dominio.

## Limitacoes

- A migration nao altera regras de negocio nem substitui o fluxo idempotente
  existente; ela adiciona apenas a protecao fisica.
- A validacao foi feita no banco configurado pelo projeto no momento da sprint.
- O arquivo de smoke e temporario de validacao operacional e nao faz parte de
  runner automatico.

## Resultado

```text
ENROLLMENTS_TABLE_EXISTS=true
NO_DUPLICATE_DRAFTS_FOUND=true
DRAFT_UNIQUE_CONSTRAINT_CREATED=true
FIRST_DRAFT_INSERT_ALLOWED=true
SECOND_DRAFT_INSERT_BLOCKED=true
NON_DRAFT_STATUS_ALLOWED=true
OFFICIAL_IDEMPOTENT_FLOW_STILL_WORKING=true
NO_TEST_DATA_LEFT=true
```
