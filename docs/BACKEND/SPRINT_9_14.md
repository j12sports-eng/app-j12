# Sprint 9.14 - Enrollment Application Service

Esta sprint adiciona o Application Service do dominio `enrollments`, ainda em
memoria e sem persistencia.

## Objetivo

Criar uma camada de application para orquestrar a criacao de uma Matricula
rascunho em memoria usando `EnrollmentFactory`.

Fluxo em memoria:

```text
studentPersonId + studentProfileId + startDate
->
EnrollmentApplicationService
->
EnrollmentFactory.createDraft()
->
Enrollment em memoria
```

## Estrutura Criada

```text
backend/src/domains/enrollments/application/services/enrollment-application.service.js
```

Arquivos de export atualizados:

```text
backend/src/domains/enrollments/application/services/index.js
backend/src/domains/enrollments/application/index.js
backend/src/domains/enrollments/index.js
```

## Responsabilidade Do EnrollmentApplicationService

`EnrollmentApplicationService` e a camada de application do dominio
`enrollments`.

Responsabilidades futuras:

- criar Matricula;
- ativar Matricula;
- suspender Matricula;
- cancelar Matricula;
- transferir Matricula.

Nesta sprint ele implementa apenas:

- `createDraftEnrollment(input)`;
- chamada a `EnrollmentFactory.createDraft(input)`;
- retorno da entidade `Enrollment` em memoria.

O service nao acessa:

- banco;
- Prisma;
- SQL;
- repository concreto;
- EventBus;
- endpoint;
- controller;
- rota;
- API;
- frontend;
- modulo legado.

## Dominio, Factory E Application Service

`Enrollment`:

- representa o Aggregate Root da Matricula;
- guarda estado em memoria;
- expoe metodos simples de estado como `isActive()`, `activate()`, `suspend()`
  e `cancel()`.

`EnrollmentFactory`:

- constroi `Enrollment` validando campos minimos;
- garante status inicial `DRAFT`;
- centraliza regras minimas de construcao.

`EnrollmentApplicationService`:

- recebe dados ja resolvidos pelo processo;
- delega a construcao para a Factory;
- sera o ponto futuro para orquestracao de casos de uso de Matricula.

## Campos Minimos

`createDraftEnrollment()` recebe e repassa para a Factory:

- `studentPersonId`;
- `studentProfileId`;
- `startDate`.

Se qualquer campo estiver ausente ou vazio, a Factory rejeita a criacao.

## Status Inicial

Toda Matricula criada por `createDraftEnrollment()` nasce com:

```js
EnrollmentStatus.DRAFT
```

## Nao Integrado Nesta Sprint

Esta sprint nao integra o novo service ao fluxo atual de pessoas.

Nao foi alterado:

```text
backend/src/domains/pessoas/application/services/enrollment-application.service.js
```

## Itens Nao Implementados

Nao foi implementado:

- repository concreto;
- Prisma;
- SQL;
- migration;
- banco;
- integracao com `CreateEnrollmentUseCase`;
- integracao com o `EnrollmentApplicationService` de pessoas;
- EventBus;
- endpoint;
- controller;
- rota;
- API;
- frontend;
- contrato;
- financeiro;
- cobranca;
- turma;
- plano;
- modulo legado;
- alteracao em `/public/enrollments`.

## Auditoria

Resultado da auditoria:

- `node --check` executado com sucesso nos JS criados/alterados.
- `npm run build` executado com sucesso.
- Smoke test confirmou que `createDraftEnrollment()` cria `Enrollment`.
- Smoke test confirmou que o status inicial e `DRAFT`.
- Smoke test confirmou falha sem `studentPersonId`.
- Smoke test confirmou falha sem `studentProfileId`.
- Smoke test confirmou falha sem `startDate`.
- Export pela raiz `backend/src/domains/enrollments` validado com
  `EnrollmentApplicationService`.
- Busca por `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `CREATE TABLE`, `query`,
  `PrismaClient`, `prisma`, migrations, pool, connection e `execute` no dominio
  `enrollments` retornou zero ocorrencias.
- Busca por rotas/controllers/APIs no dominio encontrou apenas comentarios
  defensivos declarando ausencia de integracao.
- Busca confirmou zero referencias de `pessoas`, `/public/enrollments` e rotas
  publicas para `EnrollmentFactory` ou `createDraftEnrollment`.
- Nenhum endpoint, controller, rota, API, frontend, modulo legado ou service
  legado foi alterado por esta sprint.

## Observacao De Worktree

Durante a auditoria, o workspace ja continha alteracoes nao relacionadas em
rotas e frontend, alem de arquivos do dominio `pessoas` ainda nao rastreados
pelo Git. A Sprint 9.14 ficou restrita ao dominio `enrollments` e a esta
documentacao.

## Proximos Passos

- Criar validator de `Enrollment`.
- Definir regras de transicao de status.
- Definir repository concreto somente com decisao de banco/tabela aprovada.
- Integrar com o fluxo de pessoas somente quando houver base segura de
  persistencia.
