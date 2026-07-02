# Baseline Arquitetural - Modulo de Matriculas

## Escopo

Este baseline consolida o estado real do modulo de Matriculas apos as Sprints
9.23 a 9.60. A revisao foi documental e tecnica, sem alteracao de regra de
negocio, banco, migrations, controllers, services, repositories, frontend,
mobile ou APIs.

Observacao de ambiente:

```text
O contexto geral do projeto menciona PostgreSQL, mas o modulo de Matriculas
auditado usa MySQL, mysql2/wrapper query e migrations SQL/JS especificas para
MySQL/InnoDB.
```

## Diagrama textual

```text
HTTP admin/public frontend boundary
  /admin/enrollments
  /api/admin/enrollments
  /enrollments
  /api/enrollments
        |
        v
requireAuth + canManageSystem
        |
        v
presentation/routes
        |
        v
presentation/controllers
        |
        v
EnrollmentFacade
        |
        +--> EnrollmentApplicationService
        |       |
        |       v
        |   MySqlEnrollmentRepository
        |       |
        |       v
        |   MySQL enrollments
        |
        +--> Contracts preparatorios
        |       Turmas, Financeiro, Agenda, Notificacoes,
        |       Mobile, Dashboard, Auditoria
        |
        +--> Eventos internos em memoria

Pessoas domain
        |
        v
enrollment application/orchestration service
        |
        v
EnrollmentFacade
```

## Arquitetura atual

### Domain

```text
backend/src/domains/enrollments/domain/entities
backend/src/domains/enrollments/domain/enums
backend/src/domains/enrollments/domain/factories
```

Responsabilidades:

```text
entidade Enrollment
factory de DRAFT
status DRAFT/ACTIVE e validacoes basicas de dominio
```

Status: `IMPLEMENTADA`.

### Application

```text
backend/src/domains/enrollments/application/facades
backend/src/domains/enrollments/application/services
backend/src/domains/enrollments/application/contracts
backend/src/domains/enrollments/application/events
backend/src/domains/enrollments/application/tests
```

Responsabilidades:

```text
facade unica para consumidores internos
criacao, persistencia, reuso e leitura de DRAFT
leitura de ACTIVE
status summary NONE/DRAFT/ACTIVE/CONFLICT
confirmacao DRAFT -> ACTIVE
guards de progresso e ACTIVE duplicado
eventos internos controlados
contratos preparatorios de integracao
testes unitarios do dominio
```

Status: `IMPLEMENTADA` para o nucleo de Matriculas e `SOMENTE DOCUMENTADA` ou
`PARCIALMENTE IMPLEMENTADA` para integracoes futuras.

### Infrastructure

```text
backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment.repository.js
```

Responsabilidades:

```text
SQL encapsulado
INSERT/SELECT/UPDATE da tabela enrollments
GET_LOCK/RELEASE_LOCK para criacao idempotente de DRAFT
tratamento controlado de duplicidade fisica de DRAFT
```

Status: `IMPLEMENTADA`.

### Presentation

```text
backend/src/domains/enrollments/presentation/controllers
backend/src/domains/enrollments/presentation/routes
```

Responsabilidades:

```text
rotas admin e public boundary registradas
router interno preparado, mas nao montado no server principal
controllers delegam para EnrollmentFacade
tratamento de erros controlado
```

Status: `PARCIALMENTE IMPLEMENTADA`, porque a API interna existe como factory
nao montada e a API chamada public continua protegida por permissao de gestao.

## Migrations e banco

Migrations principais:

```text
backend/src/database/migrations/20260629134546_create_enrollments_table.sql
backend/src/database/migrations/20260629190607_add_active_draft_unique_constraint_to_enrollments.js
backend/src/database/migrations/20260629232350_add_enrollment_confirmation_audit_columns.js
```

Estado real:

```text
tabela enrollments criada para MySQL/InnoDB
FK student_person_id -> people.id
FK student_profile_id -> person_profiles.id
indices por pessoa, perfil, status, deleted_at e student/status
generated columns para DRAFT ativo
unique index ux_enrollments_active_draft_student_profile
confirmed_at e confirmed_by para auditoria minima da confirmacao
```

Status: `IMPLEMENTADA` para tabela, constraint fisica de DRAFT e auditoria
minima de confirmacao. Auditoria completa persistente permanece
`SOMENTE DOCUMENTADA`.

## Fluxos auditados

