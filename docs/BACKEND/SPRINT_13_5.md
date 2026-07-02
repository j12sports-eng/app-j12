# Sprint 13.5 - Persistencia inicial da Agenda da Matricula

## Objetivo

Concluir a criacao inicial de Agenda para uma Matricula `ACTIVE` vinculada a
Turma, removendo os blockers de schema/idempotencia documentados na Sprint 13.4.

## Entrega

```text
enrollment_agenda_items
```

A tabela guarda itens planejados de Agenda derivados do horario real da Turma,
sem criar presenca, financeiro, notificacao ou rota publica.

## Arquitetura

```text
AgendaFacade
  -> AgendaApplicationService
      -> AgendaRepository
          -> MySqlAgendaRepository
```

Para validar Matricula e Turma, Agenda usa facades injetadas:

```text
EnrollmentFacade
ClassFacade
```

A `EnrollmentFacade` expoe `findEnrollmentById()` como leitura oficial por id,
sem vazar repository para outros dominios.

## Idempotencia

Chave logica persistida:

```text
enrollmentId + classId + weekly + dayOfWeek + startTime + endTime
```

Tentativas repetidas reutilizam ou bloqueiam duplicidade pelo indice unico de
`idempotency_key`.

## Garantias

```text
ACTIVE Enrollment required=true
ACTIVE Enrollment -> Turma link required=true
Class schedule fields required=true
NO_ATTENDANCE_CREATED=true
NO_FINANCIAL_SIDE_EFFECTS=true
NO_NOTIFICATION_SIDE_EFFECTS=true
NO_PUBLIC_API_CHANGE=true
NO_TEST_DATA_LEFT=true
```

## Arquivos principais

```text
backend/src/database/migrations/20260702133000_create_enrollment_agenda_items_table.js
backend/src/domains/agenda/application/services/agenda-application.service.js
backend/src/domains/agenda/infrastructure/repositories/mysql-agenda.repository.js
backend/src/domains/enrollments/application/facades/enrollment.facade.js
sprint-13-5-smoke.tmp.cjs
```

## Proximos passos para Sprint 13.6

```text
1. Melhorar o painel financeiro administrativo removendo a dependencia manual
   de ids tecnicos para buscar aluno.
2. Reutilizar contrato administrativo existente de Matriculas quando possivel.
3. Manter controllers financeiros chamando somente FinancialFacade.
```
