# Sprint 9.22 - Enrollment Application Service With Repository

## Objetivo

Integrar o contrato de repository ao `EnrollmentApplicationService` do dominio
`enrollments`, de forma opcional, controlada e testavel.

Esta sprint nao integra persistencia ao fluxo de `pessoas` e nao altera o
`CreateEnrollmentUseCase`.

## Alteracao No EnrollmentApplicationService

Arquivo alterado:

```text
backend/src/domains/enrollments/application/services/enrollment-application.service.js
```

O construtor passou a aceitar:

```js
enrollmentRepository
```

O repository e opcional e fica armazenado no service somente para uso explicito
do novo metodo de persistencia. O service continua sem importar banco, `db.js`,
repository concreto, SQL ou migration.

## Metodos Disponiveis

`createDraftEnrollment(input)` continua com o comportamento anterior:

- cria somente uma entidade `Enrollment` em memoria;
- usa `EnrollmentFactory.createDraft(input)`;
- nao chama repository;
- nao acessa banco;
- continua compativel com o fluxo atual de `pessoas`.

`createDraftEnrollmentAndPersist(input)` foi adicionado para o novo fluxo
controlado:

- cria uma entidade `Enrollment` em memoria via factory;
- valida se existe `enrollmentRepository.create`;
- chama `enrollmentRepository.create(enrollment)`;
- retorna o resultado persistido pelo repository injetado.

## Repository Opcional

O repository nao e criado automaticamente pelo service.

Se `createDraftEnrollmentAndPersist()` for chamado sem `enrollmentRepository`
valido, o service lanca erro controlado:

```text
EnrollmentApplicationService requires an enrollmentRepository.create function.
```

## Motivo Para Nao Instanciar Repository Automaticamente

A instancia automatica do repository exigiria escolher infraestrutura,
configuracao de conexao e momento de acesso ao banco dentro do application
service. Isso quebraria o isolamento desta sprint e poderia acionar banco real
sem controle.

Por isso, a persistencia permanece opt-in por injecao de dependencia. O
application service conhece apenas o contrato esperado do repository.

## Smoke Test Com Mock

Foi usado repository mockado para confirmar:

- `createDraftEnrollment()` continua criando apenas em memoria;
- `createDraftEnrollmentAndPersist()` cria uma entidade `Enrollment`;
- `createDraftEnrollmentAndPersist()` chama `repository.create()`;
- `repository.create()` recebe a entidade `Enrollment`;
- o status inicial da entidade e `DRAFT`;
- chamada sem repository falha de forma controlada;
- nenhum banco real e acessado.

## Itens Nao Implementados

Nao foi implementado nesta sprint:

- execucao da migration;
- alteracao real no banco;
- integracao com `backend/src/domains/pessoas/application/services/enrollment-application.service.js`;
- integracao com `CreateEnrollmentUseCase`;
- controller;
- endpoint;
- rota;
- API;
- frontend;
- EventBus;
- UnitOfWork;
- transacao multi-repository;
- contrato;
- financeiro;
- turma;
- plano;
- legado;
- alteracao em `/public/enrollments`.

## Auditoria

Executado:

```bash
node --check backend/src/domains/enrollments/application/services/enrollment-application.service.js
npm run build
```

Tambem foi executado smoke test isolado com `enrollmentRepository` mockado.

Resultado:

- `node --check` aprovado no JS alterado;
- `npm run build` aprovado;
- smoke test com mock aprovado;
- nenhum banco real acessado;
- nenhuma migration executada;
- nenhum controller, endpoint, rota, API ou frontend alterado;
- nenhum legado alterado;
- `/public/enrollments` nao alterado;
- `CreateEnrollmentUseCase` nao conhece o repository;
- fluxo de `pessoas` nao usa persistencia real de `enrollments`.

## Proximos Passos

1. Manter o fluxo atual usando apenas `createDraftEnrollment()`.
2. Executar a migration apenas quando houver aprovacao operacional.
3. Validar `MySqlEnrollmentRepository` contra banco homologado com a tabela
   criada.
4. Planejar uma sprint futura para wiring controlado, com transacao e rollback
   definidos antes de qualquer integracao com `pessoas`.
