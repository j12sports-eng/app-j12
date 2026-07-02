# Sprint 13.1 - Baseline Arquitetural do Modulo de Agenda

## Objetivo

Realizar auditoria tecnica e documentacao do estado real do modulo de Agenda,
sem criar horarios, aulas, presencas, eventos, migrations, rotas publicas ou
regras novas.

## Escopo executado

```text
Auditoria de banco somente leitura.
Auditoria de arquivos backend existentes.
Mapeamento de controllers, routes, services, repositories e migrations.
Mapeamento de relacoes com Alunos, Pessoas, Perfis, Matriculas e Turmas.
Classificacao do estado atual como IMPLEMENTADO, PARCIAL, SOMENTE DOCUMENTADO
ou NAO IMPLEMENTADO.
```

## Arquivos criados

```text
docs/BACKEND/SPRINT_13_1.md
docs/BACKEND/AGENDA_ARCHITECTURE_BASELINE.md
```

Nenhum arquivo JS, migration, rota, frontend ou banco foi alterado.

## Auditoria de banco

Consultas executadas somente leitura:

```sql
SHOW TABLES LIKE '%agenda%';
SHOW TABLES LIKE '%schedule%';
SHOW TABLES LIKE '%horario%';
SHOW TABLES LIKE '%aula%';
SHOW TABLES LIKE '%presenca%';
SHOW TABLES LIKE '%attendance%';
SHOW CREATE TABLE j12_presencas;
SHOW INDEX FROM j12_presencas;
SHOW CREATE TABLE student_presencas;
SHOW INDEX FROM student_presencas;
```

Resultado:

| Padrao | Resultado |
| --- | --- |
| `%agenda%` | nenhuma tabela |
| `%schedule%` | nenhuma tabela |
| `%horario%` | nenhuma tabela |
| `%aula%` | nenhuma tabela |
| `%presenca%` | `j12_presencas`, `student_presencas` |
| `%attendance%` | nenhuma tabela |

Tabelas auditadas:

```text
j12_presencas
student_presencas
j12_turmas
j12_alunos
j12_alunos_esportes
enrollments
enrollment_class_links
people
person_profiles
```

Tabela inexistente confirmada:

```text
enrollment_schedule_links
```

## Estado arquitetural de Agenda

| Parte | Estado | Evidencia |
| --- | --- | --- |
| Dominio `backend/src/domains/agenda` | SOMENTE DOCUMENTADO | README e index reservam fronteira sem logica |
| Controller de Agenda | NAO IMPLEMENTADO | nenhum controller dedicado encontrado |
| Rota backend de Agenda | NAO IMPLEMENTADO | nenhuma rota dedicada montada |
| Service de Agenda | NAO IMPLEMENTADO | nenhum service dedicado encontrado |
| Repository de Agenda | NAO IMPLEMENTADO | nenhum repository dedicado encontrado |
| Tabela de Agenda | NAO IMPLEMENTADO | `%agenda%` sem resultado |
| Tabela de Schedule | NAO IMPLEMENTADO | `%schedule%` sem resultado |
| Tabela de Aula | NAO IMPLEMENTADO | `%aula%` sem resultado |
| Horarios | PARCIAL | campos em `j12_turmas` e JSON de aluno |
| Presencas | PARCIAL | duas tabelas reais com contratos diferentes |
| Recorrencia | NAO IMPLEMENTADO | sem tabela/regra persistida |
| Cancelamentos | NAO IMPLEMENTADO | sem fluxo ou schema canonico |
| Reposicoes | PARCIAL | enum em `j12_presencas`, sem workflow de Agenda |

## Backend auditado

Arquivos diretamente relacionados:

```text
backend/src/domains/agenda/README.md
backend/src/domains/agenda/index.js
backend/src/routes/presencas.routes.js
backend/routes/aluno-me.js
backend/src/routes/aluno.routes.js
backend/src/controllers/aluno.controller.js
backend/src/routes/portalAlunoPresencas.js
backend/src/services/presencas.service.ts
backend/src/routes/turmas.routes.js
backend/src/domains/classes/infrastructure/repositories/mysql-class.repository.js
backend/src/domains/classes/application/services/class-application.service.js
backend/src/domains/enrollments/application/contracts/enrollment-schedule.contract.js
backend/src/domains/enrollments/application/services/enrollment-schedule.service.js
backend/src/domains/enrollments/application/facades/enrollment.facade.js
```

Conclusao:

```text
Agenda ainda nao e modulo operacional.
Presenca existe como fluxo legado/parcial.
Horarios sao derivados de Turmas.
Matricula -> Turma ja possui tabela e FK via enrollment_class_links.
Matricula -> Agenda segue apenas preparado por contrato sem escrita.
```

