# Enrollments Production Checklist

## Objetivo

Checklist operacional para liberar o modulo de Matriculas em producao com o
menor risco possivel, preservando compatibilidade, seguranca e rollback.

## 1. Pre-deploy

```text
[ ] Confirmar backup recente do banco.
[ ] Confirmar janela de deploy para migrations manuais.
[ ] Confirmar versao MySQL/Percona e suporte a generated columns VIRTUAL indexadas.
[ ] Confirmar que backend usa variaveis de ambiente corretas.
[ ] Confirmar que /public/enrollments nao sera alterado neste deploy.
[ ] Confirmar que frontend nao aponta para endpoint interno inseguro.
```

## 2. Banco

```text
[ ] Verificar se tabela people existe.
[ ] Verificar se tabela person_profiles existe.
[ ] Verificar se tabela enrollments existe.
[ ] Rodar status da migration de constraint DRAFT.
[ ] Confirmar NO_DUPLICATE_DRAFTS_FOUND=true antes de criar unique index.
[ ] Confirmar generated columns active_draft_student_person_id e active_draft_student_profile_id.
[ ] Confirmar unique index ux_enrollments_active_draft_student_profile.
[ ] Rodar status da migration confirmed_at/confirmed_by.
[ ] Confirmar confirmed_at DATETIME NULL.
[ ] Confirmar confirmed_by VARCHAR(191) NULL.
[ ] Confirmar indices atuais sem remover nenhum indice existente.
```

Comandos de referencia:

```bash
node backend/src/database/migrations/20260629190607_add_active_draft_unique_constraint_to_enrollments.js status
node backend/src/database/migrations/20260629232350_add_enrollment_confirmation_audit_columns.js status
```

## 3. Rotas e seguranca

```text
[ ] Confirmar que /admin/enrollments exige requireAuth.
[ ] Confirmar que /admin/enrollments exige canManageSystem.
[ ] Confirmar que /api/admin/enrollments tem a mesma protecao.
[ ] Confirmar que /internal/enrollments nao esta montada sem aprovacao.
[ ] Confirmar que controllers nao acessam repository ou SQL diretamente.
[ ] Confirmar que confirmedBy e resolvido por body ou usuario autenticado.
[ ] Confirmar que erros controlados nao retornam stack trace.
```

## 4. Validacoes tecnicas

```bash
node --check backend/src/domains/enrollments/application/facades/enrollment.facade.js
node --check backend/src/domains/enrollments/application/services/enrollment-application.service.js
node --check backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment.repository.js
node --check backend/src/domains/enrollments/presentation/controllers/enrollment-admin.controller.js
node --check backend/src/domains/enrollments/presentation/controllers/enrollment-internal.controller.js
node --check backend/src/domains/enrollments/presentation/routes/enrollment-admin.routes.js
node --check backend/src/domains/enrollments/presentation/routes/enrollment-internal.routes.js
node --test backend/src/domains/enrollments/application/tests/*.test.js
cmd /c npm run build
```

## 5. Smoke funcional controlado

Executar em ambiente controlado:

```text
[ ] Criar DRAFT para studentPersonId/studentProfileId valido.
[ ] Repetir criacao e confirmar reuso do DRAFT.
[ ] Confirmar que duplicidade fisica de DRAFT e bloqueada.
[ ] Ler current-draft.
[ ] Confirmar DRAFT -> ACTIVE.
[ ] Confirmar confirmed_at preenchido.
[ ] Confirmar confirmed_by preenchido.
[ ] Ler current-active.
[ ] Validar status summary ACTIVE.
[ ] Tentar confirmar novo DRAFT com ACTIVE existente e confirmar bloqueio.
[ ] Confirmar que nenhum financeiro foi criado.
[ ] Confirmar que nenhuma turma foi vinculada.
[ ] Confirmar que nenhuma agenda foi criada.
[ ] Confirmar que nenhuma notificacao foi enviada.
[ ] Remover dados de teste ou executar rollback transacional.
```

Marcadores esperados:

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

## 6. Observabilidade

Monitorar:

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

## 7. Rollback

Rollback de auditoria de confirmacao:

```bash
node backend/src/database/migrations/20260629232350_add_enrollment_confirmation_audit_columns.js down
```

Rollback de constraint DRAFT:

```bash
node backend/src/database/migrations/20260629190607_add_active_draft_unique_constraint_to_enrollments.js down
```

Cuidados:

```text
[ ] Nao executar rollback de constraint DRAFT sem aceitar risco de duplicidade fisica.
[ ] Nao remover confirmed_at/confirmed_by sem aceitar perda de auditoria de confirmacao.
[ ] Rollback da tabela enrollments e destrutivo; usar apenas com plano formal e backup.
```

## 8. Pos-deploy

```text
[ ] Validar login admin/coordenador.
[ ] Validar GET /admin/enrollments/status com escopo conhecido.
[ ] Validar GET /admin/enrollments/current-draft.
[ ] Validar GET /admin/enrollments/current-active.
[ ] Validar POST /admin/enrollments/:enrollmentId/confirm em ambiente controlado.
[ ] Monitorar logs por 24h para locks, duplicidades e erros controlados.
[ ] Registrar qualquer CONFLICT para tratamento operacional.
```
