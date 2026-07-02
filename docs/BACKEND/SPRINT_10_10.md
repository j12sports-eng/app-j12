# Sprint 10.10 - Go-live Tecnico do Fluxo de Matriculas

## Objetivo

Consolidar a revisao tecnica do fluxo de Matriculas para liberacao controlada,
cobrindo backend, API, frontend administrativo, banco, migrations, seguranca,
testes, smoke, deploy e rollback.

## Decisao Tecnica

Go-live tecnico aprovado.

Nao foi criada funcionalidade nova e nao houve alteracao de schema, migration,
financeiro, turmas, agenda, notificacoes, mobile, legado ou regras backend ja
estabilizadas.

## Fluxo Validado

```text
Pessoa
  -> Matricula DRAFT
  -> Consulta administrativa
  -> Confirmacao ACTIVE
  -> Auditoria confirmed_at/confirmed_by
  -> Eventos internos sem integracoes externas automaticas
  -> Visualizacao no frontend administrativo
```

## Backend Validado

Arquivos principais revisados:

```text
backend/src/domains/enrollments/application/facades/enrollment.facade.js
backend/src/domains/enrollments/application/services/enrollment-application.service.js
backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment.repository.js
backend/src/domains/enrollments/presentation/controllers/enrollment-admin.controller.js
backend/src/domains/enrollments/presentation/controllers/enrollment-public.controller.js
backend/src/domains/enrollments/presentation/routes/enrollment-admin.routes.js
backend/src/domains/enrollments/presentation/routes/enrollment-public.routes.js
backend/src/domains/enrollments/presentation/routes/enrollment-internal.routes.js
```

Confirmado:

```text
EnrollmentFacade centraliza o contrato do dominio
controllers chamam facade e nao acessam SQL diretamente
DRAFT e criado/reusado de forma idempotente
confirmacao DRAFT -> ACTIVE valida status e ACTIVE duplicado
auditoria de confirmacao preenche confirmed_at e confirmed_by
status summary retorna NONE, DRAFT, ACTIVE ou CONFLICT
event dispatcher padrao nao chama filas, HTTP, financeiro, agenda ou notificacoes
```

## Endpoints Envolvidos

API administrativa:

```text
GET  /admin/enrollments/status
GET  /admin/enrollments/current-draft
GET  /admin/enrollments/current-active
POST /admin/enrollments/:enrollmentId/confirm
```

Tambem montada com prefixo:

```text
/api/admin/enrollments
```

API publica segura para consumidores frontend:

```text
GET  /enrollments/status
GET  /enrollments/current-draft
GET  /enrollments/current-active
POST /enrollments/:enrollmentId/confirm
```

Tambem montada com prefixo:

```text
/api/enrollments
```

Observacao: apesar do nome "public", essa API exige `requireAuth` e
`canManageSystem`.

API interna:

```text
/internal/enrollments
```

Existe como factory preparada, mas nao esta montada no servidor.

## Frontend Administrativo

Tela real:

```text
/admin/enrollments
```

Arquivos revisados:

```text
src/routes/admin/enrollments.tsx
src/hooks/useEnrollmentStatus.ts
src/lib/enrollments-api.ts
src/components/enrollments/EnrollmentStatusBadge.tsx
src/components/AppSidebar.tsx
```

Confirmado:

```text
rota protegida por ProtectedRoute roles admin/coordenador
menu lateral expoe Matriculas para admin/coordenador
API client centralizado usa src/lib/api.ts
sem URL absoluta hardcoded no client de Matriculas
estados NONE, DRAFT, ACTIVE e CONFLICT renderizados
confirmacao guardada por role e por status consolidado
loading, success, error e empty state presentes
```

## Banco e Migrations

Banco validado por status read-only:

```text
Percona Server 5.7.44-48
NO_DUPLICATE_DRAFTS_FOUND=true
CONFIRMATION_AUDIT_COLUMNS_CREATED=true
ENROLLMENT_CLASS_LINK_TABLE_CREATED=true
FOREIGN_KEYS_CREATED=true
INDEXES_CREATED=true
UNIQUE_STRATEGY_DEFINED=true
```

