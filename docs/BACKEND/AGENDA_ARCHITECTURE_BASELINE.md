# Baseline Arquitetural - Modulo de Agenda

## Escopo

Baseline tecnico do modulo de Agenda em 2026-07-02, limitado a auditoria e
documentacao. Nao foram criados horarios, aulas, presencas, eventos,
migrations, controllers, services, repositories ou rotas novas.

Observacao de ambiente:

```text
O contexto geral do projeto menciona PostgreSQL, mas o backend auditado nesta
sprint usa MySQL/MySQL2. A propria sprint solicitou SHOW TABLES, SHOW CREATE
TABLE e SHOW INDEX, que foram executados como consultas somente leitura.
```

## Resumo executivo

O modulo de Agenda ainda nao esta implementado como modulo operacional
dedicado. O estado real e:

```text
backend/src/domains/agenda existe apenas como fronteira reservada.
Nao ha controller, route, service ou repository proprio de Agenda.
Nao ha tabela agenda, schedule, horario, aula ou attendance no banco.
Ha duas tabelas reais de presenca: j12_presencas e student_presencas.
Horarios atuais vivem em j12_turmas e em campos JSON de aluno.
Matricula -> Turma ja tem tabela enrollment_class_links.
Matricula -> Agenda ainda nao tem tabela enrollment_schedule_links.
EnrollmentScheduleService prepara contrato sem escrita e segue bloqueado.
```

Classificacao consolidada:

```text
Agenda dedicada: SOMENTE DOCUMENTADO
Horarios via Turmas: PARCIAL
Aulas planejadas: NAO IMPLEMENTADO
Presenca operacional legada: PARCIAL
Recorrencia: NAO IMPLEMENTADO
Cancelamentos de agenda: NAO IMPLEMENTADO
Reposicoes: PARCIAL, apenas como marcador em j12_presencas
Vinculo Matricula -> Turma: IMPLEMENTADO
Vinculo Matricula -> Agenda: SOMENTE DOCUMENTADO
```

## Diagrama atual

```text
Pessoa / Perfil
  people
  person_profiles
        |
        v
Matricula
  enrollments
        |
        v
Turma vinculada
  enrollment_class_links -> j12_turmas
        |
        v
Horario atual
  j12_turmas.dias_semana
  j12_turmas.dias_semana_json
  j12_turmas.horario
  j12_turmas.horario_inicio
  j12_turmas.horario_fim
        |
        v
Agenda planejada
  NAO EXISTE tabela dedicada
  NAO EXISTE repository/service dedicado
        |
        v
Presenca
  student_presencas, usado por /api/presencas e portal legado
  j12_presencas, com FK para j12_alunos e j12_turmas
```

## Diagrama alvo recomendado

```text
Enrollment ACTIVE
  -> enrollment_class_links ACTIVE
  -> j12_turmas ou ClassApplicationService
  -> AgendaApplicationService
  -> enrollment_schedule_links
  -> attendance/presencas canonicas
```

O alvo ainda depende de decisao sobre tabela canonica de agenda e reconciliacao
das tabelas de presenca.

## Auditoria de banco

Consultas executadas somente leitura:

```sql
SHOW TABLES LIKE '%agenda%';
SHOW TABLES LIKE '%schedule%';
SHOW TABLES LIKE '%horario%';
SHOW TABLES LIKE '%aula%';
SHOW TABLES LIKE '%presenca%';
SHOW TABLES LIKE '%attendance%';
```

Resultado:

| Padrao | Tabelas encontradas | Classificacao |
| --- | --- | --- |
| `%agenda%` | nenhuma | NAO IMPLEMENTADO |
| `%schedule%` | nenhuma | NAO IMPLEMENTADO |
| `%horario%` | nenhuma | NAO IMPLEMENTADO |
| `%aula%` | nenhuma | NAO IMPLEMENTADO |
| `%presenca%` | `j12_presencas`, `student_presencas` | PARCIAL |
| `%attendance%` | nenhuma | NAO IMPLEMENTADO |

## Tabelas de presenca

### j12_presencas

Status: `PARCIAL`.

Tabela fisica implementada com relacionamento forte para aluno e turma, mas sem
service/repository de Agenda e sem integracao direta com `enrollments.id`.

Colunas auditadas por `SHOW CREATE TABLE`:

```text
id int auto_increment primary key
aluno_id int not null
modalidade_id int null
turma_id int not null
unidade_id int null
professor_id int null
data_aula date not null
horario_inicio time null
horario_fim time null
observacao text null
created_at timestamp default current_timestamp
status_presenca enum('presente','falta','atrasado','atestado','reposicao')
tipo_presenca enum('normal','experimental','reposicao','avaliacao','treino_extra')
updated_at timestamp default current_timestamp on update current_timestamp
```

