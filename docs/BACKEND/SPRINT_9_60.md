# Sprint 9.60 - Hardening final do modulo de Matriculas para producao

## Objetivo

Consolidar a revisao final do modulo de Matriculas para uso seguro em
producao, cobrindo arquitetura, seguranca, concorrencia, idempotencia,
constraints, logs, erros, validacoes, testes, documentacao, deploy, rollback e
observabilidade.

## Decisao tecnica

Hardening/documentacao apenas.

Nao foi aplicada correcao de codigo e nao foi criada migration nesta sprint.

Motivos:

```text
nao foi encontrado bloqueio critico de producao no escopo revisado
rotas administrativas estao autenticadas e autorizadas
controllers delegam para EnrollmentFacade e nao acessam SQL diretamente
duplicidade DRAFT tem protecao logica, lock e constraint fisica
confirmacao DRAFT -> ACTIVE tem guard contra ACTIVE duplicado
integracoes com Financeiro, Turmas, Agenda e Notificacoes continuam preparatorias e sem side effects
dashboard, auditoria e mobile seguem como contratos seguros preparatorios quando necessario
```

## Resumo do modulo

O dominio `backend/src/domains/enrollments` isola a regra de Matriculas e expoe
uma `EnrollmentFacade` para consumidores internos. O repository MySQL encapsula
SQL da tabela `enrollments`, enquanto os services application-level validam
fluxos e contratos sem acoplar controllers a banco, financeiro, turmas, agenda
ou notificacoes.

Capacidades consolidadas:

```text
criacao de DRAFT em memoria
persistencia idempotente de DRAFT
reuso de DRAFT existente
leitura DRAFT e ACTIVE por aluno/perfil
confirmacao DRAFT -> ACTIVE
auditoria minima confirmed_at/confirmed_by
status summary NONE/DRAFT/ACTIVE/CONFLICT
guards internos
eventos internos sem integracao externa
contratos preparatorios para Turmas, Financeiro, Agenda, Notificacoes, Mobile, Dashboard e Auditoria
```

## Arquitetura final

Camadas principais:

```text
domain
  entities, enums, factories

application
  services
  facades
  contracts
  events
  tests

infrastructure
  mysql repository

presentation
  controllers
  routes
```

Regra de dependencia:

```text
controllers -> EnrollmentFacade -> application services/contracts -> repository injetado
```

Os controllers nao instanciam SQL diretamente. A rota admin instancia a facade
com `MySqlEnrollmentRepository`; testes e consumidores futuros podem injetar
facade/service/repository mockados.

## Arquivos principais

```text
backend/src/domains/enrollments/application/facades/enrollment.facade.js
backend/src/domains/enrollments/application/services/enrollment-application.service.js
backend/src/domains/enrollments/application/services/enrollment-financial.service.js
backend/src/domains/enrollments/application/services/enrollment-schedule.service.js
backend/src/domains/enrollments/application/services/enrollment-notification.service.js
backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment.repository.js
backend/src/domains/enrollments/presentation/controllers/enrollment-admin.controller.js
backend/src/domains/enrollments/presentation/controllers/enrollment-internal.controller.js
backend/src/domains/enrollments/presentation/routes/enrollment-admin.routes.js
backend/src/domains/enrollments/presentation/routes/enrollment-internal.routes.js
backend/src/database/migrations/20260629134546_create_enrollments_table.sql
backend/src/database/migrations/20260629190607_add_active_draft_unique_constraint_to_enrollments.js
backend/src/database/migrations/20260629232350_add_enrollment_confirmation_audit_columns.js
```

## Facade revisada

Metodos publicos da `EnrollmentFacade`:

```text
createDraftEnrollment()
createDraftEnrollmentAndPersist()
createDraftEnrollmentIdempotently()
findCurrentDraftEnrollment()
findDraftEnrollment()
findCurrentActiveEnrollment()
getEnrollmentStatusSummary()
ensureEnrollmentCanProceed()
ensureNoActiveEnrollment()
prepareEnrollmentClassLink()
prepareEnrollmentFinancialLink()
getEnrollmentOperationalDashboard()
recordEnrollmentAuditEvent()
getStudentEnrollmentMobileSummary()
prepareEnrollmentFinancialObligation()
prepareEnrollmentScheduleLink()
prepareEnrollmentNotification()
confirmDraftEnrollment()
```