## Relacionamentos mapeados

Fluxo novo ja disponivel ate Turma:

```text
people.id
  -> enrollments.student_person_id

person_profiles.id
  -> enrollments.student_profile_id

enrollments.id
  -> enrollment_class_links.enrollment_id

j12_turmas.id
  -> enrollment_class_links.class_id
```

Fluxo de horario:

```text
j12_turmas.dias_semana
j12_turmas.dias_semana_json
j12_turmas.horario
j12_turmas.horario_inicio
j12_turmas.horario_fim
```

Fluxo de presenca legado/canonico parcial:

```text
j12_presencas.aluno_id -> j12_alunos.id
j12_presencas.turma_id -> j12_turmas.id
student_presencas.aluno_id -> sem FK auditada
student_presencas.turma -> nome textual da turma
```

Lacuna principal:

```text
Nao ha ligacao direta Presenca -> enrollments.id.
Nao ha ligacao direta Agenda -> enrollments.id.
Nao ha tabela enrollment_schedule_links.
```

## Pontos de atencao

```text
1. Existem duas tabelas de presenca: j12_presencas e student_presencas.
2. /api/presencas grava student_presencas, nao j12_presencas.
3. j12_presencas e a tabela com FK aluno/turma e status_presenca/tipo_presenca.
4. backend/src/services/presencas.service.ts espera GET /api/presencas/turma/:turmaId,
   mas esse endpoint nao foi encontrado na rota atual.
5. backend/src/routes/portalAlunoPresencas.js existe, mas nao foi encontrado
   montado no servidor principal.
6. Agenda frontend existe como superficie, mas esta sprint nao alterou frontend.
7. O contrato de Matricula -> Agenda segue bloqueado por falta de schema/modulo.
```

## Classificacao consolidada

### IMPLEMENTADO

```text
Tabela j12_presencas com FK para j12_alunos e j12_turmas.
Tabela student_presencas usada por rota operacional de presenca.
Tabela enrollment_class_links para Matricula -> Turma.
Tabela enrollments com FK para people e person_profiles.
Leitura read-only de Turmas via ClassApplicationService/MySqlClassRepository.
```

### PARCIAL

```text
Presencas como modulo operacional.
Horarios via j12_turmas.
Reposicao como marcador de presenca.
Agenda apresentada em superficies frontend.
Contrato EnrollmentScheduleService para preparacao sem escrita.
```

### SOMENTE DOCUMENTADO

```text
Dominio backend/src/domains/agenda.
Matricula -> Agenda via contrato preparatorio.
Tabela futura enrollment_schedule_links.
Idempotencia de agenda por Matricula/Turma.
```

### NAO IMPLEMENTADO

```text
Agenda canonica.
Controller de Agenda.
Route backend dedicada de Agenda.
Service de Agenda.
Repository de Agenda.
Tabela de Agenda/Schedule/Aula.
Recorrencia persistida.
Cancelamento de aula/agenda.
Workflow real de reposicao.
Vinculo direto Presenca -> Matricula.
Criacao automatica de Agenda a partir de Matricula ACTIVE.
```

## Recomendacao para Sprint 13.2

```text
Criar uma sprint preparatoria de contrato e fonte canonica.
Nao iniciar criacao real de agenda antes de reconciliar j12_presencas e
student_presencas.
Definir se a agenda sera persistida em enrollment_schedule_links ou tabela
equivalente.
Criar adapter read-only Enrollment ACTIVE -> enrollment_class_links -> j12_turmas.
Definir regras de idempotencia, recorrencia, cancelamento e reposicao.
Depois disso, implementar AgendaApplicationService e repository de forma
isolada, ainda sem rota publica.
```

## Smoke esperado

```text
AGENDA_MODULE_BASELINE_CREATED=true
AGENDA_TABLES_MAPPED=true
AGENDA_BACKEND_STATUS_DOCUMENTED=true
AGENDA_RELATIONSHIPS_MAPPED=true
AGENDA_SCHEDULE_STATUS_DOCUMENTED=true
AGENDA_ATTENDANCE_STATUS_DOCUMENTED=true
NO_BUSINESS_RULE_CHANGED=true
NO_DATABASE_CHANGE=true
NO_PUBLIC_API_CHANGE=true
```

## Validacoes

```text
cmd /c npm run build: aprovado
Auditoria tecnica: aprovada
node --check: nao aplicavel, nenhum JS alterado
```

## Nao alterado

```text
frontend
mobile
Matriculas
Turmas
Financeiro
Notificacoes
banco
migrations
API publica
legado
regras atuais de Agenda
```