Tabela `enrollments`:

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
active_draft_student_person_id VIRTUAL GENERATED
active_draft_student_profile_id VIRTUAL GENERATED
```

Constraint fisica:

```text
ux_enrollments_active_draft_student_profile(
  active_draft_student_person_id,
  active_draft_student_profile_id
)
```

Tabela de vinculo com turma:

```text
enrollment_class_links
```

Estado observado:

```text
rowCount=0
FK enrollment_id -> enrollments.id
FK class_id -> j12_turmas.id
unique index ux_enrollment_class_links_active
```

## Variaveis de Ambiente

Obrigatorias ou recomendadas para producao:

```text
DATABASE_URL ou DB_HOST/DB_USER/DB_NAME
DB_PASSWORD
DB_PORT
DB_CONNECTION_LIMIT
DB_CONNECT_TIMEOUT
DB_USE_SSL, se aplicavel
JWT_SECRET ou AUTH_JWT_SECRET ou APP_JWT_SECRET ou SESSION_SECRET
JWT_EXPIRES ou JWT_EXPIRES_IN
HOST
PORT
REQUEST_LIMIT ou REQUEST_BODY_LIMIT_BYTES
CORS_ORIGIN ou CORS_ALLOWED_ORIGINS
SSR_API_URL ou API_BASE_URL ou API_TARGET
VITE_API_URL ou VITE_API_BASE_URL
VITE_API_TIMEOUT_MS ou SSR_API_TIMEOUT_MS
NODE_ENV=production
```

Risco operacional: `backend/src/config/db.js` possui defaults historicos para
host, usuario e database. Em producao, nao depender desses defaults; configurar
explicitamente `.env`/secrets do ambiente antes do deploy.

## Seguranca

Checklist revisado:

```text
admin routes usam requireAuth
admin routes usam canManageSystem
public enrollment routes continuam autenticadas/autorizadas
internal routes preparadas nao estao montadas
controllers retornam erros controlados sem stack trace nos fluxos mapeados
confirmedBy e lido do body ou usuario autenticado
frontend bloqueia confirmacao para usuario sem role admin/coordenador
frontend usa API client centralizado
dispatcher interno nao aciona integracoes externas
```

## Validacoes Executadas

```bash
node --test backend/src/domains/enrollments/application/tests/*.test.js
node backend/src/database/migrations/20260629190607_add_active_draft_unique_constraint_to_enrollments.js status
node backend/src/database/migrations/20260629232350_add_enrollment_confirmation_audit_columns.js status
node backend/src/database/migrations/20260701103000_add_enrollment_class_links_table.js status
node sprint-10-10-go-live-smoke.tmp.cjs
cmd /c npm run build
```

## Smoke Completo

Marcadores validados:

```text
ENROLLMENT_GO_LIVE_READY=true
DRAFT_FLOW_OK=true
DRAFT_IDEMPOTENCY_OK=true
DRAFT_UNIQUE_CONSTRAINT_OK=true
CONFIRMATION_FLOW_OK=true
CONFIRMATION_AUDIT_OK=true
ACTIVE_GUARD_OK=true
STATUS_SUMMARY_OK=true
ADMIN_API_OK=true
ADMIN_UI_OK_OR_DOCUMENTED=true
NO_UNSAFE_PUBLIC_ROUTE=true
NO_FINANCIAL_SIDE_EFFECTS_UNLESS_ENABLED=true
NO_CLASS_SIDE_EFFECTS_UNLESS_ENABLED=true
NO_SCHEDULE_SIDE_EFFECTS_UNLESS_ENABLED=true
NO_NOTIFICATION_SIDE_EFFECTS_UNLESS_ENABLED=true
NO_TEST_DATA_LEFT=true
```

O smoke funcional foi executado em memoria e nao gravou dados no banco. As
validacoes de banco foram read-only por `status` das migrations.

## Deploy Recomendado

```text
1. Confirmar backup recente do banco.
2. Confirmar secrets/variaveis de producao.
3. Rodar status das migrations de Matriculas.
4. Confirmar NO_DUPLICATE_DRAFTS_FOUND=true.
5. Executar cmd /c npm run build.
6. Executar testes do dominio de Matriculas.
7. Publicar backend e frontend.
8. Validar login admin/coordenador.
9. Validar /admin/enrollments com escopo conhecido.
10. Monitorar logs de lock, duplicidade e confirmacao por 24h.
```

## Rollback

Rollback de aplicacao:

```text
retornar para release anterior do backend/frontend
manter banco sem down destrutivo por padrao
```

Rollback de auditoria, somente com decisao explicita:

```bash
node backend/src/database/migrations/20260629232350_add_enrollment_confirmation_audit_columns.js down
```

Rollback de constraint DRAFT, somente com decisao explicita:

```bash
node backend/src/database/migrations/20260629190607_add_active_draft_unique_constraint_to_enrollments.js down
```

Rollback de `enrollment_class_links`:

```bash
node backend/src/database/migrations/20260701103000_add_enrollment_class_links_table.js down
```

A migration da tabela de vinculo recusa drop quando houver linhas, exigindo
plano formal de limpeza/backup.

## Riscos Remanescentes

```text
confirmed_at ainda nao possui indice dedicado para dashboards por periodo
enrollments nao possui unit_id/tenant_id para escopo multi-unidade
busca administrativa ainda depende de studentPersonId/studentProfileId, nao de nome/documento
rotas /enrollments continuam protegidas, mas o nome pode causar confusao operacional
defaults historicos de DB devem ser substituidos por secrets explicitos em producao
integracoes reais com Financeiro, Agenda e Notificacoes continuam bloqueadas/preparatorias salvo pontos ja documentados
```

## Resultado

Modulo liberado para uso tecnico controlado por admin/coordenador, condicionado
a checklist de deploy, backup e monitoramento pos-deploy.
