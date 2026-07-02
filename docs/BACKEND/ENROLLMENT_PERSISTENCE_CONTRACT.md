# Enrollment Persistence Contract

Contrato documental da Sprint 9.17 para a futura persistencia da tabela
`enrollments`.

Este documento nao e migration, nao altera banco e nao cria repository. Ele
define o contrato a ser usado em sprint futura.

## Decisao

A Matricula do dominio novo deve ser persistida em tabela propria:

```text
enrollments
```

Ela representa somente o Aggregate Root `Enrollment`.

Nao deve substituir, reaproveitar ou escrever em:

- `j12_alunos`;
- `j12_matriculas_publicas`;
- `j12_matricula_numeros`;
- `public_enrollments`;
- `enrollment_numbers`;
- `pre_matriculas`.

Essas estruturas sao legado, captacao, registry de numero ou pre-matricula, nao
o Aggregate Root de Matricula.

## Banco Alvo

Banco alvo para a implementacao futura:

- MySQL;
- driver atual: `mysql2/promise`;
- charset recomendado: `utf8mb4`;
- collation recomendada: `utf8mb4_unicode_ci`;
- engine recomendada: `InnoDB`.

Nao ha Prisma no projeto. O contrato nao define `schema.prisma`.

## Tabela

Nome:

```sql
enrollments
```

Responsabilidade:

- armazenar a identidade da Matricula;
- vincular a Matricula ao aluno seguro por Pessoa e Perfil;
- armazenar status do ciclo de vida da Matricula;
- armazenar datas de vigencia inicial/final;
- permitir soft delete;
- manter timestamps de auditoria tecnica.

## Campos Minimos

| Campo | Tipo MySQL | Obrigatorio | Observacao |
| --- | --- | --- | --- |
| `id` | `VARCHAR(64)` | Sim | Primary key gerada pelo dominio/repository. |
| `student_person_id` | `VARCHAR(64)` | Sim | Referencia logica e FK para `people.id`. Nunca usar `aluno.id`. |
| `student_profile_id` | `VARCHAR(64)` | Sim | Referencia logica e FK para `person_profiles.id`. Deve ser perfil `aluno`. |
| `status` | `VARCHAR(30)` | Sim | Estado canonico do dominio. Default futuro recomendado: `DRAFT`. |
| `start_date` | `DATE` | Sim | Data inicial segura da Matricula. |
| `end_date` | `DATE` | Nao | Data final quando encerrada/cancelada/finalizada. |
| `created_at` | `DATETIME` | Sim | Default `CURRENT_TIMESTAMP`. |
| `updated_at` | `DATETIME` | Sim | Default `CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`. |
| `deleted_at` | `DATETIME` | Nao | Soft delete. `NULL` significa registro ativo logicamente. |

## Chaves

Primary key:

```sql
PRIMARY KEY (id)
```

Foreign keys:

```sql
CONSTRAINT fk_enrollments_student_person
  FOREIGN KEY (student_person_id)
  REFERENCES people (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT
```

```sql
CONSTRAINT fk_enrollments_student_profile
  FOREIGN KEY (student_profile_id)
  REFERENCES person_profiles (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT
```

Justificativa:

- `student_person_id` preserva identidade civil segura.
- `student_profile_id` preserva identidade operacional do aluno.
- `ON DELETE RESTRICT` evita apagar Pessoa/Perfil ainda referenciado por
  Matricula.
- `ON UPDATE CASCADE` preserva consistencia caso ids sejam ajustados em
  operacao controlada.

## Indices

Indices minimos:

```sql
INDEX idx_enrollments_student_person (student_person_id)
```

```sql
INDEX idx_enrollments_student_profile (student_profile_id)
```

```sql
INDEX idx_enrollments_status (status)
```

Indices compostos recomendados:

```sql
INDEX idx_enrollments_student_profile_status_deleted
  (student_profile_id, status, deleted_at)
```

