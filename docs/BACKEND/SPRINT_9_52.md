# Sprint 9.52 - Integracao de Matriculas com Agenda

## Objetivo

Preparar a integracao interna entre o dominio de Matriculas (`enrollments`) e
Agenda, permitindo validar uma matricula `ACTIVE` antes de planejar um vinculo
futuro de agenda/horarios do aluno.

Esta sprint nao cria agenda real, presenca, recorrencia, financeiro ou
notificacao.

## Mapeamento do Modulo Agenda

Fronteira de dominio reservada:

```text
backend/src/domains/agenda/index.js
backend/src/domains/agenda/README.md
```

Estado encontrado:

```text
Agenda ainda nao tem service/repository/controller proprio de dominio.
Agenda atual e derivada de Turmas, Alunos, Aulas Experimentais e Presencas.
Nao ha endpoint backend dedicado de Agenda.
```

Arquivos operacionais relacionados:

```text
backend/src/routes/turmas.routes.js
backend/src/routes/presencas.routes.js
backend/src/config/db.js
backend/src/services/presencas.service.ts
src/routes/agenda.tsx
src/routes/portal-aluno/agenda.tsx
src/routes/portal-responsavel/agenda.tsx
src/lib/turmas-store.ts
src/lib/trial-classes-store.ts
```

Tabelas e campos mapeados:

```text
j12_turmas.id
j12_turmas.dias_semana
j12_turmas.dias_semana_json
j12_turmas.horario
j12_turmas.horario_inicio
j12_turmas.horario_fim
j12_turmas.status
j12_turmas.aluno_ids_json
j12_turmas.presencas_json
student_presencas.aluno_id
student_presencas.turma
student_presencas.data_aula
student_presencas.presente
```

Nao foi encontrada tabela dedicada para relacionar:

```text
enrollments.id <-> agenda do aluno
enrollments.id <-> j12_turmas.id <-> recorrencia de agenda
```

Tambem nao foi encontrado padrao de idempotencia por `enrollmentId` para
agenda/horarios.

## Decisao Tecnica

Contrato/documentacao preparatoria.

Nao foi implementada agenda real porque Agenda ainda nao possui fonte unica de
dominio, service/repository confiavel, tabela de agenda por matricula ou vinculo
seguro com `enrollments.id`.

Persistir agora exigiria derivar horarios diretamente de `j12_turmas` e gravar
em estruturas de presenca/legado sem garantir:

```text
idempotencia por matricula
unicidade de agenda ativa por enrollment/turma
historico de recorrencia
cancelamento/reposicao
auditoria de origem
rollback isolado
separacao entre agenda, presenca, financeiro e notificacoes
```

## Implementacao

Arquivos de aplicacao ajustados:

```text
backend/src/domains/enrollments/application/contracts/enrollment-schedule.contract.js
backend/src/domains/enrollments/application/contracts/index.js
backend/src/domains/enrollments/application/services/enrollment-schedule.service.js
backend/src/domains/enrollments/application/services/index.js
backend/src/domains/enrollments/application/facades/enrollment.facade.js
```

Novo metodo interno exposto pela facade:

```js
prepareEnrollmentScheduleLink({
  enrollmentId,
  studentPersonId,
  studentProfileId,
  classId,
  requestedBy,
  classStatus,
  classSchedule,
  metadata,
})
```

O service:

```text
valida enrollmentId e requestedBy
consulta a matricula persistida por id
bloqueia matricula inexistente
bloqueia status diferente de ACTIVE
valida classId numerico compativel com j12_turmas.id
confere studentPersonId/studentProfileId quando informados
retorna contrato preparatorio
nao chama Agenda
nao cria agenda
nao cria presenca
nao gera financeiro
nao envia notificacao
```

Erros controlados adicionados:

```text
ENROLLMENT_SCHEDULE_LINK_INPUT_REQUIRED
ENROLLMENT_SCHEDULE_LINK_INVALID_CLASS_ID
ENROLLMENT_SCHEDULE_LINK_INVALID_CLASS_STATUS
ENROLLMENT_SCHEDULE_LINK_INVALID_ENROLLMENT_STATUS
ENROLLMENT_SCHEDULE_PREPARATION_INPUT_REQUIRED
ENROLLMENT_SCHEDULE_PREPARATION_ENROLLMENT_NOT_FOUND
ENROLLMENT_SCHEDULE_PREPARATION_INVALID_ENROLLMENT_STATUS
ENROLLMENT_SCHEDULE_PREPARATION_STUDENT_LINK_MISSING
ENROLLMENT_SCHEDULE_PREPARATION_STUDENT_MISMATCH
```