Revisao:

```text
delegacao fina para services/contracts
eventos internos emitidos apenas apos operacoes controladas
falha de dispatcher interno e logada e nao deve corromper matricula
contratos preparatorios nao persistem nem acionam modulos externos
summary mobile remove dados administrativos e ids internos de pessoa/perfil
dashboard operacional permanece sem query real por lacunas de unit/tenant/performance
auditoria completa permanece preparatoria por falta de modulo/tabela/politica de retencao
```

## Services application-level

### EnrollmentApplicationService

Responsavel por:

```text
criar DRAFT
persistir/reusar DRAFT
ler DRAFT/ACTIVE
ler por id
calcular status summary
executar guards
confirmar DRAFT -> ACTIVE
normalizar confirmedAt/confirmedBy
```

Hardening:

```text
valida ids obrigatorios antes de acessar repository
usa Promise.all no status summary para DRAFT + ACTIVE
CONFLICT nao e mascarado
ensureNoActiveEnrollment bloqueia ACTIVE duplicado antes da confirmacao
confirmacao rejeita status diferente de DRAFT/ACTIVE com erro controlado
```

### EnrollmentFinancialService

Hardening:

```text
exige enrollmentId e requestedBy
busca Enrollment persistido antes do contrato financeiro
exige ACTIVE
valida studentPersonId/studentProfileId contra Enrollment persistido
nao cria cobranca, mensalidade, pagamento ou financeiro
```

### EnrollmentScheduleService

Hardening:

```text
exige enrollmentId e requestedBy
busca Enrollment persistido antes do contrato de agenda
exige ACTIVE
valida studentPersonId/studentProfileId
nao cria agenda, presenca, financeiro ou notificacao
```

### EnrollmentNotificationService

Hardening:

```text
exige enrollmentId, eventType e requestedBy
busca Enrollment persistido
valida vinculo do aluno/perfil
nao cria notificacao, Socket.IO, email, WhatsApp ou push
```

## Repository e queries SQL

Repository:

```text
backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment.repository.js
```

Queries encapsuladas:

```text
INSERT_ENROLLMENT_SQL
SELECT_ENROLLMENT_BY_ID_SQL
SELECT_ACTIVE_ENROLLMENT_BY_STUDENT_SQL
UPDATE_ENROLLMENT_STATUS_SQL
SELECT_DRAFT_ENROLLMENT_BY_STUDENT_SQL
SELECT_DRAFT_ENROLLMENT_BY_STUDENT_PERSON_SQL
SELECT_DRAFT_ENROLLMENT_BY_STUDENT_PROFILE_SQL
GET_DRAFT_ENROLLMENT_LOCK_SQL
RELEASE_DRAFT_ENROLLMENT_LOCK_SQL
```

Hardening:

```text
queries de leitura tem LIMIT 1
inputs textuais sao normalizados e limitados
repository trata shape mysql2 e wrapper query do projeto
updateStatus altera confirmed_at/confirmed_by somente ao ativar
createDraftIfNotExists usa GET_LOCK/RELEASE_LOCK e reconsulta DRAFT antes de inserir
ER_DUP_ENTRY/1062 e tratado somente quando aponta para ux_enrollments_active_draft_student_profile
```

## Fluxos principais

### Criacao/reuso de DRAFT

```text
caller -> EnrollmentFacade.createDraftEnrollmentIdempotently()
facade -> EnrollmentApplicationService.createDraftEnrollmentIdempotently()
service -> repository.createDraftIfNotExists()
repository -> GET_LOCK()
repository -> findDraftByStudent()
repository -> create() se nao existir DRAFT
repository -> RELEASE_LOCK()
facade -> evento EnrollmentDraftCreated somente quando created=true
```

