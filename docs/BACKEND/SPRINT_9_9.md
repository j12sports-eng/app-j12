# Sprint 9.9 - Student Application Service

Esta sprint adiciona o `StudentApplicationService` para resolver a Pessoa do
aluno com identificador seguro antes da criacao do perfil de aluno e do
relacionamento responsavel-aluno.

## Objetivo

Evoluir o fluxo de matricula para criar ou resolver, nesta ordem:

- Pessoa do primeiro responsavel;
- Perfil do responsavel;
- Pessoa do aluno;
- Perfil do aluno;
- Relacionamento entre a Pessoa do responsavel e a Pessoa do aluno.

Nenhuma matricula, contrato, financeiro, turma, endpoint, controller, rota,
frontend, banco, SQL, migration ou repository novo foi criado nesta sprint.

## Responsabilidade do StudentApplicationService

O `StudentApplicationService` centraliza a resolucao segura da Pessoa do aluno
na camada Application.

Nesta sprint ele implementa apenas:

- `resolveStudentPerson()`;
- leitura segura de `aluno.personId` ou `aluno.person_id`;
- criacao de Pessoa do aluno quando nao houver `personId` seguro;
- criacao do Perfil `aluno` via `ProfileApplicationService`;
- retorno de `studentPerson`, `studentPersonId`, `studentProfile` e warnings.

Responsabilidades futuras continuam fora desta sprint:

- `createStudentPerson()`;
- `createStudentProfile()`;
- `findStudentByPersonId()`;
- `validateDuplicateStudent()`.

## Regra de Seguranca

`aluno.id` nao representa Pessoa de forma segura.

Por isso:

- `aluno.id` nao e usado como `personId`;
- `aluno.id` nao e usado para relacionamento;
- somente `aluno.personId` ou `aluno.person_id` resolvem Pessoa existente;
- quando esses campos nao existem, uma nova Pessoa do aluno e criada.

## Fluxo com aluno.personId

```text
Payload
->
CreateEnrollmentCommand
->
CreateEnrollmentValidator
->
CreateEnrollmentUseCase
->
EnrollmentApplicationService
->
PersonApplicationService cria Pessoa do responsavel
->
ProfileApplicationService cria Perfil do responsavel
->
StudentApplicationService resolve Pessoa do aluno por aluno.personId
->
ProfileApplicationService cria Perfil do aluno
->
RelationshipApplicationService cria relacionamento usando aluno.personId
```

Resultado esperado:

- Pessoa do responsavel criada;
- Perfil do responsavel criado;
- Pessoa do aluno resolvida por `aluno.personId`;
- Perfil do aluno criado;
- Relacionamento criado com `relatedPersonId = aluno.personId`;
- `metadata.step = "createResponsibleStudentRelationship"`.

## Fluxo sem aluno.personId

```text
Payload
->
CreateEnrollmentCommand
->
CreateEnrollmentValidator
->
CreateEnrollmentUseCase
->
EnrollmentApplicationService
->
PersonApplicationService cria Pessoa do responsavel
->
ProfileApplicationService cria Perfil do responsavel
->
StudentApplicationService cria Pessoa do aluno
->
ProfileApplicationService cria Perfil do aluno
->
RelationshipApplicationService cria relacionamento usando a nova Pessoa do aluno
```

Resultado esperado:

- Pessoa do responsavel criada;
- Perfil do responsavel criado;
- Pessoa do aluno criada;
- Perfil do aluno criado;
- Relacionamento criado com o novo ID da Pessoa do aluno;
- `metadata.step = "createResponsibleStudentRelationship"`.

## Limites e Guardrails

Se `StudentApplicationService` for chamado diretamente sem `personId` e sem
dados minimos para criar Pessoa do aluno:

- nenhuma Pessoa incompleta de aluno e criada;
- nenhum Perfil de aluno e criado;
- nenhum relacionamento incompleto e criado;
- warnings sao retornados quando o padrao atual permite.

No fluxo oficial, `CreateEnrollmentValidator` exige `aluno.nome`,
`aluno.dataNascimento` e `aluno.sexo` antes de qualquer repository.

## Use Case

O `CreateEnrollmentUseCase` continua dependendo apenas de
`EnrollmentApplicationService`.

Ele nao conhece:

- `PersonRepository`;
- `PersonProfileRepository`;
- `PersonRelationshipRepository`;
- `PersonApplicationService`;
- `ProfileApplicationService`;
- `RelationshipApplicationService`;
- `StudentApplicationService`.

## Arquivos da Sprint

Criado ou mantido no escopo:

```text
backend/src/domains/pessoas/application/services/student-application.service.js
```

Atualizados:

```text
backend/src/domains/pessoas/application/services/index.js
backend/src/domains/pessoas/application/services/enrollment-application.service.js
backend/src/domains/pessoas/application/use-cases/create-enrollment.use-case.js
```

Documentacao:

```text
docs/BACKEND/SPRINT_9_9.md
```

## Auditoria Executada

- `node --check` executado com sucesso em `student-application.service.js`.
- `node --check` executado com sucesso em `enrollment-application.service.js`.
- `node --check` executado com sucesso em `services/index.js`.
- `node --check` executado com sucesso em `create-enrollment.use-case.js`.
- `npm run build` executado com sucesso.
- Smoke test com payload valido e `aluno.personId` executado com repositories
  fake injetados.
- Smoke test com payload valido sem `aluno.personId` executado com
  repositories fake injetados.
- Smoke test com payload invalido confirmou falha de validacao antes de
  qualquer repository.
- Smoke test invalido confirmou retorno via `onError()`.
- Smoke test invalido confirmou zero chamadas a repositories.
- Busca confirmou que `CreateEnrollmentUseCase` nao conhece repositories.
- Busca confirmou que `CreateEnrollmentUseCase` nao conhece services
  especificos.
- Busca confirmou que `StudentApplicationService` nao acessa banco, SQL,
  connection, pool ou query diretamente.
- Busca confirmou que `StudentApplicationService` nao usa `aluno.id` como
  `personId`.

## Observacao de Worktree

Durante a auditoria, o workspace ja continha alteracoes nao relacionadas em
controllers, rotas, services legados e frontend. A Sprint 9.9 nao alterou esses
arquivos e ficou restrita aos arquivos listados em "Arquivos da Sprint".

## Proximas Etapas

- Validar duplicidade de Perfil de Aluno para a mesma Pessoa.
- Validar duplicidade de relacionamento responsavel-aluno.
- Criar testes automatizados de contrato para o fluxo Pessoa + Perfil +
  Relacionamento.
- Planejar, em sprint futura, a criacao real de matricula, contrato e
  financeiro.
