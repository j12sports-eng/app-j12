# Enrollments Go-live Checklist

## Objetivo

Checklist operacional para liberar o fluxo de Matriculas em uso tecnico
controlado, com foco em estabilidade, seguranca, banco, deploy, monitoramento e
rollback.

## Go/No-go

Go-live tecnico: aprovado para uso controlado por `admin` e `coordenador`.

Condicoes obrigatorias antes de producao:

```text
[ ] Backup recente validado.
[ ] Secrets de producao configurados explicitamente.
[ ] Build aprovado no mesmo commit/release.
[ ] Testes do dominio de Matriculas aprovados.
[ ] Status das migrations de Matriculas aprovado.
[ ] Operador responsavel pelo rollback definido.
[ ] Janela de monitoramento pos-deploy definida.
```

## Pre-deploy

```text
[ ] Confirmar branch/tag/release candidata.
[ ] Confirmar que nao ha migration pendente fora do plano.
[ ] Confirmar que nao ha massa de teste permanente no banco.
[ ] Confirmar Percona/MySQL compativel com generated columns VIRTUAL indexadas.
[ ] Confirmar que backend e frontend usam as mesmas URLs/prefixos esperados.
[ ] Confirmar que /internal/enrollments nao foi montada sem aprovacao.
[ ] Confirmar que /admin/enrollments exige autenticacao e autorizacao.
```

## Variaveis de Ambiente

Backend:

```text
[ ] DATABASE_URL ou DB_HOST/DB_USER/DB_NAME.
[ ] DB_PASSWORD.
[ ] DB_PORT.
[ ] DB_CONNECTION_LIMIT.
[ ] DB_CONNECT_TIMEOUT.
[ ] DB_USE_SSL, se aplicavel.
[ ] JWT_SECRET ou AUTH_JWT_SECRET ou APP_JWT_SECRET ou SESSION_SECRET.
[ ] JWT_EXPIRES ou JWT_EXPIRES_IN.
[ ] HOST.
[ ] PORT.
[ ] REQUEST_LIMIT ou REQUEST_BODY_LIMIT_BYTES.
[ ] CORS_ORIGIN ou CORS_ALLOWED_ORIGINS.
[ ] NODE_ENV=production.
```

Frontend/SSR:

```text
[ ] SSR_API_URL ou API_BASE_URL ou API_TARGET.
[ ] VITE_API_URL ou VITE_API_BASE_URL.
[ ] VITE_API_TIMEOUT_MS ou SSR_API_TIMEOUT_MS.
```

Observacao: nao depender dos defaults historicos de banco em
`backend/src/config/db.js` no ambiente de producao.

## Banco

Executar status read-only:

```bash
node backend/src/database/migrations/20260629190607_add_active_draft_unique_constraint_to_enrollments.js status
node backend/src/database/migrations/20260629232350_add_enrollment_confirmation_audit_columns.js status
node backend/src/database/migrations/20260701103000_add_enrollment_class_links_table.js status
```

Esperado:

```text
[ ] enrollments existe.
[ ] confirmed_at existe como DATETIME NULL.
[ ] confirmed_by existe como VARCHAR(191) NULL.
[ ] active_draft_student_person_id existe como generated column.
[ ] active_draft_student_profile_id existe como generated column.
[ ] ux_enrollments_active_draft_student_profile existe e e UNIQUE.
[ ] NO_DUPLICATE_DRAFTS_FOUND=true.
[ ] enrollment_class_links existe, se a Sprint 10.3 estiver aplicada.
[ ] FKs de enrollment_class_links existem.
[ ] unique index ux_enrollment_class_links_active existe.
```

## Seguranca

```text
[ ] /admin/enrollments usa requireAuth.
[ ] /admin/enrollments usa canManageSystem.
[ ] /api/admin/enrollments usa a mesma protecao.
[ ] /enrollments e /api/enrollments continuam protegidas.
[ ] /internal/enrollments nao esta exposta.
[ ] Controllers chamam EnrollmentFacade.
[ ] Controllers nao acessam repository/SQL diretamente.
[ ] Erros controlados nao retornam stack trace.
[ ] Frontend usa src/lib/api.ts.
[ ] Frontend nao possui URL absoluta hardcoded para Matriculas.
[ ] Botao de confirmacao exige role admin/coordenador.
[ ] Dispatcher interno nao chama integracoes externas.
```

