# Sprint 9.15 - Integracao Do Enrollment Draft Ao Fluxo De Matricula

Esta sprint integra o dominio `enrollments` ao orquestrador de `pessoas` de
forma controlada e ainda sem persistencia.

## Objetivo

Ao final do fluxo de matricula conceitual, o backend passa a criar em memoria:

1. Pessoa do responsavel;
2. Perfil do responsavel;
3. Pessoa do aluno;
4. Perfil do aluno;
5. Relacionamento responsavel-aluno;
6. `draftEnrollment` em memoria com status `DRAFT`, quando houver `startDate`
   seguro no payload.

Nenhum dado de Matricula e persistido nesta sprint.

## Integracao Entre Dominios

O orquestrador existente em:

```text
backend/src/domains/pessoas/application/services/enrollment-application.service.js
```

passa a usar o application service do dominio `enrollments` com alias claro:

```js
EnrollmentApplicationService: EnrollmentDomainApplicationService
```

Isso evita ambiguidade entre:

- `EnrollmentApplicationService` do dominio `pessoas`;
- `EnrollmentApplicationService` do dominio `enrollments`.

O `CreateEnrollmentUseCase` continua dependendo somente do orquestrador de
`pessoas`. Ele apenas repassa `draftEnrollment` no retorno quando o
orquestrador o cria.

## Fluxo Com DraftEnrollment

Quando o payload contem `matricula.startDate`, o fluxo executa:

```text
CreateEnrollmentUseCase
EnrollmentApplicationService (pessoas)
PersonApplicationService
ProfileApplicationService
StudentApplicationService
RelationshipApplicationService
EnrollmentDomainApplicationService.createDraftEnrollment()
EnrollmentFactory.createDraft()
```

O `draftEnrollment` recebe:

- `studentPersonId` resolvido pelo fluxo seguro do aluno;
- `studentProfileId` criado pelo fluxo seguro do aluno;
- `startDate` lido de `matricula.startDate`.

O status inicial e:

```text
DRAFT
```

Quando o draft e criado, o retorno usa:

```js
metadata.step = "createDraftEnrollment";
```

## Regra Sobre Aluno.Id

`aluno.id` continua nao sendo usado como `studentPersonId`.

O `studentPersonId` usado no draft vem exclusivamente de:

- `aluno.personId`;
- `aluno.person_id`;
- nova Pessoa do aluno criada pelo `StudentApplicationService`.

## Fluxo Sem StartDate

Se `matricula.startDate` nao existir:

- o fluxo de `pessoas` continua funcionando;
- Pessoa do responsavel e criada;
- Perfil do responsavel e criado;
- Pessoa do aluno e criada/resolvida;
- Perfil do aluno e criado;
- Relacionamento responsavel-aluno e criado;
- `draftEnrollment` nao e criado;
- um warning e retornado;
- `metadata.step` permanece em `createResponsibleStudentRelationship`.

Warning retornado:

```text
DRAFT_ENROLLMENT_START_DATE_MISSING
```

## Decisao Sobre DataMatricula

O payload atual ja possui `matricula.dataMatricula` validado pelo fluxo de
entrada. Nesta sprint esse campo nao foi convertido automaticamente em
`startDate`, porque a Sprint 9.15 exige comportamento seguro quando
`startDate` nao existir.

Assim, para criar `draftEnrollment`, o payload precisa enviar explicitamente:

```js
matricula: {
  startDate: "YYYY-MM-DD"
}
```

`matricula.dataMatricula` continua existindo para compatibilidade do validator
atual, mas nao e usado como fallback automatico para o draft.

## Itens Nao Implementados

Nao foi implementado:

- persistencia de Matricula;
- repository concreto;
- Prisma;
- SQL;
- migration;
- banco;
- contrato;
- financeiro;
- cobranca;
- turma;
- plano;
- EventBus;
- endpoint;
- controller;
- rota;
- API;
- frontend;
- modulo legado;
- alteracao em `/public/enrollments`.

## Auditoria Executada

Resultado da auditoria:

- `node --check` executado com sucesso em
  `backend/src/domains/pessoas/application/services/enrollment-application.service.js`.
- `node --check` executado com sucesso em
  `backend/src/domains/pessoas/application/use-cases/create-enrollment.use-case.js`.
- Smoke test com payload valido contendo `matricula.startDate` aprovado.
- Smoke test confirmou Pessoa do responsavel, Perfil do responsavel, Pessoa do
  aluno, Perfil do aluno e Relacionamento responsavel-aluno.
- Smoke test confirmou `draftEnrollment.status = DRAFT`.
- Smoke test confirmou `metadata.step = createDraftEnrollment`.
- Smoke test confirmou que `aluno.id` nao foi usado como `studentPersonId`.
- Smoke test com payload valido sem `matricula.startDate` aprovado.
- Smoke test sem `matricula.startDate` confirmou ausencia de `draftEnrollment`,
  warning `DRAFT_ENROLLMENT_START_DATE_MISSING` e
  `metadata.step = createResponsibleStudentRelationship`.
- Smoke test invalido aprovado: validacao falhou antes de qualquer repository
  injetado, `onError()` retornou resposta de erro e nenhuma chamada de
  repository falsa ocorreu.
- `cmd /c npm run build` executado com sucesso.
- Busca por `PrismaClient`, `prisma`, SQL, migrations, pool, connection,
  `query` e `execute` nos dominios alterados retornou zero ocorrencias novas.
- Busca confirmou que `CreateEnrollmentUseCase` nao conhece
  `EnrollmentFactory`, `EnrollmentStatus`, service do dominio `enrollments`,
  repositories, banco, Prisma ou SQL.
- Busca confirmou que rotas, server, frontend e legado nao importam
  `draftEnrollment`, `createDraftEnrollment` ou o alias de integracao.
- O diretorio `public` nao existe neste workspace; nenhuma alteracao em
  `/public/enrollments` foi feita.

## Arquivos Alterados

- `backend/src/domains/pessoas/application/services/enrollment-application.service.js`
- `backend/src/domains/pessoas/application/use-cases/create-enrollment.use-case.js`
- `docs/BACKEND/SPRINT_9_15.md`

## Proximos Passos

- Definir contrato explicito entre `dataMatricula` e `startDate`, se o ERP
  decidir que representam o mesmo conceito.
- Criar validacao especifica para campos do dominio `enrollments`.
- Implementar repository concreto somente quando banco, tabela e campos
  obrigatorios estiverem aprovados.
- Persistir Matricula em sprint futura sem criar atalhos por controller, rota
  ou modulo legado.