| Fluxo | Estado | Evidencia |
| --- | --- | --- |
| Criar DRAFT em memoria | IMPLEMENTADA | `EnrollmentFacade.createDraftEnrollment()` e factory |
| Persistir DRAFT | IMPLEMENTADA | `createDraftEnrollmentAndPersist()` |
| Criar/reusar DRAFT idempotente | IMPLEMENTADA | `createDraftEnrollmentIdempotently()` e `createDraftIfNotExists()` |
| Bloquear DRAFT duplicado fisicamente | IMPLEMENTADA | generated columns + unique index |
| Ler DRAFT atual | IMPLEMENTADA | `findCurrentDraftEnrollment()` |
| Ler ACTIVE atual | IMPLEMENTADA | `findCurrentActiveEnrollment()` |
| Status summary NONE/DRAFT/ACTIVE/CONFLICT | IMPLEMENTADA | `getEnrollmentStatusSummary()` |
| Confirmar DRAFT para ACTIVE | IMPLEMENTADA | `confirmDraftEnrollment()` |
| Auditoria minima de confirmacao | IMPLEMENTADA | `confirmed_at` e `confirmed_by` |
| Evento interno de DRAFT criado | IMPLEMENTADA | `EnrollmentDraftCreated` |
| Evento interno de matricula confirmada | IMPLEMENTADA | `EnrollmentConfirmed` |
| Integracao Pessoas -> Matriculas | PARCIALMENTE IMPLEMENTADA | Pessoas usa facade/store para draft, mas fluxo completo com modulos futuros ainda nao esta fechado |
| Endpoints administrativos | IMPLEMENTADA | rotas admin montadas e protegidas |
| API interna | PARCIALMENTE IMPLEMENTADA | router factory existe, mas nao esta montado |
| API public de Matriculas | PARCIALMENTE IMPLEMENTADA | boundary existe, mas protegido por auth/gestao; nao e self-service publico |
| Frontend administrativo | PARCIALMENTE IMPLEMENTADA | tela admin existe, consulta por ids tecnicos e nao cobre fluxo operacional completo |
| Mobile/app | SOMENTE DOCUMENTADA | DTO/facade seguro, sem rota ou app real |
| Dashboard operacional | SOMENTE DOCUMENTADA | contrato preparado, sem query agregada, rota ou UI |
| Auditoria completa | SOMENTE DOCUMENTADA | payload seguro preparado, sem tabela ou persistencia |

## Integracoes

| Integracao | Estado | Leitura tecnica |
| --- | --- | --- |
| Pessoas | PARCIALMENTE IMPLEMENTADA | Ha acoplamento controlado via facade/orquestracao para draftEnrollment, mas nao ha conclusao de todos os efeitos finais de matricula |
| Turmas | SOMENTE DOCUMENTADA | `prepareEnrollmentClassLink()` valida contrato; nao cria vinculo/turma |
| Financeiro | SOMENTE DOCUMENTADA | `prepareEnrollmentFinancialLink()` e obligation contract; nao cria cobranca, mensalidade ou pagamento |
| Agenda | SOMENTE DOCUMENTADA | `prepareEnrollmentScheduleLink()`; nao cria agenda ou presenca |
| Notificacoes | SOMENTE DOCUMENTADA | `prepareEnrollmentNotification()`; nao envia email, WhatsApp, push ou Socket.IO |
| Frontend | PARCIALMENTE IMPLEMENTADA | Admin UI existe para consulta/confirmacao por ids tecnicos |
| Mobile | SOMENTE DOCUMENTADA | Summary DTO seguro existe; falta rota, auth de aluno/responsavel e aplicativo |
| Dashboard | SOMENTE DOCUMENTADA | Contrato preparado e bloqueado por unit/tenant/performance |
| Auditoria | SOMENTE DOCUMENTADA | Sanitizacao de payload existe; falta storage, retencao e consulta |

## Seguranca

Estado validado:

```text
rotas admin usam requireAuth + canManageSystem
rotas public boundary tambem usam requireAuth + canManageSystem
router interno exige requireAuth + canManageSystem e nao esta montado
controllers nao acessam SQL diretamente
repository usa parametros em queries
criacao DRAFT usa GET_LOCK/RELEASE_LOCK e unique index
erros controlados retornam envelope sem stack trace
event dispatcher nao aciona integracoes externas
```

Riscos documentados:

```text
confirmedBy ainda pode vir do body em rotas admin/internal; preferir actor autenticado como fonte primaria
confirmacao concorrente nao usa lock especifico nem UPDATE condicional WHERE status='DRAFT'
API chamada public pode gerar ambiguidade porque e protegida como administrativa
logs legados fora do dominio podem precisar saneamento padronizado
```

## Performance

Estado real:

