# Sprint 11.6 - Atualizacao transacional de vagas apos vinculo Matricula <-> Turma

## Objetivo

Consolidar o controle transacional de vagas depois da persistencia real do
vinculo entre uma Matricula `ACTIVE` e uma Turma.

O objetivo operacional e garantir:

```text
occupiedSlots <= capacityTotal
```

sem duplicidade, sem overbooking e sem efeitos colaterais em financeiro, agenda
ou notificacoes.

## Estrategia transacional usada

Foi implementada uma estrategia combinada:

```text
SELECT ... FOR UPDATE na linha de j12_turmas
contador derivado de enrollment_class_links
rechecagem de ocupacao dentro da mesma transacao
rollback em erro
```

O lock acontece quando o fluxo real usa o runner transacional de Matriculas
criado na Sprint 11.5. A `ClassFacade` recebe:

```js
{
  classId,
  lockForUpdate: true,
  occupancySource: "enrollment_class_links",
}
```

## Como ocupacao e calculada

O caminho legado de consulta de capacidade continua existindo:

```text
j12_turmas.capacidade + j12_alunos.turma_id/j12_alunos.turma_principal
```

Para o fluxo transacional Matricula -> Turma, a ocupacao passa a ser derivada
dos vinculos ativos:

```text
j12_turmas.capacidade + enrollment_class_links ACTIVE
```

Consulta usada pelo repository de Turmas:

```text
COUNT(DISTINCT enrollment_class_links.enrollment_id)
WHERE class_id = j12_turmas.id
  AND status = 'ACTIVE'
  AND unlinked_at IS NULL
```

## Como overbooking e impedido

Fluxo do vinculo real:

```text
1. abre transacao
2. busca Matricula e valida ACTIVE
3. verifica se ja existe vinculo ativo para enrollmentId + classId
4. se existir, reutiliza o vinculo e revalida ocupacao
5. se nao existir, valida vaga via ClassFacade com lockForUpdate
6. cria enrollment_class_links
7. revalida occupiedSlots <= capacityTotal via ClassFacade na mesma transacao
8. commit
9. rollback em erro
```

O preenchimento da ultima vaga e permitido. A rechecagem bloqueia somente quando:

```text
occupiedSlots > capacityTotal
```

## Idempotencia

A idempotencia permanece em duas camadas:

```text
findActiveByEnrollmentAndClass antes da escrita
ux_enrollment_class_links_active(enrollment_id, class_id, status)
```

Se o vinculo ja existir, ele e reutilizado. O fluxo nao cria novo registro e nao
falha somente porque a turma esta cheia exatamente com aquele vinculo ja ativo.

## Arquivos tecnicos

```text
backend/src/domains/classes/application/services/class-application.service.js
backend/src/domains/classes/application/facades/class.facade.js
backend/src/domains/classes/infrastructure/repositories/mysql-class.repository.js
backend/src/domains/enrollments/application/services/enrollment-class-link.service.js
backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment-class-link.transaction-runner.js
```

## Smoke test

Marcadores do caminho real implementado:

```text
CLASS_CAPACITY_TRANSACTION_ENABLED=true
CLASS_CAPACITY_RECHECKED_INSIDE_TRANSACTION=true
FULL_CLASS_LINK_BLOCKED=true
LAST_SLOT_CONCURRENCY_HANDLED=true
DUPLICATE_LINK_REUSED_OR_BLOCKED=true
OCCUPIED_SLOTS_CONSISTENT=true
NO_FINANCIAL_SIDE_EFFECTS=true
NO_SCHEDULE_SIDE_EFFECTS=true
NO_NOTIFICATION_SIDE_EFFECTS=true
NO_TEST_DATA_LEFT=true
```

## Validacoes executadas

```bash
node --check backend/src/domains/enrollments/application/services/enrollment-class-link.service.js
node --check backend/src/domains/classes/application/services/class-application.service.js
node --check backend/src/domains/classes/application/facades/class.facade.js
node --check backend/src/domains/classes/application/repositories/class.repository.js
node --check backend/src/domains/classes/infrastructure/repositories/mysql-class.repository.js
node --check backend/src/domains/classes/infrastructure/repositories/mysql-class.repository.test.js
node --check backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment-class-link.transaction-runner.js
node --check backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment-class-link.transaction-runner.test.js
node --test backend/src/domains/enrollments/application/tests/*.test.js backend/src/domains/enrollments/infrastructure/repositories/*.test.js backend/src/domains/classes/application/tests/*.test.js backend/src/domains/classes/infrastructure/repositories/*.test.js
cmd /c npm run build
```

## Bloqueios e limites

- A estrategia depende de o runtime injetar `ClassFacade` com repository de
  Turmas usando o mesmo `queryRunner` transacional.
- Nao foi criada coluna, tabela ou migration nova.
- Dados legados de `j12_alunos` nao sao atualizados neste fluxo.
- Agenda, financeiro e notificacoes continuam fora do vinculo.
- A ocupacao transacional considera `enrollment_class_links`, nao a turma
  principal legada do aluno.

## Proximos passos

- Ligar a composicao runtime oficial do fluxo administrativo usando o runner
  transacional e `ClassFacade`.
- Definir em sprint futura se o modulo de Turmas deve exibir ocupacao por
  `enrollment_class_links`, por `j12_alunos` ou por uma visao conciliada.