Garantias:

```text
idempotencia logica por studentPersonId + studentProfileId
lock nomeado serializa concorrencia
unique index bloqueia duplicidade fisica de DRAFT ativo
duplicidade fisica esperada tenta recuperar DRAFT existente
```

### Confirmacao DRAFT -> ACTIVE

```text
caller -> EnrollmentFacade.confirmDraftEnrollment()
service -> findById(enrollmentId)
service -> valida status DRAFT
service -> ensureNoActiveEnrollment(studentPersonId, studentProfileId)
repository -> updateStatus(ACTIVE, confirmedAt, confirmedBy)
repository -> findById(enrollmentId)
facade -> evento EnrollmentConfirmed quando confirmed=true
```

Garantias:

```text
ACTIVE duplicado e bloqueado logicamente
confirmed_at e confirmed_by preservam auditoria minima
status ACTIVE ja confirmado retorna alreadyConfirmed
status invalido retorna erro controlado
```

## Invariantes do dominio

```text
uma matricula DRAFT ativa por student_person_id + student_profile_id
uma confirmacao so pode ativar DRAFT
ACTIVE duplicado para o mesmo aluno/perfil deve ser bloqueado logicamente
CONFLICT deve ser exposto como CONFLICT, nunca convertido em DRAFT/ACTIVE
controllers nao acessam SQL diretamente
integracoes preparatorias nao criam side effects externos
contratos mobile/dashboard/auditoria nao retornam dados pessoais detalhados
```

## Seguranca

Checklist revisado:

```text
endpoint admin montado em /admin/enrollments e /api/admin/enrollments com requireAuth + canManageSystem
router internal exige requireAuth + canManageSystem e nao esta montado no server principal
controllers chamam somente EnrollmentFacade
frontend administrativo consome endpoints admin protegidos
API publica /public/enrollments nao foi alterada por este dominio
confirmedBy vem do body ou usuario autenticado e e truncado a 191 chars
erros controlados retornam codigo/status sem stack trace
erros nao controlados seguem middleware global
event dispatcher loga apenas enrollmentId/type em falhas
contrato de auditoria remove token, cpf, rg, senha, stack, documento e dados financeiros por chave
```

Riscos nao criticos:

```text
confirmedBy ainda pode vir do body nas rotas admin/internal; em producao preferir actor autenticado como fonte primaria
logs legados fora do dominio ainda usam console e podem precisar saneamento geral
auditoria completa persistente ainda depende de tabela/modulo/politica de retencao
```

## Concorrencia e idempotencia

Revisao:

```text
GET_LOCK usa nome hash por student_person_id + student_profile_id
timeout default: 10 segundos
release executa em finally quando lock foi adquirido
release com erro e logado e so substitui erro principal se nao havia erro da operacao
unique index fisico cobre DRAFT ativo via generated columns
ER_DUP_ENTRY/1062 e tratado como esperado apenas para o indice de DRAFT
confirmacao concorrente tem guard logico de ACTIVE antes do update
```

Risco remanescente:

```text
duas confirmacoes concorrentes do mesmo DRAFT podem disputar entre findById, ensureNoActiveEnrollment e updateStatus
o fluxo atual tende a idempotencia por status ACTIVE ja confirmado, mas nao usa lock especifico de confirmacao
se volume/concorrrencia crescer, avaliar lock transacional ou update condicional WHERE id=? AND status='DRAFT'
```

Nao e bloqueio critico nesta sprint porque:

```text
o dominio ja bloqueia ACTIVE duplicado logicamente
repository reconsulta apos update
nao ha evidencia de corrida real em producao nesta auditoria
mudanca de update condicional exigiria teste/migration comportamental fora do hardening documental
```

## Banco e migrations

### Tabela base

Migration:

```text
backend/src/database/migrations/20260629134546_create_enrollments_table.sql
```

Caracteristicas:

```text
ENGINE=InnoDB
CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci
FK student_person_id -> people.id
FK student_profile_id -> person_profiles.id
indices por pessoa, perfil, status, deleted_at e student_person_id/status
```

