# Sprint 9.13 - Enrollment Domain Factory

Esta sprint adiciona uma Factory de dominio para construir `Enrollment` em
memoria, sem persistencia e sem integracao com o fluxo atual.

## Objetivo

Preparar a criacao futura de Matricula persistida com uma entrada unica para
construcao segura do Aggregate Root `Enrollment`.

Fluxo em memoria:

```text
Dados resolvidos do processo
->
EnrollmentFactory
->
Enrollment entity valida em memoria
```

## Estrutura Criada

```text
backend/src/domains/enrollments/domain/factories/
  enrollment.factory.js
  index.js
```

Arquivos de export atualizados:

```text
backend/src/domains/enrollments/domain/index.js
backend/src/domains/enrollments/index.js
```

## Responsabilidade Da Factory

`EnrollmentFactory` centraliza regras minimas de construcao de `Enrollment`.

Nesta sprint ela implementa:

- `createDraft(input)`;
- validacao de campos minimos obrigatorios;
- criacao de `Enrollment` com `EnrollmentStatus.DRAFT`;
- retorno de entidade em memoria.

A Factory nao acessa:

- banco;
- repository;
- Prisma;
- SQL;
- API;
- EventBus;
- rotas;
- controllers;
- services legados.

## Campos Minimos Obrigatorios

`EnrollmentFactory.createDraft()` exige:

- `studentPersonId`;
- `studentProfileId`;
- `startDate`.

Se qualquer campo estiver ausente ou vazio, a Factory rejeita a criacao com
`TypeError`.

Campos opcionais aceitos:

- `id`;
- `createdAt`;
- `updatedAt`.

## Status Inicial

Toda Matricula criada por `createDraft()` nasce com:

```js
EnrollmentStatus.DRAFT
```

Mesmo que outro status seja enviado no input, `createDraft()` forca o estado
inicial `DRAFT`.

## Itens Nao Implementados

Nao foi implementado:

- repository concreto;
- Prisma;
- SQL;
- migration;
- banco;
- service de criacao de Matricula;
- integracao com `EnrollmentApplicationService`;
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
- Smoke test confirmou que `EnrollmentFactory.createDraft()` cria
  `Enrollment`.
- Smoke test confirmou que o status inicial e `DRAFT`.
- Smoke test confirmou falha sem `studentPersonId`.
- Smoke test confirmou falha sem `studentProfileId`.
- Smoke test confirmou falha sem `startDate`.
- Busca por `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `CREATE TABLE`, `query`,
  `PrismaClient`, `prisma`, migrations, pool, connection e `execute` no dominio
  `enrollments` retornou zero ocorrencias.
- Busca por rotas/controllers/APIs no dominio encontrou apenas comentarios
  defensivos declarando ausencia de integracao.
- `git status` focado confirmou que `/public/enrollments` nao foi alterado.
- Nenhum endpoint, controller, rota, API, frontend, modulo legado ou service
  legado foi alterado por esta sprint.

## Proximos Passos

- Criar value object para numero de Matricula.
- Criar validator de `Enrollment`.
- Definir regras de transicao de status.
- Definir repository concreto somente quando a decisao de banco/tabela estiver
  aprovada.
- Integrar com `EnrollmentApplicationService` somente quando houver base segura.