## Contrato Criado

Arquivo:

```text
backend/src/domains/enrollments/application/contracts/enrollment-schedule.contract.js
```

O contrato declara:

```text
contractVersion=sprint-9.52
requiredEnrollmentStatus=ACTIVE
agendaModuleMapped=true
blockedBySchemaOrModuleGap=true
scheduleCreationBlockedBySchemaOrModuleGap=true
requiresDedicatedScheduleLinkTable=true
duplicateScheduleCheckAvailable=false
scheduleCreated=false
financialSideEffects=false
notificationSideEffects=false
persisted=false
```

## Smoke Tests

Smoke preparatorio validado por testes unitarios:

```text
ENROLLMENT_SCHEDULE_INTEGRATION_PREPARED=true
AGENDA_MODULE_MAPPED=true
SCHEDULE_LINK_CONTRACT_DOCUMENTED=true
SCHEDULE_CREATION_BLOCKED_BY_SCHEMA_OR_MODULE_GAP=true
NO_SCHEDULE_CREATED=true
NO_FINANCIAL_SIDE_EFFECTS=true
NO_NOTIFICATION_SIDE_EFFECTS=true
OFFICIAL_FLOW_STILL_WORKING=true
NO_TEST_DATA_LEFT=true
```

Cenarios cobertos:

```text
ACTIVE Enrollment prepara contrato sem escrita
DRAFT Enrollment e bloqueada
matricula inexistente retorna erro controlado
repeticao da chamada retorna chave idempotente sem criar dados
student ids divergentes sao bloqueados
classId invalido e bloqueado pelo contrato
```

## Validacoes

Validacoes executadas nesta sprint:

```text
node --check backend/src/domains/enrollments/application/contracts/enrollment-schedule.contract.js
node --check backend/src/domains/enrollments/application/contracts/index.js
node --check backend/src/domains/enrollments/application/services/enrollment-schedule.service.js
node --check backend/src/domains/enrollments/application/services/index.js
node --check backend/src/domains/enrollments/application/facades/enrollment.facade.js
node --check backend/src/domains/enrollments/application/tests/enrollment-schedule.service.test.js
node --check backend/src/domains/enrollments/application/tests/enrollment.facade.test.js
node --test backend/src/domains/enrollments/application/tests/*.test.js
cmd /c npm run build
```

## Migration Futura Necessaria

Antes de criar agenda real, criar estrutura dedicada, por exemplo:

```text
enrollment_schedule_links
```

Colunas sugeridas:

```text
id
enrollment_id
class_id
student_person_id
student_profile_id
days_of_week_json
start_time
end_time
starts_at
ends_at
status
created_by
metadata_json
created_at
updated_at
```

Regras sugeridas:

```text
FK enrollment_id -> enrollments.id
referencia logica class_id -> j12_turmas.id enquanto Turmas estiver no legado
unicidade por enrollment_id + class_id + status ativo
status preparado/ativo/cancelado/suspenso/falhou
historico de alteracao de horarios
campo para cancelamento/reposicao em estrutura futura propria
```

## Riscos

- Agenda atual e majoritariamente frontend e derivada de outras fontes.
- `student_presencas` representa chamada/presenca, nao agenda planejada.
- Horarios de turma existem em `j12_turmas`, mas ainda sem service de dominio.
- Criar agenda real agora poderia duplicar horarios ou misturar matricula nova
  com vinculos legados de `j12_alunos`.

## Rollback

Rollback de codigo:

```text
remover o contrato de schedule
remover o service de schedule
remover o metodo da facade
remover exports adicionados
remover a documentacao da sprint
```

Nao ha rollback de banco porque nenhuma migration foi criada e nenhum dado foi
gravado.

## Fora Do Escopo

Nao foram alterados:

```text
frontend
API publica
financeiro
mensalidades
notificacoes
app
legado
schema
migrations
fluxo publico de criacao de aluno
```

## Proximos Passos

1. Criar service/repository de Agenda com fonte unica para Dashboard e portais.
2. Criar migration `enrollment_schedule_links`.
3. Criar adapter de leitura de Turmas ou migrar Turmas para dominio proprio.
4. Implementar criacao real de agenda com transacao e chave idempotente.
5. Modelar cancelamento, reposicao e historico de horarios.
