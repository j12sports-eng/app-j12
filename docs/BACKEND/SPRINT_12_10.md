# Sprint 12.10 - Go-live tecnico do modulo Financeiro de Matriculas

## Objetivo

Realizar o hardening e a revisao final do Financeiro vinculado a Matriculas,
consolidando banco, application layer, repository, API administrativa,
frontend administrativo, seguranca, testes, rollback e riscos de producao.

## Decisao tecnica

Go-live parcial/bloqueado.

O modulo esta tecnicamente pronto para:

- manter a tabela interna de obrigacoes financeiras de matricula;
- garantir idempotencia fisica por `enrollment_id + obligation_type`;
- consultar obrigacoes por matricula;
- consultar resumo financeiro por aluno/perfil;
- operar status interno por API administrativa protegida;
- visualizar e operar a interface administrativa sem gateway externo.

O go-live completo do fluxo ponta a ponta permanece bloqueado para criacao
automatica real porque ainda nao ha fonte canonica operacional obrigatoria para
resolver plano, valor, vencimento, ciclo e moeda de qualquer `enrollment.id` em
producao/homologacao. O proprio billing contract retorna blockers quando esses
dados nao estao disponiveis.

## Fluxo validado

```text
Matricula ACTIVE
  -> contrato financeiro via FinancialFacade
  -> blockers explicitos se plano/valor/vencimento nao forem resolvidos
  -> persistencia idempotente quando contrato e repository estiverem prontos
  -> consulta administrativa em /admin/financial
  -> status interno PREPARED/PENDING/OVERDUE/PAID/CANCELLED
  -> baixa/cancelamento/inadimplencia internos sem gateway
  -> visualizacao em /admin/financeiro
```

## Arquitetura revisada

```text
controllers -> FinancialFacade -> FinancialApplicationService -> repository
```

Arquivos principais:

```text
backend/src/domains/financeiro/application/facades/financial.facade.js
backend/src/domains/financeiro/application/services/financial-application.service.js
backend/src/domains/financeiro/infrastructure/repositories/mysql-enrollment-financial-obligation.repository.js
backend/src/domains/financeiro/presentation/controllers/financial-admin.controller.js
backend/src/domains/financeiro/presentation/routes/financial-admin.routes.js
src/features/financial/api/financial.api.ts
src/features/financial/pages/FinancialAdminEnrollmentPanel.tsx
```

## Banco

Tabela:

```text
enrollment_financial_obligations
```

Validado por migration:

```text
backend/src/database/migrations/20260702120000_create_enrollment_financial_obligations_table.js
```

Colunas criticas:

```text
id
enrollment_id
obligation_type
status
amount
currency
plan_id
due_date
source
created_by
created_at
updated_at
cancelled_at
cancelled_by
metadata_json
```

Restricoes:

```text
PRIMARY KEY (id)
UNIQUE (enrollment_id, obligation_type)
FK enrollment_financial_obligations.enrollment_id -> enrollments.id
ON DELETE RESTRICT
ON UPDATE CASCADE
```

Indices:

```text
idx_enrollment_financial_obligations_enrollment_id
idx_enrollment_financial_obligations_status
idx_enrollment_financial_obligations_due_date
ux_enrollment_financial_obligations_enrollment_type
```

Compatibilidade documentada:

```text
MySQL/Percona 5.7
InnoDB
utf8mb4_unicode_ci
```

## Obrigacao financeira inicial

Metodo:

```js
createInitialEnrollmentFinancialObligation({
  enrollmentId,
  requestedBy,
});
```

Comportamento revisado:

- valida Matricula via reader de aplicacao;
- exige status `ACTIVE`;
- prepara contrato financeiro;
- bloqueia sem escrita se houver blockers;
- persiste somente com repository idempotente;
- reutiliza registro existente em duplicidade controlada;
- nao cria mensalidade legada;
- nao cria cobranca externa;
- nao cria pagamento;
- nao chama gateway.

Status inicial persistido:

```text
PREPARED
```

## Contrato financeiro

Contrato:

```js
prepareEnrollmentBillingContract();
```

Blockers documentados:

```text
STUDENT_SCOPE_MISSING
ENROLLMENT_STATUS_NOT_RESOLVED
ENROLLMENT_NOT_ACTIVE
BILLING_PLAN_NOT_RESOLVED
BILLING_AMOUNT_NOT_RESOLVED
BILLING_DUE_DAY_NOT_RESOLVED
BILLING_FIRST_DUE_DATE_NOT_RESOLVED
BILLING_CYCLE_NOT_RESOLVED
BILLING_CURRENCY_NOT_RESOLVED
```

Risco de producao:

```text
O contrato pode continuar bloqueando criacao real enquanto nao houver fonte
canonica de plano/valor/vencimento por Matricula.
```

## Status financeiro

Status suportados:

```text
PREPARED
PENDING
OVERDUE
PAID
CANCELLED
```

Transicoes permitidas:

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

Transicoes bloqueadas:

```text
PAID -> PENDING
PAID -> CANCELLED
CANCELLED -> PAID
CANCELLED -> PENDING
CANCELLED -> OVERDUE
```

Auditoria:

```text
metadata_json.statusAudit[]
metadata_json.statusFlowVersion
cancelled_at
cancelled_by
```

## API administrativa

Base registrada:

```text
/admin/financial
/api/admin/financial
```

Endpoints:

```text
GET /admin/financial/enrollments/:enrollmentId/obligations
GET /admin/financial/students/:studentPersonId/:studentProfileId/summary
POST /admin/financial/obligations/:obligationId/mark-paid
POST /admin/financial/obligations/:obligationId/cancel
POST /admin/financial/obligations/:obligationId/mark-overdue
```

Protecao:

```text
requireAuth + canManageSystem
```

Controller:

```text
FinancialAdminController chama somente FinancialFacade.
```

Nao acessa:

```text
repositories diretamente
SQL diretamente
Prisma
tabelas legadas
gateway
```

## Frontend administrativo

Tela:

```text
/admin/financeiro
```

Protecao:

```text
ProtectedRoute roles=["admin", "coordenador"]
```

Componentes:

```text
src/features/financial/pages/FinancialAdminEnrollmentPanel.tsx
src/features/financial/components/FinancialObligationCard.tsx
src/features/financial/components/FinancialStatusBadge.tsx
```

Hardening aplicado na Sprint 12.10:

```text
PREPARED passou a ser tratado na UI como estado aberto, alinhado ao backend.
```

## Seguranca

Checklist:

```text
rotas administrativas protegidas=true
controllers usam facade=true
frontend usa client api central=true
sem URL hardcoded=true
sem gateway=true
sem Pix/boleto/cartao=true
sem pagamento real externo=true
sem notificacao=true
sem stack trace na resposta JSON=true
erro global preserva log completo=true
```

## Testes e validacoes

Comandos obrigatorios:

```bash
cmd /c npm run build
node --test backend/src/domains/financeiro/application/tests/*.test.js
node --test backend/src/domains/financeiro/infrastructure/repositories/*.test.js
node --test backend/src/domains/financeiro/presentation/tests/*.test.js
node --test backend/src/domains/enrollments/application/tests/*.test.js
node --check backend/src/domains/financeiro/application/facades/financial.facade.js
node --check backend/src/domains/financeiro/application/services/financial-application.service.js
node --check backend/src/domains/financeiro/infrastructure/repositories/mysql-enrollment-financial-obligation.repository.js
node --check backend/src/domains/financeiro/presentation/controllers/financial-admin.controller.js
node --check backend/src/domains/financeiro/presentation/routes/financial-admin.routes.js
```

Frontend:

```bash
npx tsc --noEmit --pretty false
npx eslint src/features/financial/api/financial.api.ts src/features/financial/types/financial.types.ts src/features/financial/hooks/useEnrollmentFinancialObligations.ts src/features/financial/hooks/useStudentFinancialSummary.ts src/features/financial/hooks/useFinancialObligationActions.ts src/features/financial/components/FinancialStatusBadge.tsx src/features/financial/components/FinancialObligationCard.tsx src/features/financial/pages/FinancialAdminEnrollmentPanel.tsx src/routes/admin/financeiro.tsx
```

## Validacoes executadas

```text
cmd /c npm run build: aprovado
cmd /c npm run build --prefix frontend: nao aplicavel, nao existe pasta frontend separada
node --test backend/src/domains/financeiro/application/tests/*.test.js: aprovado
node --test backend/src/domains/financeiro/infrastructure/repositories/*.test.js: aprovado
node --test backend/src/domains/financeiro/presentation/tests/*.test.js: aprovado
node --test backend/src/domains/enrollments/application/tests/*.test.js: aprovado
node --check principais arquivos JS alterados: aprovado
npx tsc --noEmit --pretty false: aprovado
npx eslint arquivos frontend da Sprint 12.9/12.10: aprovado
cmd /c node backend/src/database/migrations/20260702120000_create_enrollment_financial_obligations_table.js status: aprovado
```

Resultado do status read-only da migration:

```text
tableExists=true
foreignKeyCreated=true
uniqueIndexCreated=true
indexesCreated=true
rowCount=0
version=5.7.44-48 Percona Server
NO_TEST_DATA_LEFT=true
```

## Smoke completo

Caminho adotado: parcial/bloqueado por contrato financeiro operacional.

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

Codigo:

```text
remover mount da rota financeira administrativa em backend/src/server.js
remover import/uso de FinancialAdminEnrollmentPanel em src/routes/admin/financeiro.tsx
```

Banco:

```bash
node backend/src/database/migrations/20260702120000_create_enrollment_financial_obligations_table.js down
```

O rollback de banco recusa `DROP TABLE` quando houver linhas, exigindo plano
aprovado de backup/limpeza antes de remover dados financeiros.

## Checklist de deploy

Antes de producao/homologacao:

```text
1. confirmar DATABASE_URL/credenciais MySQL/Percona
2. executar status da migration de enrollment_financial_obligations
3. confirmar tabela/indices/FK em banco alvo
4. executar build
5. executar testes de dominio Financeiro e Matriculas
6. confirmar variaveis do frontend para API
7. reiniciar backend via PM2
8. validar /api/health
9. validar login admin/coordenador
10. validar /admin/financeiro
11. consultar matricula com obrigacao existente
12. testar status interno apenas com dado controlado
```

## Riscos remanescentes

```text
fonte canonica de plano/valor/vencimento ainda nao e obrigatoria em producao
criacao automatica apos Matricula ACTIVE nao esta liberada como fluxo publico
busca administrativa de aluno por nome/CPF ainda depende de outra tela/escopo
lint global do repositorio possui pendencias preexistentes fora da Fase 12
gateway/conciliacao/notificacao financeira permanecem fora do modulo
```

## Go/no-go

```text
GO parcial: consulta, status interno e UI administrativa protegida.
NO-GO: criacao automatica completa para toda Matricula ACTIVE sem contrato financeiro resolvido.
```
