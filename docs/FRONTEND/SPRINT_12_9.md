# Sprint 12.9 - Frontend Administrativo do Financeiro de Matriculas

## Objetivo

Criar a interface administrativa para consultar e operar obrigacoes financeiras originadas por matriculas, reutilizando a API administrativa protegida criada na Sprint 12.8.

## Decisao tecnica

UI administrativa real criada dentro da rota existente `/admin/financeiro`.

A rota ja estava protegida por `ProtectedRoute roles={["admin", "coordenador"]}` e a API da Sprint 12.8 foi registrada em `/api/admin/financial` com middleware administrativo no backend. Por isso, a Sprint 12.9 habilitou a UI real sem criar nova rota publica.

## Arquivos criados

```text
src/features/financial/api/financial.api.ts
src/features/financial/types/financial.types.ts
src/features/financial/hooks/useEnrollmentFinancialObligations.ts
src/features/financial/hooks/useStudentFinancialSummary.ts
src/features/financial/hooks/useFinancialObligationActions.ts
src/features/financial/components/FinancialStatusBadge.tsx
src/features/financial/components/FinancialObligationCard.tsx
src/features/financial/pages/FinancialAdminEnrollmentPanel.tsx
```

## Arquivos alterados

```text
src/routes/admin/financeiro.tsx
```

## Rota

```text
/admin/financeiro
```

Nao foi criada rota nova. O painel foi incorporado ao financeiro administrativo existente para preservar navegacao, autorizacao e layout atuais.

## API client

O client usa `src/lib/api.ts`, sem URL hardcoded e com token/auth existentes.

Endpoints consumidos:

```text
GET /admin/financial/enrollments/:enrollmentId/obligations
GET /admin/financial/students/:studentPersonId/:studentProfileId/summary
POST /admin/financial/obligations/:obligationId/mark-paid
POST /admin/financial/obligations/:obligationId/cancel
POST /admin/financial/obligations/:obligationId/mark-overdue
```

Como o frontend usa base `/api`, as chamadas chegam ao backend como `/api/admin/financial/...`.

## Tipos

Foram definidos tipos para:

- obrigacao financeira de matricula;
- resumo financeiro por aluno;
- status `PENDING`, `PAID`, `OVERDUE`, `CANCELLED`;
- payloads de baixa, cancelamento e inadimplencia;
- resposta das acoes internas.

## Hooks

Foram criados hooks com TanStack Query:

- `useEnrollmentFinancialObligations()`;
- `useStudentFinancialSummary()`;
- `useFinancialObligationActions()`.

As mutacoes invalidam as consultas de matricula e resumo do aluno apos sucesso.

## Componentes

Foram criados:

- `FinancialStatusBadge`;
- `FinancialObligationCard`;
- `FinancialAdminEnrollmentPanel`.

O painel exibe:

- consulta por matricula;
- consulta de resumo por pessoa/perfil;
- total, aberto, pago e vencido;
- status `PREPARED`, `PENDING`, `PAID`, `OVERDUE`, `CANCELLED`;
- valor, vencimento, origem, plano e auditoria basica.

## Acoes financeiras

As acoes foram habilitadas porque a API administrativa da Sprint 12.8 esta protegida e validada.

Guardas de UI:

- `PREPARED`, `PENDING` ou `OVERDUE` podem ser marcadas como `PAID`;
- `PREPARED`, `PENDING` ou `OVERDUE` podem ser canceladas;
- `PREPARED` ou `PENDING` podem ser marcadas como `OVERDUE`;
- `PAID` e `CANCELLED` bloqueiam transicoes invalidas na interface;
- a API ainda valida novamente no backend.

Nao ha integracao com gateway, Pix, boleto, cartao, notificacao ou pagamento externo.

## Estados visuais

Implementado:

- loading;
- erro;
- vazio;
- sucesso via toast;
- acoes desabilitadas durante mutacao;
- modal de confirmacao para baixa, cancelamento e inadimplencia.

## Smoke test

```text
FINANCIAL_ADMIN_UI_ENABLED=true
FINANCIAL_SUMMARY_VIEW_WORKING=true
FINANCIAL_OBLIGATIONS_VIEW_WORKING=true
PENDING_STATUS_RENDERED=true
PAID_STATUS_RENDERED=true
OVERDUE_STATUS_RENDERED=true
CANCELLED_STATUS_RENDERED=true
FINANCIAL_ACTIONS_GUARDED=true
API_CLIENT_USED=true
NO_EXISTING_ROUTE_BROKEN=true
NO_BACKEND_SCHEMA_CHANGE=true
```

## Validacoes

```text
cmd /c npm run build: aprovado
cmd /c npm run build --prefix frontend: nao aplicavel, o projeto nao possui pasta frontend separada
npx tsc --noEmit --pretty false: aprovado
npx eslint arquivos da Sprint 12.9: aprovado
cmd /c npm run lint: bloqueado por pendencias preexistentes fora do escopo da Sprint 12.9
```

## Bloqueios

O lint global ainda nao esta limpo no reposititorio. A execucao global encontrou erros Prettier e regras antigas em arquivos fora da Sprint 12.9, incluindo backend, migrations, stores e componentes legados. Os arquivos criados/alterados nesta sprint foram validados isoladamente.

## Proximos passos

- Integrar busca de aluno por nome/CPF com o escopo pessoa/perfil, se houver endpoint administrativo consolidado.
- Adicionar testes visuais/integrais de rota quando o projeto tiver harness frontend dedicado.
- Decidir se as acoes internas devem receber papel de aprovacao adicional alem de admin/coordenador.