Indices e FKs:

```text
PRIMARY KEY (id)
UNIQUE unique_presenca (aluno_id, turma_id, data_aula)
idx_aluno (aluno_id)
idx_turma (turma_id)
idx_professor (professor_id)
idx_data (data_aula)
FK aluno_id -> j12_alunos.id ON DELETE CASCADE
FK turma_id -> j12_turmas.id ON DELETE CASCADE
```

Leitura tecnica:

```text
Permite registrar presenca por aluno/turma/data.
Tem campos de horario da aula.
Tem marcadores para reposicao e treino_extra.
Nao possui enrollment_id, student_person_id ou student_profile_id.
Nao modela cancelamento de agenda.
Nao modela recorrencia.
Nao possui repository/service dedicado no dominio Agenda.
```

Observacao de compatibilidade:

```text
backend/src/controllers/aluno.controller.js le j12_presencas usando
status_presenca.

backend/src/services/portal-schema.service.js ainda contem DDL/sync de
compatibilidade para j12_presencas, mas o DDL em codigo e diferente da tabela
real auditada no banco. Isto deve ser reconciliado antes de qualquer evolucao.
```

### student_presencas

Status: `PARCIAL`.

Tabela operacional legada usada pela rota atual de presencas, mas sem FK para
turma/aluno e sem vinculo com Matricula.

Colunas auditadas por `SHOW CREATE TABLE`:

```text
id varchar(64) primary key
aluno_id varchar(64) not null
turma varchar(191) not null
modalidade varchar(191) null
data_aula date not null
presente tinyint(1) not null default 0
observacao text null
created_at datetime default current_timestamp
updated_at datetime default current_timestamp on update current_timestamp
```

Indices:

```text
PRIMARY KEY (id)
idx_student_presencas_aluno (aluno_id)
idx_student_presencas_data (data_aula)
```

Leitura tecnica:

```text
Usada por backend/src/routes/presencas.routes.js.
Usada por backend/routes/aluno-me.js para dashboard/presencas do aluno.
Armazena turma como texto, nao como class_id/turma_id.
Nao possui FK para j12_alunos ou j12_turmas.
Nao possui chave unica por aluno/turma/data.
Nao possui status rico, apenas boolean presente.
```

## Tabelas de contexto

### j12_turmas

Status: `PARCIAL` como fonte de horarios.

Campos relevantes:

```text
id
nome
modalidade
unidade
professor_id
dias_semana
dias_semana_json
horario
horario_inicio
horario_fim
capacidade
status enum('ativa','inativa')
aluno_ids_json
presencas_json
```

Indices auditados:

```text
PRIMARY KEY (id)
idx_j12_turmas_nome
idx_j12_turmas_status
idx_j12_turmas_professor_id
```

Leitura tecnica:

```text
Fornece dias e horarios atuais da turma.
Nao e uma agenda canonica.
Nao guarda janela de recorrencia, cancelamento, reposicao planejada ou
historico de alteracao de horario.
```

### j12_alunos

Status: `PARCIAL` para vinculo legado aluno/turma/horario.

Campos relevantes:

```text
id
numero_matricula
status
matricula_em
turma_id
turma_principal
dias_horarios_json
modalidade_principal
unidade_principal
matricula_snapshot_json
```

Leitura tecnica:

```text
Tem vinculo legado com turma via turma_id e turma_principal.
Nao tem FK auditada para j12_turmas no SHOW CREATE TABLE.
Nao tem ligacao direta auditada com enrollments.student_person_id.
```

### j12_alunos_esportes

Status: `PARCIAL`.

Campos relevantes:

```text
aluno_id
modalidades_json
unidades_json
horarios_json
turmas_json
```

Leitura tecnica:

```text
Preserva preferencias/selecoes esportivas do aluno.
Nao representa agenda executavel nem recorrencia auditavel.
```

### enrollments

Status: `IMPLEMENTADO` para Matriculas.

Campos relevantes:

```text
id
student_person_id
student_profile_id
status
start_date
end_date
confirmed_at
confirmed_by
deleted_at
```

Relacionamentos:

```text
FK student_person_id -> people.id ON UPDATE CASCADE
FK student_profile_id -> person_profiles.id ON UPDATE CASCADE
```

Leitura tecnica:

```text
E a fonte atual para Matricula ACTIVE no dominio novo.
Nao possui vinculo direto com j12_presencas ou student_presencas.
```

### enrollment_class_links

Status: `IMPLEMENTADO`.

Campos relevantes:

