# Sprint 9.17 - Enrollment Persistence Contract

Esta sprint define o contrato documental de persistencia da futura tabela
`enrollments`.

Nao foi executada migration, SQL ou alteracao real no banco.

## Objetivo

Produzir o contrato tecnico que permitira implementar a persistencia da
Matricula em sprint futura sem reutilizar estruturas inseguras do legado.

## Contexto

A Sprint 9.16 concluiu que nao existe tabela definitiva para o Aggregate Root
`Enrollment`.

Estruturas encontradas e rejeitadas como base principal:

- `j12_alunos`;
- `j12_matriculas_publicas`;
- `j12_matricula_numeros`;
- `public_enrollments`;
- `enrollment_numbers`;
- `pre_matriculas`.

Essas tabelas continuam sendo legado, captacao, registry de numero ou
pre-matricula.

## Entregas

Arquivos criados:

```text
docs/BACKEND/ENROLLMENT_PERSISTENCE_CONTRACT.md
docs/BACKEND/SPRINT_9_17.md
docs/BACKEND/sql/proposals/create_enrollments_table.proposal.sql
```

O arquivo SQL e proposta documental. Ele nao e migration ativa.

## Contrato Da Tabela

Tabela definida:

```text
enrollments
```

Campos minimos obrigatorios:

- `id`;
- `student_person_id`;
- `student_profile_id`;
- `status`;
- `start_date`;
- `end_date`;
- `created_at`;
- `updated_at`;
- `deleted_at`.

## Tipos Definidos

Tipos MySQL definidos no contrato:

- `id VARCHAR(64)`;
- `student_person_id VARCHAR(64)`;
- `student_profile_id VARCHAR(64)`;
- `status VARCHAR(30)`;
- `start_date DATE`;
- `end_date DATE NULL`;
- `created_at DATETIME`;
- `updated_at DATETIME`;
- `deleted_at DATETIME NULL`.

Engine/collation sugeridos:

- `ENGINE=InnoDB`;
- `DEFAULT CHARSET=utf8mb4`;
- `COLLATE=utf8mb4_unicode_ci`.

## Chaves E Indices

Primary key:

- `PRIMARY KEY (id)`.

Foreign keys propostas:

- `student_person_id -> people.id`;
- `student_profile_id -> person_profiles.id`.

Indices propostos:

- `idx_enrollments_student_person`;
- `idx_enrollments_student_profile`;
- `idx_enrollments_status`;
- `idx_enrollments_student_profile_status_deleted`;
- `idx_enrollments_student_person_deleted`;
- `idx_enrollments_deleted_at`.

Nenhum indice unico para Matricula ativa por aluno foi definido nesta sprint.
Essa regra ainda precisa decisao de negocio e estrategia tecnica em MySQL.

## Status

Estados mapeados:

- `DRAFT`;
- `PENDING`;
- `ACTIVE`;
- `SUSPENDED`;
- `CANCELLED`;
- `FINISHED`.

Decisao:

```sql
status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
```

Motivo:

- evita lock-in de `ENUM`;
- facilita evolucao do dominio;
- permite compatibilidade futura com status legados;
- deixa a validacao no dominio/application service.

## Soft Delete

Soft delete definido por:

```sql
deleted_at DATETIME NULL
```

Regra futura:

- `deleted_at IS NULL`: registro ativo logicamente;
- `deleted_at IS NOT NULL`: registro removido logicamente;
- repository futuro deve filtrar registros deletados por padrao.

## Fora Do Escopo

Nao foi criado nem integrado:

- migration ativa;
- alteracao real no banco;
- Prisma;
- repository concreto;
- adapter;
- service de persistencia;
- integracao com fluxo atual;
- endpoint;
- controller;
- rota;
- API;
- frontend;
- EventBus;
- contrato;
- financeiro;
- turma;
- plano;
- alteracao em legado.

## Rollback Futuro

Rollback documental para uma migration futura:

```sql
DROP TABLE IF EXISTS enrollments;
```

Nenhum rollback foi executado nesta sprint porque nenhuma migration foi
executada.

## Auditoria

Resultado esperado e executado nesta sprint:

- nenhum JS criado ou alterado;
- `node --check` nao se aplica;
- nenhum banco alterado;
- nenhuma migration criada;
- nenhum SQL executado;
- nenhum repository concreto criado;
- nenhum endpoint, controller, rota, API ou frontend alterado;
- nenhum legado alterado;
- build executado ao final da sprint.

## Proximos Passos

Sprint futura deve implementar, somente apos aprovacao explicita:

- mapper `Enrollment <-> enrollments`;
- repository concreto do dominio `enrollments`;
- validacao de status contra `EnrollmentStatus`;
- smoke test de persistencia com query runner injetavel;
- integracao controlada com o fluxo atual, ainda sem contrato/financeiro.
