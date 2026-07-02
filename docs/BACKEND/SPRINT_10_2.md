# Sprint 10.2 - Fluxo Integrado Pessoa -> Matricula -> Turma

## Objetivo

Preparar o primeiro fluxo integrado Pessoa -> Matricula -> Turma na Fase 10,
preservando a arquitetura em camadas, a `EnrollmentFacade`, a idempotencia do
dominio de Matriculas e as regras ja estabilizadas.

Resultado tecnico desta sprint:

```text
integracao real de escrita nao foi habilitada
fluxo foi preparado e bloqueado por lacunas estruturais do modulo de Turmas
nenhuma turma, aluno, financeiro, agenda ou notificacao foi alterada
```

## Decisao tecnica

Foi criada uma camada de preparacao no dominio de Matriculas:

```text
Controller futuro
  -> EnrollmentFacade.prepareActiveEnrollmentClassLink()
  -> EnrollmentClassLinkService
  -> EnrollmentApplicationService/findEnrollmentById()
  -> prepareEnrollmentClassLink()
```

Essa camada valida uma Matricula persistida como `ACTIVE` e retorna o contrato
seguro para Turmas, mas nao grava vinculo.

Motivo do bloqueio da escrita real:

```text
nao existe tabela dedicada enrollment_class_links
nao existe repository/service backend de Turmas em camadas
backend/src/routes/turmas.routes.js acessa SQL diretamente
nao existe ponte segura entre enrollments.student_profile_id/person_profiles e j12_alunos.id
StudentApplicationService ignora aluno.id legado de proposito porque ele nao e Pessoa id
capacidade de turma existe como campo, mas nao ha controle transacional de vagas para Matriculas
historico aluno/turma nao existe como tabela propria
```

## Modulo de Turmas encontrado

### Dominio

```text
backend/src/domains/turmas: nao encontrado
```

Estado: `NAO IMPLEMENTADO` como dominio backend em camadas.

### Routes

```text
backend/src/routes/turmas.routes.js
```

Estado: existe, mas e superficie legada com SQL direto via `pool`.

### Controllers

```text
controller dedicado de Turmas: nao encontrado
```

Estado: logica de controller fica dentro da route.

### Repositories

```text
repository backend de Turmas: nao encontrado
```

Estado: consultas e updates de `j12_turmas` ficam na route.

### Services

```text
service backend de negocio de Turmas: nao encontrado
backend/src/services/portal-schema.service.js: garante parte do schema de portal/aluno
```

Estado: nao ha service seguro para validar turma, vaga, historico ou vinculo de
Matriculas.

### Frontend

```text
src/lib/turmas-store.ts
src/routes/turmas.tsx
src/components/turmas/*
```

Estado: existe camada frontend/admin, mas nao foi alterada nesta sprint.

## Banco auditado

Tabela principal de Turmas:

```text
j12_turmas
```

Campos relevantes encontrados:

```text
id BIGINT AUTO_INCREMENT
nome
modalidade
unidade
professor_id
professor_nome
modalidade_id
unidade_id
dias_semana
dias_semana_json
horario
horario_inicio
horario_fim
capacidade
status
aluno_ids_json
presencas_json
created_at
updated_at
```

Relacionamentos legados encontrados:

```text
j12_alunos.turma_id
j12_alunos.turma_principal
j12_turmas.aluno_ids_json
```

Tabela de relacionamento Matricula-Turma:

```text
enrollment_class_links: nao encontrada
```

Estado da escrita real: `BLOQUEADA`.

## Status e vagas

Status de turma:

```text
j12_turmas.status
valores normalizados pela route: ativa / inativa
```

Capacidade:

```text
j12_turmas.capacidade
```

Limitacao:

```text
capacidade pode ser lida, mas nao ha operacao transacional dedicada para
reservar vaga via Matriculas nem constraint contra corrida concorrente.
```

## Historico

Historico aluno/turma:

```text
tabela propria nao encontrada
```

Tabelas relacionadas que nao substituem o historico:

```text
j12_presencas usa aluno_id/turma_id para chamadas
j12_alunos possui turma atual/legada
```

## Eventos

Eventos existentes no dominio de Matriculas:

```text
EnrollmentDraftCreated
EnrollmentConfirmed
EnrollmentInternalEventDispatcher
```

Evento novo preparado:

```text
EnrollmentClassLinked
```

Estado:

```text
eventDispatched=false
```

O evento nao e publicado porque nao ha escrita real de vinculo nesta sprint.

## Arquivos alterados

```text
backend/src/domains/enrollments/application/services/enrollment-class-link.service.js
backend/src/domains/enrollments/application/services/index.js
backend/src/domains/enrollments/application/facades/enrollment.facade.js
backend/src/domains/enrollments/application/tests/enrollment-class-link.service.test.js
backend/src/domains/enrollments/application/tests/enrollment.facade.test.js
docs/BACKEND/SPRINT_10_2.md
```

## Comportamento implementado

`EnrollmentClassLinkService.prepareActiveEnrollmentClassLink()`:

```text
exige enrollmentId, classId e requestedBy
busca Matricula persistida por findEnrollmentById
bloqueia Matricula inexistente
bloqueia Matricula diferente de ACTIVE
valida classId numerico compativel com j12_turmas.id
quando um classReader seguro for injetado, valida turma existente/ativa/vaga/duplicidade
retorna contrato preparado e bloqueado para persistencia
nao grava enrollment_class_links
nao atualiza j12_turmas
nao atualiza j12_alunos
nao cria financeiro
nao cria agenda
nao envia notificacao
nao publica evento real
```

## Smoke test

Como a integracao real ficou bloqueada, o smoke executado foi de preparacao:

```text
PERSON_TO_CLASS_FLOW_PREPARED=true
CLASS_MODULE_MAPPED=true
CLASS_INTEGRATION_BLOCKED=true
CONTRACT_DOCUMENTED=true
OFFICIAL_FLOW_STILL_WORKING=true
NO_TEST_DATA_LEFT=true
```

Coberturas unitarias adicionadas:

```text
ACTIVE Enrollment prepara contrato bloqueado
DRAFT Enrollment e bloqueada
classId invalido e bloqueado
Turma inexistente e bloqueada quando reader seguro existe
Turma inativa e bloqueada quando reader seguro existe
Turma lotada e bloqueada quando reader seguro existe
vinculo duplicado e bloqueado quando reader seguro existe
EnrollmentFacade expoe prepareActiveEnrollmentClassLink()
```

## Validacoes executadas

```text
node --check backend/src/domains/enrollments/application/services/enrollment-class-link.service.js
node --check backend/src/domains/enrollments/application/services/index.js
node --check backend/src/domains/enrollments/application/facades/enrollment.facade.js
node --check backend/src/domains/enrollments/application/tests/enrollment-class-link.service.test.js
node --check backend/src/domains/enrollments/application/tests/enrollment.facade.test.js
node --check sprint-10-2-class-link-smoke.tmp.cjs
node sprint-10-2-class-link-smoke.tmp.cjs
node --test backend/src/domains/enrollments/application/tests/*.test.js
cmd /c npm run build
```

## Nao alterado

```text
frontend
mobile
financeiro
agenda
notificacoes
banco
migrations
controllers
routes
repository MySQL de Matriculas
rotas legadas de Turmas
regras de negocio estabilizadas de DRAFT/ACTIVE
```

## Proximos passos para Sprint 10.3

Para habilitar escrita real Matricula -> Turma:

```text
1. criar dominio backend de Turmas com service/repository em camadas
2. decidir ponte oficial entre person_profiles e j12_alunos ou migrar Turmas para Pessoas
3. criar migration enrollment_class_links
4. definir unique key para idempotencia enrollment_id + class_id + status ativo
5. implementar check transacional de capacidade/vagas
6. criar evento real EnrollmentClassLinked somente apos persistencia bem-sucedida
7. decidir auditoria persistente para CLASS_LINK_CREATED
8. criar smoke com transacao/rollback no banco real
```

## Resultado

```text
PERSON_TO_CLASS_FLOW_PREPARED=true
CLASS_MODULE_MAPPED=true
CLASS_INTEGRATION_BLOCKED=true
CONTRACT_DOCUMENTED=true
OFFICIAL_FLOW_STILL_WORKING=true
NO_TEST_DATA_LEFT=true
```