```text
id
enrollment_id
class_id
status
linked_at
linked_by
unlinked_at
unlinked_by
origin
metadata_json
```

Indices e FKs:

```text
PRIMARY KEY (id)
UNIQUE ux_enrollment_class_links_active (enrollment_id, class_id, status)
FK enrollment_id -> enrollments.id ON UPDATE CASCADE
FK class_id -> j12_turmas.id ON UPDATE CASCADE
idx_enrollment_class_links_enrollment_id
idx_enrollment_class_links_class_id
idx_enrollment_class_links_status
```

Leitura tecnica:

```text
Ja fecha o trecho Matricula -> Turma.
Nao cria horarios nem agenda.
```

### enrollment_schedule_links

Status: `NAO IMPLEMENTADO`.

Resultado auditado:

```text
SHOW TABLES LIKE 'enrollment_schedule_links': inexistente
SHOW TABLES LIKE '%schedule%': nenhuma tabela
```

## Backend auditado

### Dominio Agenda

Arquivos:

```text
backend/src/domains/agenda/README.md
backend/src/domains/agenda/index.js
```

Status: `SOMENTE DOCUMENTADO`.

Leitura tecnica:

```text
Fronteira reservada.
Nao expoe regra de negocio.
Nao possui controllers, services, repositories, validators ou tipos reais.
Nao e importada como fluxo operacional de Agenda.
```

### Presencas operacionais

Arquivos:

```text
backend/src/routes/presencas.routes.js
backend/routes/aluno-me.js
backend/src/routes/aluno.routes.js
backend/src/controllers/aluno.controller.js
backend/src/routes/portalAlunoPresencas.js
backend/src/services/presencas.service.ts
```

Status: `PARCIAL`.

Leitura tecnica:

```text
backend/src/routes/presencas.routes.js esta montado em /presencas e
/api/presencas no backend/src/server.js.

Essa rota usa student_presencas e permite dashboard, ranking e POST de
presenca para admin/professor.

backend/routes/aluno-me.js esta montado em /aluno/me e /api/aluno/me e tambem
le student_presencas.

backend/src/routes/aluno.routes.js existe e expoe /me/presencas quando usado
por server/index.mjs, lendo j12_presencas via controller.

backend/src/routes/portalAlunoPresencas.js nao foi encontrado montado no
servidor principal durante a auditoria.

backend/src/services/presencas.service.ts espera GET /api/presencas/turma/:turmaId,
mas a rota atual auditada nao possui esse endpoint.
```

Risco:

```text
Ha duas fontes de presenca com contratos diferentes. Evoluir Agenda sem
escolher uma fonte canonica pode duplicar registros, quebrar portais ou gerar
presenca sem vinculo com Matricula ACTIVE.
```

### Contrato Matricula -> Agenda

Arquivos:

```text
backend/src/domains/enrollments/application/contracts/enrollment-schedule.contract.js
backend/src/domains/enrollments/application/services/enrollment-schedule.service.js
backend/src/domains/enrollments/application/facades/enrollment.facade.js
backend/src/domains/enrollments/application/tests/enrollment-schedule.service.test.js
```

Status: `PARCIAL`.

Leitura tecnica:

```text
Valida Matricula ACTIVE.
Valida student_person_id e student_profile_id.
Valida classId/turmaId.
Pode exigir active enrollment_class_links para preparacao inicial.
Le dados de horario de Turma quando ha classReader.
Retorna contrato preparado sem criar agenda, presenca, financeiro ou notificacao.
Marca blockedBySchemaOrModuleGap=true.
Declara enrollment_schedule_links como tabela futura requerida.
```

## Classificacao por capacidade

| Capacidade | Estado | Evidencia |
| --- | --- | --- |
| Tabela dedicada de Agenda | NAO IMPLEMENTADO | nenhum resultado para `%agenda%` |
| Tabela dedicada de Schedule | NAO IMPLEMENTADO | nenhum resultado para `%schedule%`; `enrollment_schedule_links` inexistente |
| Horarios de turma | PARCIAL | `j12_turmas.dias_semana`, `horario_inicio`, `horario_fim` |
| Aulas planejadas | NAO IMPLEMENTADO | nenhum resultado para `%aula%`; apenas `data_aula` em presencas |
| Presenca com FK aluno/turma | PARCIAL | `j12_presencas` tem FKs e unique por aluno/turma/data |
| Presenca operacional professor/admin | PARCIAL | `/api/presencas` grava `student_presencas` |
| Recorrencia | NAO IMPLEMENTADO | sem tabela/regra persistida; contrato apenas sugere weekly |
| Cancelamento de aula | NAO IMPLEMENTADO | sem campo ou fluxo canonico de cancelamento |
| Reposicao | PARCIAL | enum em `j12_presencas`, sem workflow de Agenda |
| Vinculo com Turma | IMPLEMENTADO | `enrollment_class_links.class_id -> j12_turmas.id` |
| Vinculo com Aluno legado | PARCIAL | `j12_presencas.aluno_id -> j12_alunos.id`; `student_presencas.aluno_id` sem FK |
| Vinculo com Pessoa/Perfil | IMPLEMENTADO em Matriculas | `enrollments` aponta para `people` e `person_profiles` |
| Vinculo Presenca -> Matricula | NAO IMPLEMENTADO | nenhuma tabela de presenca tem `enrollment_id` |
| Controller de Agenda | NAO IMPLEMENTADO | nenhum controller dedicado |
| Route de Agenda backend | NAO IMPLEMENTADO | nenhuma rota dedicada montada |
| Service de Agenda | NAO IMPLEMENTADO | nenhum service dedicado |
| Repository de Agenda | NAO IMPLEMENTADO | nenhum repository dedicado |

