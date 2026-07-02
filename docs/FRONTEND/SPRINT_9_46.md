# Sprint 9.46 - Contrato Frontend para Matriculas

## Objetivo

Documentar como o frontend deve consumir o futuro dominio de matriculas sem
alterar telas, rotas visuais, componentes ou comportamento atual.

## Mapeamento do Frontend Atual

Arquivos relevantes encontrados:

```text
src/lib/api.ts
src/lib/mysql-api.ts
src/lib/matricula-api.ts
src/lib/aluno-matricula.ts
src/lib/alunos-api.ts
src/lib/financeiro-api.ts
src/hooks/*
docs/FRONTEND/PADROES.md
docs/FRONTEND/HOOKS.md
```

Padrao atual de API:

```text
src/lib/api.ts e o cliente principal
apiFetch() resolve base URL, timeout, auth e envelope da API
api.get/post/put/patch/delete extraem data de envelopes success/data
formatApiErrorMessage() normaliza mensagens de erro
mysqlApi encapsula apiFetch para modulos legados
matricula-api.ts hoje atende somente /public/enrollments
```

Padrao atual de estado remoto:

```text
hooks customizados com useState/useEffect
stores com useSyncExternalStore
React Query em alguns catalogos publicos
loading/error/success documentados em docs/FRONTEND/PADROES.md
```

## Decisao da Sprint

Nao foi criado arquivo em `src/`.

Motivo:

```text
a API interna ainda nao esta registrada no backend
nao ha endpoint seguro publicado para o frontend
criar client executavel agora poderia sugerir consumo antes da rota existir
o escopo exige nao alterar comportamento atual do frontend
```

## Encaixe Futuro Recomendado

Quando a rota backend existir com autenticacao/autorizacao definidas, criar:

```text
src/lib/enrollments-api.ts
src/lib/enrollments-types.ts
src/hooks/useEnrollmentStatus.ts
```

O client deve usar `api` ou `apiFetch` de:

```text
src/lib/api.ts
```

Nao reutilizar `src/lib/matricula-api.ts` para o fluxo interno sem renomear ou
separar responsabilidades, porque esse arquivo hoje representa o fluxo publico:

```text
/public/enrollments/next-number
/public/address/lookup
/public/enrollments
```

## Tipos Documentados

Status:

```ts
export type EnrollmentSummaryStatus = "NONE" | "DRAFT" | "ACTIVE" | "CONFLICT";
```

Registro minimo:

```ts
export type EnrollmentRecord = {
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

Resumo:

```ts
export type EnrollmentStatusSummary = {
  status: EnrollmentSummaryStatus;
  studentPersonId: string;
  studentProfileId: string;
  draftEnrollment: EnrollmentRecord | null;
  activeEnrollment: EnrollmentRecord | null;
};
```

Confirmacao:

```ts
export type ConfirmDraftEnrollmentRequest = {
  enrollmentId: string;
  confirmedBy?: string;
};

export type ConfirmDraftEnrollmentResponse = {
  alreadyConfirmed: boolean;
  confirmed: boolean;
  confirmedAt: string | null;
  confirmedBy: string | null;
  enrollment: EnrollmentRecord | null;
  status: "ACTIVE";
};
```

Estado de hook futuro:

```ts
export type EnrollmentRemoteState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};
```

## Client Futuro Sugerido

Exemplo documental, nao implementado nesta sprint:

```ts
import { api } from "@/lib/api";
import type {
  ConfirmDraftEnrollmentResponse,
  EnrollmentRecord,
  EnrollmentStatusSummary,
} from "@/lib/enrollments-types";

export function getEnrollmentStatusSummary(input: {
  studentPersonId: string;
  studentProfileId: string;
}) {
  const params = new URLSearchParams(input);
  return api.get<EnrollmentStatusSummary>(`/internal/enrollments/status?${params}`);
}

export function getCurrentDraftEnrollment(input: {
  studentPersonId: string;
  studentProfileId: string;
}) {
  const params = new URLSearchParams(input);
  return api.get<EnrollmentRecord | null>(`/internal/enrollments/current-draft?${params}`);
}

export function getCurrentActiveEnrollment(input: {
  studentPersonId: string;
  studentProfileId: string;
}) {
  const params = new URLSearchParams(input);
  return api.get<EnrollmentRecord | null>(`/internal/enrollments/current-active?${params}`);
}

export function confirmDraftEnrollment(enrollmentId: string, confirmedBy?: string) {
  return api.post<ConfirmDraftEnrollmentResponse>(
    `/internal/enrollments/${encodeURIComponent(enrollmentId)}/confirm`,
    { confirmedBy },
  );
}
```

## Loading, Sucesso e Erro

Hook futuro deve expor:

```text
loading inicial
error normalizado com formatApiErrorMessage()
data nulo quando nao houver matricula
reload explicito
estado de confirmacao separado do carregamento de leitura
```

Confirmacao futura deve:

```text
desabilitar acao enquanto pending
tratar alreadyConfirmed como sucesso idempotente
recarregar status apos confirmacao
nao gerar cobranca
nao vincular turma
nao alterar aluno diretamente
```

## Garantias Desta Sprint

```text
NO_UI_CHANGE=true
NO_FRONTEND_BEHAVIOR_CHANGE=true
NO_BACKEND_SCHEMA_CHANGE=true
```

Nenhum arquivo em `src/` foi alterado.

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
