# Sprint 9.8 - Relationship Application Service

Esta sprint adiciona o `RelationshipApplicationService` para encapsular a
criacao segura do relacionamento entre responsavel e aluno.

## Objetivo

Evoluir o fluxo de matricula para criar, quando houver base segura:

- Pessoa do primeiro responsavel;
- Perfil do responsavel;
- Relacionamento entre a Pessoa do responsavel e a Pessoa do aluno.

Nenhuma outra entidade e criada nesta sprint.

## Fluxo Implementado

Fluxo com `aluno.personId` disponivel:

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
PersonApplicationService
->
ProfileApplicationService
->
RelationshipApplicationService
->
PersonRepository / PersonProfileRepository / PersonRelationshipRepository
->
Pessoa + Perfil + Relacionamento criados
```

Quando o relacionamento e criado, o retorno usa:

```js
metadata.step = "createResponsibleStudentRelationship";
```

Fluxo sem `aluno.personId`:

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
PersonApplicationService
->
ProfileApplicationService
->
Pessoa + Perfil criados
```

Nesse caso, o comportamento da Sprint 9.7 e preservado e o relacionamento nao
e criado.

## Arquivos Criados

```text
backend/src/domains/pessoas/application/services/relationship-application.service.js
docs/BACKEND/SPRINT_9_8.md
```

## Arquivos Atualizados

```text
backend/src/domains/pessoas/application/services/enrollment-application.service.js
backend/src/domains/pessoas/application/services/index.js
backend/src/domains/pessoas/application/use-cases/create-enrollment.use-case.js
```

## Responsabilidade do RelationshipApplicationService

O `RelationshipApplicationService` centraliza operacoes de relacionamento entre
Pessoas na camada Application.

Nesta sprint ele implementa apenas:

- `createResponsibleStudentRelationship()`;
- leitura do ID da Pessoa do responsavel criada;
- leitura segura de `aluno.personId` ou `aluno.person_id`;
- montagem do payload minimo para relacionamento responsavel-aluno;
- uso exclusivo do `PersonRelationshipRepository` existente.

O service ignora `aluno.id` de proposito, pois esse campo pode representar um
registro legado de aluno em vez de uma Pessoa. Sem `aluno.personId`, nenhum
relacionamento e criado.

## Repository e Modelo Utilizados

Foi utilizado o repository existente:

```text
backend/src/domains/pessoas/relationships/relationship.repository.js
```

Modelo/tabela conceitual existente:

```text
person_relationships
```

Campos usados pelo fluxo:

- `personId`: Pessoa do responsavel criado;
- `relatedPersonId`: Pessoa do aluno, lida de `aluno.personId`;
- `relationshipType`: `responsible`;
- `relationshipLabel`: `responsaveis[0].relacionamento.tipo`;
- flags do relacionamento: legal, financeiro, comunicados, busca e emergencia.

## Pessoa, Perfil e Relacionamento

Pessoa representa os dados cadastrais base.

Perfil representa o papel exercido pela Pessoa no ERP.

Relacionamento representa o vinculo contextual entre duas Pessoas. Nesta
sprint, a relacao criada e:

```text
Pessoa Responsavel -> Pessoa Aluno
```

## Use Case vs Application Services

O `CreateEnrollmentUseCase` continua dependendo apenas do
`EnrollmentApplicationService`.

Ele nao conhece:

- `PersonRepository`;
- `PersonProfileRepository`;
- `PersonRelationshipRepository`;
- `PersonApplicationService`;
- `ProfileApplicationService`;
- `RelationshipApplicationService`.

O `EnrollmentApplicationService` continua sendo o orquestrador do fluxo.

## Impedimentos e Guardrails

O relacionamento so e criado quando `aluno.personId` ou `aluno.person_id`
existe no payload.

Quando esse ID nao existe:

- nenhuma tentativa de criar relacionamento e feita;
- nenhum campo ambiguo e assumido;
- `aluno.id` nao e usado;
- o comportamento fica igual ao da Sprint 9.7;
- `metadata.step` permanece `createResponsibleProfile`.

## Limitacoes

Nao foi implementado nesta sprint:

- criacao de aluno;
- Matricula;
- Contrato;
- Financeiro;
- Turmas;
- EventBus;
- Commands novos;
- Queries;
- CQRS completo;
- Endpoints, controllers, rotas ou APIs;
- Frontend;
- Banco, SQL ou migrations;
- Repositories novos;
- Services legados;
- Refatoracoes fora do escopo.

## Auditoria Executada

- `node --check` executado nos arquivos JavaScript criados ou alterados.
- `npm run build` executado com sucesso.
- Smoke test com payload valido e `aluno.personId` executado com repositories
  fake injetados.
- Payload valido com `aluno.personId` confirmou criacao correta do
  `CreateEnrollmentCommand`.
- Payload valido com `aluno.personId` confirmou validacao pelo
  `CreateEnrollmentValidator`.
- Payload valido com `aluno.personId` confirmou criacao da Pessoa do
  responsavel.
- Payload valido com `aluno.personId` confirmou criacao do Perfil
  `responsavel`.
- Payload valido com `aluno.personId` confirmou criacao do relacionamento
  responsavel-aluno.
- Payload valido com `aluno.personId` atualizou `metadata.step` para
  `createResponsibleStudentRelationship`.
- Payload valido sem `aluno.personId` confirmou criacao de Pessoa + Perfil e
  ausencia de relacionamento incompleto.
- Payload valido sem `aluno.personId` manteve `metadata.step` como
  `createResponsibleProfile`.
- Payload invalido confirmou falha antes de qualquer repository.
- Payload invalido manteve retorno via `onError()`.
- Payload invalido nao persistiu dados.
- Busca confirmou que o `CreateEnrollmentUseCase` nao conhece repositories.
- Busca confirmou que o `CreateEnrollmentUseCase` nao conhece
  `PersonApplicationService`, `ProfileApplicationService` ou
  `RelationshipApplicationService`.
- Busca confirmou ausencia de integracao em controllers, rotas, APIs, frontend,
  banco e SQL.
- Busca confirmou que os Application Services alterados nao executam SQL direto,
  nao acessam Prisma, nao acessam APIs e nao acessam frontend.

## Proximas Etapas

- Criar Pessoa e Perfil do aluno somente quando a sprint correspondente
  autorizar.
- Validar duplicidade de relacionamento responsavel-aluno.
- Adicionar testes automatizados de contrato para o fluxo Pessoa + Perfil +
  Relacionamento.
