# Financial Go-live Checklist

## Decisao

```text
GO-LIVE PARCIAL/BLOQUEADO
```

Liberado tecnicamente:

- API administrativa protegida;
- UI administrativa em `/admin/financeiro`;
- leitura de obrigacoes por matricula;
- resumo financeiro por aluno/perfil;
- status interno `PREPARED`, `PENDING`, `OVERDUE`, `PAID`, `CANCELLED`;
- baixa/cancelamento/inadimplencia internos;
- idempotencia fisica da obrigacao inicial;
- rollback documentado.

Bloqueado para go-live completo:

- criacao automatica universal da obrigacao inicial apos Matricula `ACTIVE`;
- criacao quando o contrato nao resolver plano, valor, vencimento, ciclo e moeda;
- qualquer gateway, Pix, boleto, cartao, conciliacao ou pagamento real.

## Banco

Confirmar em homologacao/producao:

```sql
SHOW TABLES LIKE 'enrollment_financial_obligations';
SHOW INDEX FROM enrollment_financial_obligations;
SHOW CREATE TABLE enrollment_financial_obligations;
```

Obrigatorio:

```text
FK enrollment_id -> enrollments.id
UNIQUE enrollment_id + obligation_type
indices por enrollment_id, status e due_date
campos de auditoria created_at, updated_at, cancelled_at, cancelled_by, metadata_json
```

Comando da migration:

```bash
node backend/src/database/migrations/20260702120000_create_enrollment_financial_obligations_table.js status
```

## Backend

Rotas administrativas:

```text
GET /api/admin/financial/enrollments/:enrollmentId/obligations
GET /api/admin/financial/students/:studentPersonId/:studentProfileId/summary
POST /api/admin/financial/obligations/:obligationId/mark-paid
POST /api/admin/financial/obligations/:obligationId/cancel
POST /api/admin/financial/obligations/:obligationId/mark-overdue
```

Protecao esperada:

```text
requireAuth + canManageSystem
```

Arquitetura obrigatoria:

```text
controller -> FinancialFacade -> FinancialApplicationService -> repository
```

Nao permitido:

```text
controller acessando SQL/repository diretamente
rota publica sem auth
gateway externo
pagamento real
notificacao financeira automatica
escrita em financeiro legado
```

## Frontend

Rota:

```text
/admin/financeiro
```

Protecao:

```text
admin/coordenador
```

Validar visualmente:

```text
consulta por matricula
consulta por pessoa/perfil
status PREPARED
status PENDING
status PAID
status OVERDUE
status CANCELLED
modal de baixa
modal de cancelamento
marcacao de inadimplencia
loading
erro
empty state
```

## Contrato financeiro

Confirmar antes de liberar criacao automatica:

```text
planId resolvido
amount resolvido
dueDay resolvido
firstDueDate resolvido
billingCycle resolvido
currency resolvido
studentPersonId/studentProfileId resolvidos
Enrollment ACTIVE
```

Se qualquer item falhar:

```text
nao criar obrigacao real
retornar blockers
registrar erro controlado
nao inventar valor/vencimento/plano
```

## Status

Permitido:

```text
PREPARED -> PAID
PREPARED -> CANCELLED
PREPARED -> OVERDUE
PENDING -> PAID
PENDING -> CANCELLED
PENDING -> OVERDUE
OVERDUE -> PAID
OVERDUE -> CANCELLED
```

Bloqueado:

```text
PAID -> PENDING
PAID -> CANCELLED
CANCELLED -> PAID
CANCELLED -> PENDING
CANCELLED -> OVERDUE
```

## Validacoes

Executar:

```bash
cmd /c npm run build
node --test backend/src/domains/financeiro/application/tests/*.test.js
node --test backend/src/domains/financeiro/infrastructure/repositories/*.test.js
node --test backend/src/domains/financeiro/presentation/tests/*.test.js
node --test backend/src/domains/enrollments/application/tests/*.test.js
npx tsc --noEmit --pretty false
```

Executar `node --check` nos arquivos JS alterados.

Resultado da Sprint 12.10:

```text
build aprovado
testes Financeiro aprovados
testes Matriculas aprovados
node --check aprovado
typecheck frontend aprovado
lint frontend escopado aprovado
status read-only da migration aprovado
```

## Smoke

Marcadores desta revisao:

```text
FINANCIAL_GO_LIVE_PARTIAL=true
FINANCIAL_FACADE_OK=true
FINANCIAL_GAPS_DOCUMENTED=true
BILLING_CONTRACT_BLOCKERS_DOCUMENTED=true
INITIAL_OBLIGATION_BLOCKERS_DOCUMENTED=true
NO_UNSAFE_PUBLIC_ROUTE=true
NO_GATEWAY_INTEGRATION=true
NO_REAL_PAYMENT_PROCESSED=true
NO_TEST_DATA_LEFT=true
```

## Rollback

Aplicacao:

```text
1. remover mount de /admin/financial e /api/admin/financial
2. remover painel FinancialAdminEnrollmentPanel de /admin/financeiro
3. redeploy/restart PM2
```

Banco:

```bash
node backend/src/database/migrations/20260702120000_create_enrollment_financial_obligations_table.js down
```

Condicao:

```text
rollback de banco so remove tabela vazia; se houver linhas, exige plano de backup/limpeza.
```

## Deploy recomendado

```bash
cmd /c npm run build
cmd /c pm2 reload ecosystem.config.cjs --update-env
```

Validar:

```text
/api/health
login admin/coordenador
/admin/financeiro
consulta de obrigacao existente
acao de status em dado controlado
logs sem gateway/pagamento externo
```