## Build e Testes

Executar:

```bash
cmd /c npm run build
node --test backend/src/domains/enrollments/application/tests/*.test.js
```

Se houver alteracao de codigo JS backend na release, executar `node --check` nos
arquivos alterados.

Nao ha build separado em pasta `frontend/`; o frontend vive em `src/` e e
coberto pelo build raiz.

## Smoke Funcional

Ambiente controlado:

```text
[ ] Criar DRAFT para studentPersonId/studentProfileId valido.
[ ] Repetir criacao e confirmar reuso.
[ ] Validar bloqueio fisico de DRAFT duplicado.
[ ] Consultar status summary e confirmar DRAFT.
[ ] Confirmar DRAFT -> ACTIVE.
[ ] Validar confirmed_at preenchido.
[ ] Validar confirmed_by preenchido.
[ ] Consultar status summary e confirmar ACTIVE.
[ ] Validar guard contra ACTIVE duplicado.
[ ] Validar tela /admin/enrollments.
[ ] Confirmar que nenhum financeiro foi criado.
[ ] Confirmar que nenhuma agenda foi criada.
[ ] Confirmar que nenhuma notificacao foi enviada.
[ ] Confirmar que nenhuma massa de teste ficou no banco.
```

Marcadores esperados:

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

## Deploy

```text
[ ] Colocar release em manutencao/janela combinada, se necessario.
[ ] Rodar build.
[ ] Rodar testes do dominio.
[ ] Rodar status das migrations.
[ ] Publicar backend.
[ ] Publicar frontend.
[ ] Reiniciar processos.
[ ] Validar /health ou rota de saude equivalente.
[ ] Validar login admin/coordenador.
[ ] Validar /admin/enrollments.
[ ] Executar consulta com aluno/perfil conhecido.
[ ] Registrar horario de inicio do monitoramento.
```

## Monitoramento Pos-deploy

Monitorar por pelo menos 24h:

```text
DRAFT_ENROLLMENT_LOCK_TIMEOUT
DRAFT_ENROLLMENT_LOCK_FAILED
DRAFT_ENROLLMENT_LOCK_RELEASE_FAILED
DRAFT_ENROLLMENT_DUPLICATE_CONSTRAINT
ACTIVE_ENROLLMENT_ALREADY_EXISTS
ENROLLMENT_PROCEED_CONFLICT
CONFIRM_DRAFT_ENROLLMENT_INVALID_STATUS
CONFIRM_DRAFT_ENROLLMENT_NOT_FOUND
Internal event dispatch failed
erros 401/403 em /admin/enrollments
erros 5xx em /admin/enrollments
```

## Rollback

Aplicacao:

```text
[ ] Reverter backend/frontend para release anterior.
[ ] Reiniciar processos.
[ ] Validar login e rotas principais.
```

Banco:

```text
[ ] Preferir rollback de aplicacao sem down de banco.
[ ] Executar down de migrations somente com aprovacao explicita.
[ ] Confirmar backup antes de remover auditoria/constraint/tabela.
```

Comandos disponiveis:

```bash
node backend/src/database/migrations/20260629232350_add_enrollment_confirmation_audit_columns.js down
node backend/src/database/migrations/20260629190607_add_active_draft_unique_constraint_to_enrollments.js down
node backend/src/database/migrations/20260701103000_add_enrollment_class_links_table.js down
```

Impactos:

```text
rollback de confirmed_at/confirmed_by remove auditoria de confirmacao
rollback da constraint DRAFT reabre risco de duplicidade fisica
rollback de enrollment_class_links falha se a tabela tiver linhas
rollback da tabela enrollments e destrutivo e nao faz parte do go-live padrao
```

## Riscos Remanescentes

```text
[ ] confirmed_at sem indice dedicado para dashboards por periodo.
[ ] enrollments sem unit_id/tenant_id.
[ ] busca admin ainda exige ids tecnicos de pessoa/perfil.
[ ] rotas /enrollments protegidas podem ser confundidas com API publica aberta pelo nome.
[ ] integracoes externas reais devem continuar bloqueadas ate schema/fila/idempotencia proprios.
```
