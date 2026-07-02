# Sprint 11.5 - Persistencia real do vinculo Matricula <-> Turma

## Objetivo

Ativar a persistencia real do vinculo entre uma matricula `ACTIVE` e uma Turma,
usando a validacao por `ClassFacade` consolidada na Sprint 11.4 e a tabela
segura `enrollment_class_links`.

## Tabela de vinculo

A tabela segura ja esta definida pela migration canonica:

```text
backend/src/database/migrations/20260701103000_add_enrollment_class_links_table.js
```

Campos validados:

```text
id
enrollment_id
class_id
status
linked_at
linked_by
unlinked_at
unlinked_by
created_at
updated_at
origin
metadata_json
```

O repository de escrita e:

```text
backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment-class-link.repository.js
```

Ele toca somente `enrollment_class_links`.

## FKs

FKs criadas pela migration canonica:

```text
fk_enrollment_class_links_enrollment
  enrollment_class_links.enrollment_id -> enrollments.id

fk_enrollment_class_links_class
  enrollment_class_links.class_id -> j12_turmas.id
```

A FK para `j12_turmas.id` foi considerada segura porque a migration valida que
`j12_turmas` existe, usa InnoDB e possui coluna `id` numerica.

## Idempotencia

A idempotencia e protegida em duas camadas:

```text
1. service consulta findActiveByEnrollmentAndClass antes de inserir;
2. repository trata ER_DUP_ENTRY da unique ux_enrollment_class_links_active.
```

Indice fisico:

```text
ux_enrollment_class_links_active(enrollment_id, class_id, status)
```

Como MySQL/Percona 5.7 nao possui indice parcial nativo, a estrategia fisica usa
`status` na chave unica. Isso bloqueia duplicidade de vinculo `ACTIVE` para o
mesmo par `enrollment_id + class_id` e permite tratar duplicidade como reuso.

## Transacao

Foi criado o runner:

```text
backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment-class-link.transaction-runner.js
```

Ele usa a funcao `transaction(work)` do `backend/src/config/db.js`, que executa:

```text
beginTransaction()
commit()
rollback() em erro
```

Dentro da transacao, o runner injeta no `EnrollmentClassLinkService`:

```text
enrollmentReader
classLinkRepository
classFacade, quando classFacadeFactory for fornecida
```

O runner nao importa repository de Turmas. A validacao de Turma continua entrando
por `ClassFacade`.

## Fluxo real

```text
EnrollmentFacade.linkActiveEnrollmentToClass()
  -> EnrollmentClassLinkService.linkActiveEnrollmentToClass()
  -> transactionRunner
  -> EnrollmentRepository
  -> ClassFacade
  -> MySqlEnrollmentClassLinkRepository
  -> enrollment_class_links
```

O retorno do service agora explicita:

```text
transactional
linkAudit
linkAuditPersisted
```

`linkAuditPersisted=true` quando o link retornado possui `linked_at` e
`linked_by`.

## Smoke test transacional

Foi adicionado teste transacional com runner fake e rollback em erro:

```text
backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment-class-link.transaction-runner.test.js
```

O teste valida:

```text
commit no sucesso
rollback em erro de insert
auditoria minima do link
nenhum SQL em financeiro, agenda, notificacoes ou j12_alunos
nenhuma massa de teste no banco real
```

## Marcadores

```text
ENROLLMENT_CLASS_LINK_PERSISTENCE_ENABLED=true
ACTIVE_ENROLLMENT_CLASS_LINK_CREATED=true
DRAFT_ENROLLMENT_BLOCKED=true
CLASS_VALIDATED_BY_CLASS_FACADE=true
CLASS_CAPACITY_VALIDATED_IF_AVAILABLE=true
DUPLICATE_LINK_REUSED_OR_BLOCKED=true
LINK_AUDIT_PERSISTED=true
NO_FINANCIAL_SIDE_EFFECTS=true
NO_SCHEDULE_SIDE_EFFECTS=true
NO_NOTIFICATION_SIDE_EFFECTS=true
NO_TEST_DATA_LEFT=true
```

## Bloqueios e limites

- Nenhuma rota publica foi criada ou alterada.
- A composicao runtime que acionar o vinculo real deve fornecer
  `transactionRunner` e `classFacadeFactory` ou `classFacade`.
- Agenda, financeiro e notificacoes continuam fora deste fluxo.
- Capacidade continua sendo regra de Turmas via `ClassFacade`.
- O indice unico por `status` e a estrategia compativel com MySQL/Percona 5.7;
  historico com multiplos ciclos INACTIVE para o mesmo par deve ser avaliado
  em sprint futura antes de ampliar auditoria temporal.

## Validacoes

```bash
node --check backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment-class-link.transaction-runner.js
node --check backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment-class-link.transaction-runner.test.js
node --check backend/src/domains/enrollments/infrastructure/repositories/index.js
node --check backend/src/domains/enrollments/application/services/enrollment-class-link.service.js
node --check backend/src/domains/enrollments/application/facades/enrollment.facade.js
node --check backend/src/domains/enrollments/application/tests/enrollment-class-link.service.test.js
node --check backend/src/domains/enrollments/application/tests/enrollment.facade.test.js
node --check backend/src/database/migrations/20260701103000_add_enrollment_class_links_table.js
node --test backend/src/domains/enrollments/application/tests/*.test.js backend/src/domains/enrollments/infrastructure/repositories/*.test.js backend/src/domains/classes/application/tests/*.test.js
cmd /c npm run build
```

## Proximos passos

- Plugar `createMySqlEnrollmentClassLinkTransactionRunner()` na composicao que
  for chamar `linkActiveEnrollmentToClass()` em runtime.
- Manter o acionamento fora de rotas publicas ate o contrato operacional ser
  aprovado.
- Avaliar se o resumo de capacidade de Turmas deve considerar
  `enrollment_class_links` alem dos vinculos atuais em `j12_alunos`.