## Integracoes atuais

### Alunos

Status: `PARCIAL`.

```text
Aluno legado usa j12_alunos e student_presencas.
Agenda futura precisa definir ponte segura entre enrollments.student_person_id /
student_profile_id e j12_alunos.id, ou migrar presencas para IDs de Pessoa /
Perfil / Matricula.
```

### Turmas

Status: `PARCIAL`.

```text
Turmas possuem rota CRUD legada, ClassApplicationService e MySqlClassRepository
read-only.
Horarios existem em j12_turmas, mas nao sao Agenda canonica.
```

### Matriculas

Status: `PARCIAL` para Agenda.

```text
Matriculas ACTIVE estao em enrollments.
O vinculo com Turma esta em enrollment_class_links.
O contrato de schedule ja prepara o plano, mas nao persiste.
Falta enrollment_schedule_links ou equivalente canonico.
```

### Financeiro e Notificacoes

Status: `FORA DO ESCOPO`.

```text
O contrato de Agenda atual declara sem side effects financeiros ou de
notificacao. Esta sprint nao alterou esses modulos.
```

## Migrations e schema

Migrations encontradas relacionadas ao caminho Matricula -> Turma:

```text
backend/src/database/migrations/20260701120000_add_enrollment_class_links_table.js
backend/src/database/migrations/20260701103000_add_enrollment_class_links_table.js
```

Migrations nao encontradas:

```text
agenda
schedule
horario
aula
attendance
presenca
enrollment_schedule_links
```

Schema runtime:

```text
backend/src/config/db.js contem DDL runtime para j12_turmas, j12_alunos,
j12_alunos_esportes e student_presencas.

backend/src/services/portal-schema.service.js contem DDL/sync para j12_presencas.
```

Risco:

```text
A criacao/alteracao de schema esta distribuida entre migrations e bootstrap
runtime. Antes de evoluir Agenda, escolher migration explicita e evitar
expandir DDL em bootstrap.
```

## Principais bloqueios

```text
1. Nao existe tabela canonica de Agenda.
2. Nao existe service/repository dedicado de Agenda.
3. Existem duas tabelas de presenca com modelos diferentes.
4. A rota operacional grava student_presencas, enquanto j12_presencas e a tabela
   com FKs para aluno/turma.
5. Presencas nao apontam para enrollments.id.
6. O vinculo Pessoa/Perfil -> j12_alunos ainda nao esta definido como fonte
   unica para Agenda.
7. Horarios de Turma nao modelam recorrencia com periodo de vigencia.
8. Cancelamento e reposicao existem no maximo como marcadores, nao como fluxo.
9. O client/service espera endpoint de turma que nao foi encontrado na rota
   atual.
```

## Recomendacao para Sprint 13.2

Executar uma sprint preparatoria, ainda sem criar aulas reais em producao,
com foco em contrato e fonte canonica:

```text
1. Definir se a presenca canonica sera j12_presencas ou uma nova tabela de
   attendance ligada a Matricula/Pessoa.
2. Criar proposta de migration para enrollment_schedule_links, sem executar se
   a sprint continuar documental.
3. Criar contrato de AgendaApplicationService com operacoes read-only primeiro.
4. Criar adapter read-only para resolver:
   Enrollment ACTIVE -> enrollment_class_links ACTIVE -> j12_turmas horario.
5. Documentar idempotencia por enrollment_id + class_id + janela de recorrencia.
6. Documentar regras de cancelamento e reposicao antes de qualquer rota publica.
7. Nao montar rota publica de Agenda ate reconciliar as duas tabelas de
   presenca.
```

## Garantias desta auditoria

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
