# Sprint 9.12 - Enrollments Domain Structure

Esta sprint cria a estrutura inicial do dominio `enrollments`, sem
persistencia e sem integracao com o fluxo atual.

## Objetivo

Preparar a base arquitetural do dominio de Matriculas para implementacao futura
de repository, infrastructure e banco.

Esta sprint nao cria Matricula persistida.

## Estrutura Criada

```text
backend/src/domains/enrollments/
  domain/
    entities/
      enrollment.entity.js
      index.js
    enums/
      enrollment-status.enum.js
      index.js
    value-objects/
      index.js
    index.js
  application/
    repositories/
      enrollment.repository.js
      index.js
    services/
      index.js
    index.js
  infrastructure/
    index.js
  index.js
```

## Responsabilidade Do Dominio

O dominio `enrollments` passa a representar a fronteira futura de Matriculas no
backend.

Nesta sprint ele expoe somente:

- Aggregate Root `Enrollment`;
- enum `EnrollmentStatus`;
- contrato JSDoc de `EnrollmentRepository`;
- barrels para importacao futura.

O dominio nao e importado por rotas, controllers, services legados, APIs ou
frontend.

## Entidade Enrollment

`Enrollment` representa o Aggregate Root da Matricula.

Campos minimos:

- `id`;
- `studentPersonId`;
- `studentProfileId`;
- `status`;
- `startDate`;
- `endDate`;
- `createdAt`;
- `updatedAt`.

Metodos simples:

- `isActive()`;
- `activate()`;
- `suspend()`;
- `cancel()`;
- `touch()`;
- `toJSON()`.

Esses metodos alteram apenas estado em memoria. Eles nao acessam banco, SQL,
Prisma, APIs, services externos, rotas ou controllers.

## Estados Definidos

`EnrollmentStatus` define os estados minimos:

- `DRAFT`;
- `PENDING`;
- `ACTIVE`;
- `SUSPENDED`;
- `CANCELLED`;
- `FINISHED`.

Nao foram implementadas regras complexas de transicao nesta sprint.

## Repository

`backend/src/domains/enrollments/application/repositories/enrollment.repository.js`
foi criado apenas como contrato/interface JSDoc.

Metodos futuros documentados:

- `create(enrollment)`;
- `findById(id)`;
- `findByStudentPersonId(studentPersonId)`;
- `update(id, data)`;
- `delete(id)`.

Nao ha repository concreto.

## Nao Implementado

Nao foi implementado:

- Prisma;
- SQL;
- migration;
- banco;
- repository concreto;
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

- `node --check` executado com sucesso nos 12 JS criados.
- Import CommonJS validado com `Enrollment` e `EnrollmentStatus`.
- `npm run build` executado com sucesso.
- Busca por `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `CREATE TABLE`, `query`,
  `PrismaClient`, `prisma`, migrations, pool, connection e `execute` no novo
  dominio retornou zero ocorrencias.
- Busca por rotas/controllers/APIs no novo dominio encontrou apenas comentarios
  defensivos declarando ausencia de integracao.
- `git status` focado confirmou que `/public/enrollments` nao foi alterado.
- Nenhum endpoint, controller, rota, API, frontend, modulo legado ou service
  legado foi alterado por esta sprint.

## Proximos Passos

- Criar value objects de numero de Matricula e datas quando a regra for
  aprovada.
- Criar validator de `Enrollment`.
- Definir regras de transicao de status.
- Definir repository concreto somente apos decisao de banco/tabela.
- Definir integracao futura com `EnrollmentApplicationService`.
- Definir estrategia segura para numero de Matricula e idempotencia.