```sql
INDEX idx_enrollments_student_person_deleted
  (student_person_id, deleted_at)
```

Justificativa:

- consultas por Pessoa do aluno;
- consultas por Perfil de Aluno;
- filtros por status;
- filtros por registros nao deletados;
- consultas futuras do tipo "matriculas ativas ou draft por aluno".

Nao foi definido indice unico para "uma Matricula ativa por aluno" nesta
sprint. Essa regra precisa decisao de negocio e, em MySQL, pode exigir
estrategia adicional por nao haver indice parcial simples como
`WHERE deleted_at IS NULL`.

## Status

Estados canonicos documentados:

- `DRAFT`;
- `PENDING`;
- `ACTIVE`;
- `SUSPENDED`;
- `CANCELLED`;
- `FINISHED`.

Decisao de persistencia:

```sql
status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
```

Nao usar `ENUM` nesta fase.

Justificativa:

- evita lock-in de DDL para evoluir estados;
- facilita mapeamento de estados legados;
- permite validar status no dominio/application service;
- reduz risco operacional em hospedagens MySQL com diferencas de versao.

Nao criar tabela auxiliar de status nesta fase.

Justificativa:

- a cardinalidade de estados ainda e pequena;
- o dominio ja possui `EnrollmentStatus`;
- tabela auxiliar adicionaria persistencia e manutencao antes da primeira
  implementacao real.

## Soft Delete

Campo:

```sql
deleted_at DATETIME NULL
```

Regra:

- `deleted_at IS NULL`: Matricula logicamente ativa no banco.
- `deleted_at IS NOT NULL`: Matricula removida logicamente.

Repositories futuros devem:

- filtrar `deleted_at IS NULL` por padrao;
- usar soft delete em vez de `DELETE` fisico;
- preservar historico minimo para auditoria;
- permitir consultas administrativas explicitas incluindo deletados, se houver
  caso aprovado.

## Fora Do Aggregate Root Nesta Fase

A tabela `enrollments` nao deve conter nesta sprint:

- contrato;
- financeiro;
- parcelas;
- cobranca;
- turma obrigatoria;
- plano obrigatorio;
- unidade obrigatoria;
- documentos;
- snapshots civis;
- dados de Pessoa;
- dados de Responsavel;
- dados de Plano;
- dados de Turma.

## Extensoes Futuras

Campos ou tabelas auxiliares futuras podem incluir:

- `enrollment_number`;
- `responsible_relationship_id`;
- `unit_id`;
- `modality_id`;
- `class_id`;
- `schedule_id`;
- `plan_id`;
- `origin`;
- `metadata_json`;
- `idempotency_key`;
- tabelas N:N para modalidades/turmas/horarios;
- historico de status;
- vinculo com contrato;
- vinculo com financeiro.

Essas extensoes devem ser aprovadas em sprints proprias.

## SQL Proposto

Arquivo documental:

```text
docs/BACKEND/sql/proposals/create_enrollments_table.proposal.sql
```

Esse arquivo e uma proposta. Nao deve ser executado automaticamente e nao deve
ser tratado como migration ativa.

## Rollback Futuro

Rollback documental para uma migration futura:

```sql
DROP TABLE IF EXISTS enrollments;
```

Como esta sprint nao executa migration nem altera banco, nenhum rollback deve
ser executado agora.

## Regras De Implementacao Futura

Quando a persistencia for implementada:

- criar repository concreto dentro de `backend/src/domains/enrollments`;
- usar query runner injetavel;
- nao importar controller, rota, API, frontend ou modulo legado;
- nao persistir contrato/financeiro/turma/plano automaticamente;
- nao usar `aluno.id` como identidade do aluno;
- validar `student_profile_id` como perfil `aluno`;
- validar `status` contra `EnrollmentStatus`;
- manter `CreateEnrollmentUseCase` sem conhecer repository ou SQL.
