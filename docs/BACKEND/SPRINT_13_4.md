# Sprint 13.4 - Preparar geracao inicial de agenda da matricula

## Objetivo

Preparar a geracao inicial de agenda para uma matricula `ACTIVE` vinculada a
uma turma, usando o contrato criado na Sprint 13.3.

Esta sprint nao cria horarios, aulas, recorrencias, presencas, reposicoes,
financeiro, notificacoes, rotas publicas, schema ou migrations.

## Decisao tecnica

Preparacao com blockers.

A Agenda ainda nao possui schema canonico de aulas/agendamentos, vinculo
Matricula -> Agenda, status de agenda, recorrencia ou chave de idempotencia.
Por isso, a criacao real de agenda permanece bloqueada. O metodo novo prepara a
avaliacao inicial e retorna blockers controlados quando faltar estrutura segura.

## Metodo criado

```js
prepareInitialAgendaForEnrollment({
  enrollmentId,
  requestedBy,
})
```

Fluxo:

```text
AgendaFacade
  -> AgendaApplicationService.prepareInitialAgendaForEnrollment
      -> getEnrollmentAgendaSummary
          -> EnrollmentFacade
          -> ClassFacade
          -> AgendaRepository read-only
```

## Contrato retornado

```text
enrollmentId
requestedBy
classId
classIds
studentPersonId
studentProfileId
scheduleCandidates
scheduleCandidateCount
hasClassLink
hasTrustedClassSchedule
initialAgendaPrepared
canCreateAgenda=false
creationBlocked=true
agendaCreated=false
blockers
readOnly=true
noFakeScheduleCreated=true
noFakeAgendaCreated=true
noAttendanceCreated=true
noFinancialSideEffects=true
noNotificationSideEffects=true
noTestDataLeft=true
```

## Mapeamento obrigatorio

```text
Tabela real de horarios da turma:
  j12_turmas possui dias_semana, dias_semana_json, horario,
  horario_inicio e horario_fim. Esses campos sao candidatos derivados, nao uma
  tabela canonica de horarios.

Tabela real de agenda/aulas:
  nao ha tabela canonica validada para agenda inicial planejada.

Vinculo entre turma e horario:
  atualmente o horario fica embutido em j12_turmas; nao ha tabela normalizada
  turma_horarios validada.

Vinculo entre matricula e agenda:
  nao ha tabela canonica enrollment_agenda ou enrollment_schedule_links
  validada para agenda real.

Vinculo entre aluno/pessoa/perfil e agenda:
  existe derivacao via enrollments.student_person_id e
  enrollments.student_profile_id, mas nao ha vinculo direto com agenda real.

Campos de data/hora:
  existem dia da semana e horario de turma, mas nao ha data concreta de aula
  nem janela de recorrencia canonica.

Recorrencia:
  nao implementada como regra canonica da Agenda.

Status:
  nao ha status canonico de item de agenda inicial.

Idempotencia:
  nao ha chave canonica para impedir duplicidade de agenda por
  enrollmentId + classId + periodo/recorrencia.

Necessidade de migration:
  necessaria antes de qualquer criacao real de agenda.
```

## Blockers novos

```text
AGENDA_INITIAL_CLASS_LINK_REQUIRED
AGENDA_INITIAL_CLASS_SCHEDULE_NOT_TRUSTED
AGENDA_INITIAL_CREATION_SCHEMA_GAP
AGENDA_INITIAL_IDEMPOTENCY_GAP
```

Blockers herdados do contrato 13.3 continuam sendo respeitados:

```text
AGENDA_ENROLLMENT_ID_REQUIRED
AGENDA_ENROLLMENT_FACADE_UNAVAILABLE
AGENDA_ENROLLMENT_FACADE_READER_UNAVAILABLE
AGENDA_ENROLLMENT_FACADE_ERROR
AGENDA_ENROLLMENT_NOT_FOUND
AGENDA_ENROLLMENT_NOT_ACTIVE
AGENDA_ENROLLMENT_STUDENT_SCOPE_MISSING
AGENDA_ENROLLMENT_SCHEDULES_NOT_FOUND
AGENDA_CLASS_FACADE_UNAVAILABLE
AGENDA_CLASS_FACADE_READER_UNAVAILABLE
AGENDA_CLASS_FACADE_ERROR
AGENDA_CLASS_NOT_FOUND_OR_INACTIVE
AGENDA_REPOSITORY_READ_ERROR
```

## Regras garantidas

```text
Nao inventa horarios.
Nao cria agenda sem vinculo com turma.
Nao cria presenca.
Nao cria recorrencia arbitraria.
Nao gera financeiro.
Nao envia notificacao.
Nao altera API publica.
Nao altera frontend ou mobile.
Nao altera schema ou migrations.
```

## Smoke test adotado

Como a criacao real foi bloqueada por gap de schema/idempotencia, o caminho
adotado foi preparatorio:

```text
INITIAL_ENROLLMENT_AGENDA_PREPARED=true
AGENDA_CREATION_BLOCKED_BY_SCHEDULE_OR_SCHEMA_GAP=true
NO_FAKE_SCHEDULE_CREATED=true
NO_FAKE_AGENDA_CREATED=true
NO_ATTENDANCE_CREATED=true
NO_FINANCIAL_SIDE_EFFECTS=true
NO_NOTIFICATION_SIDE_EFFECTS=true
NO_TEST_DATA_LEFT=true
```

## Testes

Arquivos:

```text
backend/src/domains/agenda/application/tests/agenda-application.service.test.js
backend/src/domains/agenda/application/tests/agenda.facade.test.js
backend/src/domains/agenda/infrastructure/repositories/mysql-agenda.repository.test.js
```

Cenarios cobertos:

```text
DRAFT enrollment bloqueia antes de consultar AgendaRepository.
ACTIVE enrollment sem vinculo/horario retorna blockers.
horario de turma sem dias/startTime confiaveis bloqueia criacao.
horario confiavel prepara agenda inicial, mas bloqueia criacao por schema e idempotencia.
AgendaFacade delega prepareInitialAgendaForEnrollment.
Repository da Agenda permanece read-only.
```

## Validacoes

```text
node --check arquivos alterados: aprovado
node --test Agenda: aprovado
cmd /c npm run build: aprovado
smoke sem escrita/rollback: aprovado; nao houve escrita a reverter
```

## Proximos passos para Sprint 13.5

```text
1. Definir migration/tabela canonica de agenda planejada.
2. Definir chave idempotente para enrollmentId + classId + periodo/recorrencia.
3. Definir recorrencia real a partir dos dias/horarios da turma.
4. Definir status lifecycle da agenda.
5. Definir transacao de criacao sem criar presenca.
6. Expor leitura oficial por enrollmentId na EnrollmentFacade se ainda estiver ausente.
```

## Nao alterado

```text
frontend
mobile
API publica
Matriculas
Turmas
Financeiro
Notificacoes
legado
regras ja estabilizadas
```