```text
queries runtime principais possuem LIMIT 1
getEnrollmentStatusSummary usa duas leituras paralelas para preservar CONFLICT
nao foi encontrado N+1 no dominio atual
tabela estava vazia na auditoria de performance
```

Riscos futuros:

```text
ORDER BY nas leituras DRAFT/ACTIVE pode gerar filesort com volume
confirmed_at nao possui indice dedicado para dashboard futuro
dashboard agregado deve evitar loops chamando status summary
unit_id/tenant_id deve ser resolvido antes de metricas multi-unidade
```

## Codigo e dividas tecnicas

Dividas encontradas:

```text
varios arquivos do dominio e documentos estao untracked no git local; precisam ser versionados antes de entrega formal
existem superficies HTTP parecidas: admin, public boundary e internal factory; consolidar nomenclatura e politica de exposicao
router interno esta preparado, mas nao montado
contrato de dashboard tem metadado de indices observado divergente do indice real gerado por columns
confirmacao concorrente ainda depende de guard logico antes do update, sem lock especifico
nao ha unit_id/tenant_id em enrollments
nao ha auditoria persistente completa
nao ha tabelas de link reais para Turmas, Financeiro, Agenda e Notificacoes
frontend admin usa ids tecnicos para consulta
mobile/app ainda nao tem rota nem contrato de autenticacao de aluno/responsavel
```

Nao foram removidos codigo, contratos ou rotas durante esta auditoria.

## Linha do tempo resumida

Lacunas documentais observadas:

```text
nao foi encontrado docs/BACKEND/SPRINT_9_39.md
SPRINT_9_55 esta documentada em docs/FRONTEND/SPRINT_9_55.md
o baseline usa os documentos existentes, codigo atual e sprints vizinhas para
consolidar o estado real entre 9.23 e 9.60
```

| Sprints | Resultado |
| --- | --- |
| 9.23-9.29 | Descoberta, tabela, DRAFT, persistencia, leitura, idempotencia e auditoria inicial |
| 9.30 | Constraint fisica contra duplicidade de DRAFT |
| 9.31-9.38 | Confirmacao, status summary, guards, eventos e hardening do nucleo |
| 9.40-9.49 | Facade, API interna/admin e endpoints administrativos |
| 9.50-9.53 | Preparacao sem side effects para Turmas, Financeiro, Agenda e Notificacoes |
| 9.54 | API public boundary protegida |
| 9.55 | Frontend administrativo inicial |
| 9.56 | Summary DTO seguro para mobile/app |
| 9.57 | Contrato de dashboard operacional |
| 9.58 | Contrato de auditoria completa |
| 9.59 | Auditoria de performance e indices |
| 9.60 | Hardening final e checklist de producao |

## Classificacao consolidada

### IMPLEMENTADA

```text
tabela enrollments
entidade/factory/status basicos
persistencia e reuso idempotente de DRAFT
lock de criacao DRAFT
constraint fisica contra DRAFT duplicado
leitura de DRAFT e ACTIVE
status summary NONE/DRAFT/ACTIVE/CONFLICT
confirmacao DRAFT -> ACTIVE
auditoria minima confirmed_at/confirmed_by
guards de ACTIVE duplicado e conflito
eventos internos controlados
endpoints administrativos protegidos
testes de dominio
```

### PARCIALMENTE IMPLEMENTADA

```text
integracao com Pessoas
API interna
API public boundary
frontend administrativo
performance/hardening operacional
```

### SOMENTE DOCUMENTADA

```text
Turmas
Financeiro
Agenda
Notificacoes
Mobile/app
Dashboard operacional
Auditoria completa
observabilidade estruturada
roadmap de producao das integracoes
```

### NAO IMPLEMENTADA

```text
rota real de mobile/app para aluno/responsavel
dashboard operacional real com query agregada
auditoria persistente completa
tabelas de link com Turmas/Financeiro/Agenda/Notificacoes
unit_id/tenant_id em enrollments
cache de dashboard
logger estruturado com correlationId no dominio inteiro
lock/update condicional especifico para confirmacao concorrente
```

## Resultado do baseline

```text
ARCHITECTURE_BASELINE_CREATED=true
ALL_SPRINTS_REVIEWED=true
DOMAIN_STATUS_DOCUMENTED=true
IMPLEMENTED_FEATURES_IDENTIFIED=true
PLANNED_FEATURES_IDENTIFIED=true
TECHNICAL_DEBT_IDENTIFIED=true
NO_BUSINESS_RULE_CHANGED=true
NO_DATABASE_CHANGE=true
NO_PUBLIC_API_CHANGE=true
```
