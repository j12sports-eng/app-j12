# Sprint 9.56 - Preparar Matriculas para Aplicativo/Mobile

## Objetivo

Preparar um contrato seguro para consumo futuro do modulo de Matriculas por
aplicativo/mobile do aluno, sem criar app, tela, rota publica ou efeito colateral.

## Mapeamento

Nao foi encontrado app/mobile dedicado no workspace:

```text
mobile/: inexistente
app/: inexistente
android/: inexistente
ios/: inexistente
docs/MOBILE/: inexistente
```

O unico item relacionado a mobile no frontend e:

```text
src/hooks/use-mobile.tsx
```

Padrao atual para aluno autenticado:

```text
backend/auth.js::requireAuth()
backend/auth.js::resolveScopedStudentId()
backend/src/routes/aluno.routes.js
backend/src/controllers/aluno.controller.js
rotas /aluno/me/*
```

O token autenticado carrega `role/perfil` e `aluno_id`/`studentId`. Ainda nao ha
rota de matriculas para aluno/mobile nem resolucao segura de
`studentPersonId + studentProfileId` a partir do usuario logado.

## Decisao Tecnica

Foi criado DTO interno application-level e exposto pela `EnrollmentFacade`.

Nao foi criada rota HTTP mobile nesta sprint.

Motivo:

```text
nao existe app/mobile dedicado
nao existe rota de matriculas do aluno
nao ha contrato seguro atual para converter aluno_id do auth em studentPersonId + studentProfileId
o escopo proibe expor dados administrativos ou dados de outros alunos
```

## Contrato Criado

Arquivo:

```text
backend/src/domains/enrollments/application/contracts/enrollment-mobile-summary.contract.js
```

Metodo de facade:

```js
getStudentEnrollmentMobileSummary({
  studentPersonId,
  studentProfileId,
});
```

O metodo valida o par completo:

```text
studentPersonId
studentProfileId
```

Depois consulta somente:

```text
EnrollmentApplicationService.getEnrollmentStatusSummary(scope)
```

## DTO Seguro

Formato preparado:

```js
{
  status: "NONE" | "DRAFT" | "ACTIVE" | "CONFLICT",
  enrollmentId: string | null,
  currentEnrollmentSummary: {
    enrollmentId: string,
    status: string | null,
    startDate: string | null,
    endDate: string | null
  } | null,
  activeEnrollmentSummary: {
    enrollmentId: string,
    status: string | null,
    startDate: string | null,
    endDate: string | null
  } | null,
  classSummary: null,
  scheduleSummary: null,
  financialSummary: null,
  historySummary: [],
  availableActions: {
    canConfirmEnrollment: false,
    canCreateAgenda: false,
    canGenerateFinancialCharge: false,
    canLinkClass: false
  },
  mobileSafe: true,
  contractVersion: "sprint-9.56"
}
```

## Dados Permitidos

O DTO permite apenas:

```text
status consolidado
id da matricula atual quando o estado for DRAFT ou ACTIVE
status/startDate/endDate de matriculas DRAFT/ACTIVE conhecidas no resumo atual
placeholders nulos para turma, agenda e financeiro
flags explicitas de acoes mobile bloqueadas
```

## Dados Proibidos

O DTO nao expoe:

```text
studentPersonId
studentProfileId
confirmedAt
confirmedBy
createdAt
updatedAt
deletedAt
logs
warnings tecnicos
dados administrativos
dados de outros alunos
financeiro detalhado
turma real
agenda real
notificacoes
```

## Efeitos Colaterais

O contrato nao:

```text
confirma matricula
gera financeiro
vincula turma
cria agenda
envia notificacoes
altera schema
cria dados de teste
altera frontend administrativo
```

## Autenticacao Futura Necessaria

Antes de criar uma rota mobile real, o backend deve resolver com seguranca:

```text
usuario autenticado aluno/responsavel
aluno_id permitido pelo token
studentPersonId correspondente
studentProfileId correspondente
garantia de que o usuario so consulta seus proprios dados
```

Somente depois disso uma rota como `/aluno/me/enrollment` deve chamar a facade.

## Validacoes

```text
node --check backend/src/domains/enrollments/application/contracts/enrollment-mobile-summary.contract.js: aprovado
node --check backend/src/domains/enrollments/application/contracts/index.js: aprovado
node --check backend/src/domains/enrollments/application/facades/enrollment.facade.js: aprovado
node --check backend/src/domains/enrollments/application/tests/enrollment.facade.test.js: aprovado
node --test backend/src/domains/enrollments/application/tests/enrollment.facade.test.js: aprovado
node --test backend/src/domains/enrollments/application/tests/*.test.js: aprovado
cmd /c npm run build: aprovado
build mobile/frontend: nao aplicavel
```

## Smoke Test

```text
MOBILE_ENROLLMENT_CONTRACT_PREPARED=true
STUDENT_SAFE_DTO_DOCUMENTED=true
NO_ADMIN_DATA_EXPOSED=true
NO_OTHER_STUDENT_DATA_EXPOSED=true
NO_MOBILE_UI_CREATED=true
NO_FINANCIAL_SIDE_EFFECTS=true
NO_CLASS_SIDE_EFFECTS=true
NO_SCHEDULE_SIDE_EFFECTS=true
OFFICIAL_FLOW_STILL_WORKING=true
NO_TEST_DATA_LEFT=true
```

## Limitacoes

```text
sem rota mobile nesta sprint
sem app real no workspace
sem resumo real de turma/agenda/financeiro ate existirem links seguros
sem historico completo porque o repositorio atual expoe apenas DRAFT/ACTIVE atuais por escopo
```

## Proximos Passos

```text
criar resolucao segura aluno_id -> studentPersonId/studentProfileId
definir rota autenticada /aluno/me/enrollment ou equivalente
adicionar testes de isolamento por usuario antes de expor HTTP
preencher classSummary/scheduleSummary/financialSummary apenas quando houver vinculos seguros
```
