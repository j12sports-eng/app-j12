# Sprint 10.7 - Agenda Inicial a partir de Matricula ACTIVE vinculada a Turma

## Objetivo

Preparar a criacao inicial de agenda do aluno a partir de uma matricula `ACTIVE` vinculada a uma turma.

## Mapeamento de Agenda

- Tabela encontrada: `j12_presencas`.
- Uso atual: registro de presenca/aula por `aluno_id`, `turma_id`, `data_aula` e `status`.
- Estrutura ausente para esta sprint: tabela canonica de agenda por matricula, recorrencia, janela de vigencia, cancelamentos, reposicoes e idempotencia por `enrollmentId`.
- Dominio dedicado `backend/src/domains/agenda` nao foi encontrado como boundary seguro para delegacao.

## Mapeamento de horarios de Turmas

- Fonte atual de horarios: `j12_turmas`.
- Campos mapeados: `dias_semana`, `dias_semana_json`, `horario`, `horario_inicio`, `horario_fim`.
- O vinculo real com Turma vem de `enrollment_class_links`.
- A leitura de turma fica dependente de `classReader` injetado; o service de Matriculas nao acessa SQL de Turmas diretamente.

## Decisao tecnica

Contrato/documentacao preparatoria.

Nao foi criada agenda real porque o schema atual nao possui uma tabela segura de agenda vinculada a matricula nem regra consolidada de recorrencia/cancelamento/reposicao. Criar linhas em `j12_presencas` nesta sprint inventaria agenda a partir de uma tabela de presenca, o que violaria a regra de nao criar horarios ou recorrencia arbitraria.

## Fluxo preparado

```text
EnrollmentFacade.createInitialScheduleForEnrollment()
        -> EnrollmentScheduleService.createInitialScheduleForEnrollment()
        -> enrollmentReader
        -> classLinkReader
        -> classReader
        -> contrato no-write
```

Validacoes aplicadas:

- matricula existe;
- matricula esta `ACTIVE`;
- existe vinculo ativo com a turma;
- horarios da turma sao localizados por leitor injetado;
- quando horarios nao existem, o fluxo bloqueia de forma controlada;
- nenhuma agenda, presenca, financeiro ou notificacao real e criada.

## Idempotencia

O contrato retorna chave estavel:

```text
enrollment:<enrollmentId>:class:<classId>:initial-schedule
```

Como nao ha escrita real, chamadas repetidas retornam a mesma chave e permanecem seguras para retry.

## Smoke tests

```text
ENROLLMENT_SCHEDULE_PREPARED=true
AGENDA_MODULE_MAPPED=true
CLASS_SCHEDULE_MAPPED=true
SCHEDULE_CREATION_BLOCKED_BY_SCHEMA_OR_RULE_GAP=true
NO_FAKE_SCHEDULE_CREATED=true
NO_SCHEDULE_CREATED=true
NO_FINANCIAL_SIDE_EFFECTS=true
NO_NOTIFICATION_SIDE_EFFECTS=true
NO_TEST_DATA_LEFT=true
```

## Validacoes executadas

```bash
node --check backend/src/domains/enrollments/application/services/enrollment-schedule.service.js
node --check backend/src/domains/enrollments/application/facades/enrollment.facade.js
node --check backend/src/domains/enrollments/application/tests/enrollment-schedule.service.test.js
node --check backend/src/domains/enrollments/application/tests/enrollment.facade.test.js
node --test backend/src/domains/enrollments/application/tests/*.test.js
cmd /c npm run build
```

## Bloqueios

- Falta tabela dedicada de agenda por matricula.
- Falta regra de recorrencia e vigencia por matricula/turma.
- Falta vinculo entre agenda e `enrollmentId`.
- `j12_presencas` nao e agenda inicial; e superficie de presenca/aula.

## Proximos passos

- Definir tabela ou dominio canonico de Agenda.
- Criar migracao de vinculo `enrollment_schedule_links`, se o fluxo for persistido.
- Definir recorrencia, janela inicial/final, cancelamentos e reposicoes.
