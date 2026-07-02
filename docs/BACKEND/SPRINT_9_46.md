# Sprint 9.46 - Contrato Frontend para Matriculas

## Objetivo

Preparar o contrato entre backend e frontend para o futuro modulo de
matriculas, sem expor novas telas, sem registrar chamadas reais no frontend e
sem alterar o fluxo visual atual.

## Contexto

A Sprint 9.45 preparou a API interna do dominio de matriculas como contrato e
controller nao registrado:

```text
backend/src/domains/enrollments/application/http/enrollment-internal-api.contract.js
backend/src/domains/enrollments/application/http/enrollment-internal.controller.js
```

Os endpoints futuros continuam documentados, mas nao expostos publicamente:

```text
GET /internal/enrollments/status
GET /internal/enrollments/current-draft
GET /internal/enrollments/current-active
POST /internal/enrollments/:id/confirm
```

## Contrato Backend -> Frontend

Formato de resposta esperado:

```ts
type EnrollmentApiSuccess<T> = {
  success: true;
  data: T;
};

type EnrollmentApiFailure = {
  success: false;
  error: string;
  code?: string;
};
```

Status consolidados:

```ts
type EnrollmentSummaryStatus = "NONE" | "DRAFT" | "ACTIVE" | "CONFLICT";
```

Resumo de status:

```ts
type EnrollmentStatusSummary = {
  status: EnrollmentSummaryStatus;
  studentPersonId: string;
  studentProfileId: string;
  draftEnrollment: EnrollmentRecord | null;
  activeEnrollment: EnrollmentRecord | null;
};
```

Registro minimo de matricula para consumo visual futuro:

```ts
type EnrollmentRecord = {
  id: string;
  status: "DRAFT" | "ACTIVE" | string;
  studentPersonId: string;
  studentProfileId: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  confirmedAt?: string | null;
  confirmedBy?: string | null;
};
```

Confirmacao de matricula:

```ts
type ConfirmDraftEnrollmentRequest = {
  enrollmentId: string;
  confirmedBy?: string;
};

type ConfirmDraftEnrollmentResponse = {
  alreadyConfirmed: boolean;
  confirmed: boolean;
  confirmedAt: string | null;
  confirmedBy: string | null;
  enrollment: EnrollmentRecord | null;
  status: "ACTIVE";
};
```

## Chamadas Futuras

Consulta de status:

```text
GET /internal/enrollments/status?studentPersonId=:id&studentProfileId=:id
```

Draft atual:

```text
GET /internal/enrollments/current-draft?studentPersonId=:id&studentProfileId=:id
```

Active atual:

```text
GET /internal/enrollments/current-active?studentPersonId=:id&studentProfileId=:id
```

Confirmacao:

```text
POST /internal/enrollments/:id/confirm
```

Payload futuro:

```json
{
  "confirmedBy": "usuario-ou-servico"
}
```

## Garantias de Escopo

Esta sprint nao criou:

```text
endpoint publico
rota Express registrada
chamada real no frontend
hook de tela
botao de confirmacao
alteracao no fluxo de criacao de aluno
vinculo com Turmas
geracao financeira
alteracao de schema/migration
```

## Dependencias Futuras

Antes de consumir no frontend, uma sprint futura deve:

```text
definir namespace interno seguro ou endpoint publico autenticado
registrar rota backend com requireAuth
definir autorizacao para canManageSystem ou perfil equivalente
confirmar formato final do envelope success/data
criar client frontend isolado
criar hooks sem alterar telas existentes
adicionar testes de erro/loading/success
```

## Arquivos Alterados

```text
docs/BACKEND/SPRINT_9_46.md
docs/FRONTEND/SPRINT_9_46.md
```

## Validacoes

Validacoes previstas:

```text
cmd /c npm run build
smoke test documental
```

Smoke esperado:

```text
FRONTEND_ENROLLMENT_CONTRACT_PREPARED=true
API_CLIENT_PATTERN_MAPPED=true
ENROLLMENT_TYPES_DOCUMENTED=true
NO_UI_CHANGE=true
NO_FRONTEND_BEHAVIOR_CHANGE=true
NO_BACKEND_SCHEMA_CHANGE=true
OFFICIAL_FLOW_STILL_WORKING=true
```

## Fora Do Escopo

Nao foram alterados:

```text
UI
rotas visuais
comportamento do frontend
schema
migrations
financeiro
mensalidades
turmas
agenda
notificacoes
app
legado
```
