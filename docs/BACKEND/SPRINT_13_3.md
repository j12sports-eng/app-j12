# Sprint 13.3 - Contrato Agenda, Turmas e Matriculas

## Objetivo

Preparar o contrato oficial de integracao entre Agenda, Turmas e Matriculas
para consultar um resumo de agenda de uma matricula ativa sem criar horarios,
aulas, recorrencias, presencas, reposicoes ou eventos.

## Decisao tecnica

A Sprint 13.3 foi implementada como contrato preparado e read-only.

O fluxo desejado foi preservado dentro da Agenda:

```text
AgendaFacade
  -> AgendaApplicationService
      -> EnrollmentFacade
      -> ClassFacade
      -> AgendaRepository
```

A integracao real ainda nao foi marcada como habilitada porque a facade real de
Matriculas (`EnrollmentFacade`) nao expoe um metodo oficial de leitura por
`enrollmentId`. A Agenda nao acessa repositories ou services internos de outro
dominio diretamente; por isso, quando essa leitura nao existe, o contrato
retorna blocker controlado.

## Contrato criado

Metodo novo em service e facade:

```js
getEnrollmentAgendaSummary({ enrollmentId })
```

Formato retornado:

```js
{
  enrollmentId,
  classId,
  studentPersonId,
  studentProfileId,
  schedules: [],
  hasSchedule,
  blockers
}
```

Campos adicionais de seguranca retornados pelo contrato:

```text
readOnly=true
noScheduleCreated=true
noAttendanceCreated=true
noFinancialSideEffects=true
noNotificationSideEffects=true
usesEnrollmentFacade
usesClassFacade
```

## Facades utilizadas

```text
EnrollmentFacade
ClassFacade
AgendaFacade
```

Regras adotadas:

```text
Agenda recebe EnrollmentFacade e ClassFacade por injecao.
Agenda nao importa repository de Matriculas.
Agenda nao importa repository de Turmas.
AgendaRepository continua restrito a consultas read-only da Agenda.
Agenda so consulta AgendaRepository apos validar a matricula como ACTIVE pela facade.
Agenda valida turmas retornadas usando ClassFacade quando houver classId em schedules.
```

## Fluxo preparado

```text
1. Validar enrollmentId.
2. Resolver matricula pela EnrollmentFacade.
3. Exigir status ACTIVE.
4. Exigir studentPersonId e studentProfileId.
5. Consultar candidatos de agenda pelo AgendaRepository.
6. Validar turmas retornadas pela ClassFacade.
7. Retornar schedules derivados e blockers, sem escrita.
```

## Blockers documentados

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

Blocker real principal nesta sprint:

```text
AGENDA_ENROLLMENT_FACADE_READER_UNAVAILABLE
```

Motivo:

```text
EnrollmentFacade ainda nao possui metodo oficial findEnrollmentById ou
getEnrollmentById para consulta por matricula. A service interna de Matriculas
possui leitura por id, mas a Agenda nao deve atravessar a facade do dominio.
```

## Smoke test adotado

Como a leitura oficial por `enrollmentId` ainda nao esta exposta na
`EnrollmentFacade`, o caminho adotado foi preparatorio:

```text
AGENDA_ENROLLMENT_CONTRACT_PREPARED=true
AGENDA_CONTRACT_DOCUMENTED=true
AGENDA_BLOCKERS_RETURNED=true
AGENDA_SUMMARY_IS_READ_ONLY=true
NO_SCHEDULE_CREATED=true
NO_ATTENDANCE_CREATED=true
NO_SCHEMA_CHANGE=true
OFFICIAL_FLOW_STILL_WORKING=true
```

## Garantias de nao escrita

```text
Nenhum horario criado.
Nenhuma aula criada.
Nenhuma recorrencia criada.
Nenhuma presenca criada.
Nenhuma reposicao criada.
Nenhum evento criado.
Nenhuma rota publica criada ou alterada.
Nenhuma migration criada ou alterada.
Nenhum schema criado ou alterado.
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
entrada invalida retorna blocker sem tocar repository.
EnrollmentFacade ausente retorna blocker controlado.
EnrollmentFacade sem leitor por id retorna blocker preparatorio.
matricula nao ACTIVE interrompe antes do AgendaRepository.
facades injetadas permitem summary read-only com turma validada.
AgendaFacade delega o novo metodo para a application service.
AgendaFacade repassa EnrollmentFacade e ClassFacade para a service padrao.
```

## Validacoes

```text
node --check arquivos alterados: aprovado
node --test Agenda: aprovado
cmd /c npm run build: aprovado
```

## Proximos passos para Sprint 13.4

```text
1. Expor leitura oficial por enrollmentId na EnrollmentFacade, sem vazar repository.
2. Definir a tabela canonica de horarios da Agenda ou confirmar derivacao por Turma.
3. Definir idempotencia para criacao real de horarios.
4. Definir transacao entre Matricula ACTIVE, Turma e Agenda.
5. Separar criacao de horario de qualquer criacao de presenca.
6. Modelar recorrencia, cancelamento e reposicao antes de rota publica.
```

## Nao alterado

```text
frontend
mobile
API publica
schema
migrations
Matriculas
Turmas
Financeiro
Notificacoes
legado
```
