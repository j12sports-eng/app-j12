# Sprint 13.2 - Camada Application/Infrastructure do Modulo de Agenda

## Objetivo

Criar a base arquitetural backend do modulo de Agenda seguindo o padrao em
camadas usado em Matriculas, Turmas e Financeiro.

Esta sprint prepara repository, service e facade com consultas iniciais somente
leitura. Nao cria aulas, horarios persistidos, presencas, recorrencias,
cancelamentos, eventos, financeiro, notificacoes, rotas publicas, schema ou
migrations.

## Decisao tecnica

Implementacao isolada e read-only.

O baseline da Sprint 13.1 confirmou que nao existe tabela dedicada de Agenda ou
`enrollment_schedule_links`. Por isso, a Sprint 13.2 nao cria agenda real. A
camada criada deriva candidatos de agenda a partir de:

```text
enrollments ACTIVE
enrollment_class_links ACTIVE
j12_turmas.dias_semana
j12_turmas.dias_semana_json
j12_turmas.horario
j12_turmas.horario_inicio
j12_turmas.horario_fim
```

As tabelas `j12_presencas` e `student_presencas` nao foram usadas como fonte de
agenda planejada porque representam presenca/chamada e ainda possuem contratos
diferentes.

## Arquivos criados ou alterados

```text
backend/src/domains/agenda/application/repositories/agenda.repository.js
backend/src/domains/agenda/application/repositories/index.js
backend/src/domains/agenda/application/services/agenda-application.service.js
backend/src/domains/agenda/application/services/index.js
backend/src/domains/agenda/application/facades/agenda.facade.js
backend/src/domains/agenda/application/facades/index.js
backend/src/domains/agenda/application/index.js
backend/src/domains/agenda/application/tests/agenda-application.service.test.js
backend/src/domains/agenda/application/tests/agenda.facade.test.js
backend/src/domains/agenda/infrastructure/repositories/mysql-agenda.repository.js
backend/src/domains/agenda/infrastructure/repositories/index.js
backend/src/domains/agenda/infrastructure/repositories/mysql-agenda.repository.test.js
backend/src/domains/agenda/infrastructure/index.js
backend/src/domains/agenda/index.js
docs/BACKEND/SPRINT_13_2.md
```

## Padrao arquitetural adotado

```text
AgendaFacade
  -> AgendaApplicationService
      -> AgendaRepository contract
          -> MySqlAgendaRepository
              -> SELECT read-only em enrollments/enrollment_class_links/j12_turmas
```

O `backend/src/domains/agenda/index.js` passou a exportar a camada nova, mas nao
foi importado ou montado em nenhuma rota existente.

## Metodos disponiveis

Facade e service:

```js
findSchedulesByClass({ classId })
findSchedulesByStudent({ studentPersonId, studentProfileId })
findSchedulesByEnrollment({ enrollmentId })
getAgendaSummaryByStudent({ studentPersonId, studentProfileId })
```

Comportamento:

```text
classId invalido retorna lista vazia no service.
studentPersonId/studentProfileId ausentes retornam lista vazia ou resumo vazio.
enrollmentId ausente retorna lista vazia.
repository valida entradas obrigatorias e usa parametros SQL.
summary sempre declara readOnly=true, noScheduleCreated=true e noAttendanceCreated=true.
```

## Repository MySQL

Arquivo:

```text
backend/src/domains/agenda/infrastructure/repositories/mysql-agenda.repository.js
```

Consultas implementadas:

```text
SELECT_SCHEDULES_BY_CLASS_SQL
SELECT_SCHEDULES_BY_STUDENT_SQL
SELECT_SCHEDULES_BY_ENROLLMENT_SQL
```

Garantias:

```text
somente SELECT
sem INSERT
sem UPDATE
sem DELETE
sem ALTER
sem CREATE
sem DROP
sem TRUNCATE
sem escrita em j12_presencas
sem escrita em student_presencas
sem escrita em financeiro
sem notificacao
```

## Estrutura do item de agenda retornado

Cada item retornado representa um horario derivado de Turma, nao uma agenda
persistida:

```text
id sintetico: enrollment:{enrollmentId}:class:{classId} ou class:{classId}
agendaSource: j12_turmas via enrollment_class_links ACTIVE
classId
className
classStatus
daysOfWeek
startTime
endTime
enrollmentId
studentPersonId
studentProfileId
readOnly=true
scheduleCreated=false
attendanceCreated=false
persistedSchedule=false
recurrencePersisted=false
```

## Limitacoes

```text
Nao existe tabela canonica de Agenda.
Nao existe enrollment_schedule_links.
Nao ha persistencia de recorrencia.
Nao ha cancelamento de agenda.
Nao ha workflow de reposicao.
Nao ha vinculo direto Presenca -> enrollments.id.
Nao ha resolucao canonica Pessoa/Perfil -> j12_alunos.id.
Agenda deriva horarios de j12_turmas e vinculos ativos de enrollment_class_links.
```

## Seguranca e isolamento

```text
Consultas sao somente leitura.
Service nao expoe SQL.
Facade e o ponto de entrada futuro.
studentPersonId e studentProfileId sao exigidos juntos nos metodos de aluno.
findSchedulesByStudent filtra enrollments ACTIVE por pessoa/perfil.
findSchedulesByEnrollment filtra apenas enrollment ACTIVE.
Nenhuma rota publica foi criada ou alterada.
Nenhum modulo externo foi alterado para consumir Agenda.
```

## Testes criados

```text
backend/src/domains/agenda/application/tests/agenda-application.service.test.js
backend/src/domains/agenda/application/tests/agenda.facade.test.js
backend/src/domains/agenda/infrastructure/repositories/mysql-agenda.repository.test.js
```

Cenarios:

```text
entrada invalida retorna vazio sem tocar repository
service delega consultas read-only para repository
summary sem escopo retorna vazio com flags de seguranca
facade delega metodos para application service
repository usa queries parametrizadas
repository mapeia horarios de turma para item de agenda derivado
SQL constants permanecem read-only
```

## Smoke esperado

```text
AGENDA_APPLICATION_LAYER_CREATED=true
AGENDA_REPOSITORY_CREATED=true
AGENDA_FACADE_CREATED=true
FIND_SCHEDULES_BY_CLASS_ENABLED=true
FIND_SCHEDULES_BY_STUDENT_ENABLED=true
FIND_SCHEDULES_BY_ENROLLMENT_ENABLED=true
AGENDA_SUMMARY_PREPARED=true
AGENDA_QUERIES_ARE_READ_ONLY=true
NO_SCHEDULE_CREATED=true
NO_ATTENDANCE_CREATED=true
NO_SCHEMA_CHANGE=true
NO_PUBLIC_API_CHANGE=true
OFFICIAL_FLOW_STILL_WORKING=true
```

## Validacoes

```text
node --check arquivos alterados: aprovado
node --test Agenda: aprovado
cmd /c npm run build: aprovado
```

## Proximos passos para Sprint 13.3

```text
1. Definir a fonte canonica de Agenda persistida.
2. Preparar proposal/migration de enrollment_schedule_links ou tabela equivalente.
3. Definir reconciliacao entre j12_presencas e student_presencas.
4. Definir ponte segura Pessoa/Perfil/Matricula -> j12_alunos.id.
5. Modelar recorrencia, cancelamento e reposicao antes de criar rotas publicas.
6. So depois criar operacoes reais de agenda com idempotencia e transacao.
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
regras atuais de Agenda
```