### Constraint DRAFT

Migration:

```text
backend/src/database/migrations/20260629190607_add_active_draft_unique_constraint_to_enrollments.js
```

Caracteristicas:

```text
idempotente
valida tabela e colunas base
audita duplicidades antes de criar indice
cria generated columns VIRTUAL
cria unique index ux_enrollments_active_draft_student_profile
possui down com drop index e drop columns
manual, nao roda em startup/build/deploy automaticamente
```

### Auditoria de confirmacao

Migration:

```text
backend/src/database/migrations/20260629232350_add_enrollment_confirmation_audit_columns.js
```

Caracteristicas:

```text
idempotente
valida tabela e tipos base
adiciona confirmed_at DATETIME NULL
adiciona confirmed_by VARCHAR(191) NULL
possui status/up/down
manual, nao roda em startup/build/deploy automaticamente
```

Ordem segura de execucao:

```text
1. 20260629134546_create_enrollments_table.sql
2. 20260629190607_add_active_draft_unique_constraint_to_enrollments.js status
3. 20260629190607_add_active_draft_unique_constraint_to_enrollments.js up
4. 20260629232350_add_enrollment_confirmation_audit_columns.js status
5. 20260629232350_add_enrollment_confirmation_audit_columns.js up
```

Checklist banco:

```text
validar MySQL/Percona alvo antes de generated columns VIRTUAL indexadas
rodar status antes de up em producao
confirmar ausencia de DRAFT duplicado antes do unique index
executar em janela de menor uso se tabela tiver volume
ter backup antes das migrations manuais
nao remover indices existentes
nao alterar constraint de DRAFT sem plano de rollback
```

## Endpoints preparados/registrados

Registrado no backend principal:

```text
GET  /admin/enrollments/status
GET  /admin/enrollments/current-draft
GET  /admin/enrollments/current-active
POST /admin/enrollments/:enrollmentId/confirm

tambem montado com prefixo /api/admin/enrollments
```

Protecao:

```text
requireAuth
canManageSystem
```

Factory interna existente, mas nao montada no server principal:

```text
/internal/enrollments
```

## Eventos internos

Eventos revisados:

```text
EnrollmentDraftCreated
EnrollmentConfirmed
EnrollmentInternalEventDispatcher
```

Hardening:

```text
dispatcher padrao nao chama fila, HTTP, socket, email, financeiro ou notificacoes
retenção em memoria so ocorre quando retainEvents=true
log tecnico minimo: enrollmentId e type
falha de dispatch e capturada na facade
```

## Integracoes preparadas

```text
Turmas: prepareEnrollmentClassLink()
Financeiro: prepareEnrollmentFinancialLink() e prepareEnrollmentFinancialObligation()
Agenda: prepareEnrollmentScheduleLink()
Notificacoes: prepareEnrollmentNotification()
Mobile: getStudentEnrollmentMobileSummary()
Dashboard: getEnrollmentOperationalDashboard()
Auditoria: recordEnrollmentAuditEvent()
```

Todas permanecem sem side effects reais quando documentadas como preparatorias.

## Testes e smoke

Testes existentes cobrem:

```text
DRAFT create/reuse
DRAFT/ACTIVE reads
find by id
confirmacao DRAFT -> ACTIVE com confirmedAt/confirmedBy
bloqueio de confirmacao quando ACTIVE existe
status summary NONE/DRAFT/ACTIVE/CONFLICT
guards allowed/blocked/conflict
facade delegation
eventos internos
contratos preparatorios
mobile-safe summary
integracoes preparatorias Financeiro/Agenda/Notificacoes
```

Smoke review:

```text
DRAFT_CREATE_FLOW_OK=true
DRAFT_REUSE_FLOW_OK=true
DRAFT_DUPLICATE_BLOCKED=true
DRAFT_DUPLICATE_ERROR_HANDLED=true
DRAFT_CONFIRMATION_OK=true
CONFIRMATION_AUDIT_OK=true
ACTIVE_GUARD_OK=true
STATUS_SUMMARY_OK=true
FACADE_OK=true
NO_FINANCIAL_SIDE_EFFECTS=true
NO_CLASS_SIDE_EFFECTS=true
NO_TEST_DATA_LEFT=true
```

## Validacoes executadas

```text
node --check backend/src/domains/enrollments/application/facades/enrollment.facade.js
node --check backend/src/domains/enrollments/application/services/enrollment-application.service.js
node --check backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment.repository.js
node --check controllers/routes criados
node --test backend/src/domains/enrollments/application/tests/*.test.js
cmd /c npm run build
```

## Checklist de deploy

Checklist detalhada criada em:

```text
docs/BACKEND/ENROLLMENTS_PRODUCTION_CHECKLIST.md
```

Resumo:

```text
validar backup
validar migrations status
validar generated columns/index
validar auth/roles para admin routes
rodar node --check
rodar testes do dominio
rodar build
executar smoke de DRAFT/reuse/confirmacao em ambiente controlado
monitorar logs de duplicidade, lock timeout e confirmacao
```

## Rollback

Rollback tecnico disponivel:

```text
20260629232350_add_enrollment_confirmation_audit_columns.js down
20260629190607_add_active_draft_unique_constraint_to_enrollments.js down
DROP TABLE IF EXISTS enrollments no SQL base, somente em rollback destrutivo planejado
```

Cuidados:

```text
rollback de confirmed_at/confirmed_by remove auditoria de confirmacao
rollback do unique index reabre risco de DRAFT duplicado fisico
rollback da tabela e destrutivo e deve depender de backup/restauracao
```

## Observabilidade

Sinais a monitorar:

```text
DRAFT_ENROLLMENT_LOCK_TIMEOUT
DRAFT_ENROLLMENT_LOCK_FAILED
DRAFT_ENROLLMENT_LOCK_RELEASE_FAILED
DRAFT_ENROLLMENT_DUPLICATE_CONSTRAINT
ACTIVE_ENROLLMENT_ALREADY_EXISTS
ENROLLMENT_PROCEED_CONFLICT
CONFIRM_DRAFT_ENROLLMENT_INVALID_STATUS
Internal event dispatch failed
```

Recomendacao:

```text
padronizar logger estruturado do backend antes de transformar logs em auditoria persistente
propagar requestId/correlationId ate chamadas de facade em endpoints administrativos
```

## Riscos remanescentes

Nao criticos para esta sprint:

```text
sem lock especifico de confirmacao concorrente
confirmed_at sem indice dedicado para dashboard futuro
enrollments sem unit_id/tenant_id para dashboard multi-unidade
auditoria completa persistente ainda nao existe
contratos de Turmas/Financeiro/Agenda/Notificacoes ainda dependem de tabelas de link futuras
rotas internas existem como factory; manter nao montadas ate politica interna ser aprovada
logs legados fora do dominio ainda precisam saneamento
```

## Proximos passos pos-9.60

```text
decidir unidade/tenant no modelo de Matriculas antes de dashboard real
avaliar lock/update condicional para confirmacao em alta concorrencia
criar modulo/tabela de auditoria com politica de retencao
criar tabelas de link para Turmas, Financeiro, Agenda e Notificacoes quando os fluxos reais forem aprovados
adicionar testes e2e admin com banco controlado
padronizar logger/requestId/correlationId em todos os endpoints novos
```

## Resultado esperado

```text
ENROLLMENT_MODULE_HARDENED=true
ARCHITECTURE_REVIEW_COMPLETED=true
SECURITY_REVIEW_COMPLETED=true
CONCURRENCY_REVIEW_COMPLETED=true
DATABASE_REVIEW_COMPLETED=true
MIGRATION_REVIEW_COMPLETED=true
FACADE_REVIEW_COMPLETED=true
SMOKE_TESTS_REVIEWED=true
PRODUCTION_CHECKLIST_CREATED=true
NO_CRITICAL_BLOCKERS_FOUND=true
```
