# Sprint 9.7 - Profile Application Service

Esta sprint adiciona o `ProfileApplicationService` para encapsular a criacao
do Perfil do Responsavel dentro do fluxo de criacao de matricula.

## Objetivo

Evoluir o fluxo iniciado nas sprints anteriores para criar:

- Pessoa do primeiro responsavel;
- Perfil do responsavel.

Nenhuma outra entidade e criada nesta sprint.

## Fluxo Implementado

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
PersonRepository
->
ProfileApplicationService
->
PersonProfileRepository
->
Pessoa + Perfil do Responsavel criados
```

O `metadata.step` passa a representar a etapa concluida nesta sprint:

```js
metadata.step = "createResponsibleProfile";
```

## Arquivos Criados

```text
backend/src/domains/pessoas/application/services/profile-application.service.js
docs/BACKEND/SPRINT_9_7.md
```

## Arquivos Atualizados

```text
backend/src/domains/pessoas/application/services/enrollment-application.service.js
backend/src/domains/pessoas/application/services/index.js
backend/src/domains/pessoas/application/use-cases/create-enrollment.use-case.js
```

## Responsabilidade do ProfileApplicationService

O `ProfileApplicationService` centraliza operacoes de perfil de Pessoa na
camada Application.

Nesta sprint ele implementa apenas:

- `createResponsibleProfile()`;
- leitura do identificador da Pessoa criada;
- montagem do payload minimo para perfil `responsavel`;
- uso exclusivo do `PersonProfileRepository` existente.

Ele nao cria repository novo, nao altera banco, nao altera SQL, nao cria
relacionamentos e nao integra endpoints.

## Pessoa vs Perfil

Pessoa representa os dados cadastrais base, como nome, CPF, email, telefone e
endereco.

Perfil representa o papel daquela Pessoa no sistema. Nesta sprint, a Pessoa
criada para o primeiro responsavel recebe tambem o perfil `responsavel`.

Uma Pessoa podera ter mais de um perfil no futuro, mas esta sprint cria apenas
o perfil do responsavel aprovado no primeiro passo do fluxo.

## Use Case vs Application Services

O `CreateEnrollmentUseCase` continua responsavel pelo ciclo:

- `beforeExecute()`;
- `validate()`;
- `run()`;
- `afterExecute()`;
- `onError()`.

O Use Case continua dependendo apenas do `EnrollmentApplicationService`. Ele
nao conhece `PersonRepository`, `PersonProfileRepository` ou
`ProfileApplicationService`.

O `EnrollmentApplicationService` orquestra o processo:

- cria Pessoa via `PersonApplicationService`;
- cria Perfil do Responsavel via `ProfileApplicationService`;
- prepara o evento de matricula sem dispara-lo.

## Limitacoes

Nao foi implementado nesta sprint:

- Relationship;
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
- Smoke test com payload valido executado com repositories fake injetados.
- Payload valido confirmou criacao correta do `CreateEnrollmentCommand`.
- Payload valido confirmou validacao pelo `CreateEnrollmentValidator`.
- Payload valido confirmou criacao da Pessoa do responsavel.
- Payload valido confirmou criacao do Perfil `responsavel`.
- Payload valido confirmou que nenhum relacionamento foi criado.
- Payload valido confirmou que nenhuma matricula foi criada.
- Payload valido confirmou que nenhum contrato foi criado.
- Payload valido confirmou que nenhum financeiro foi criado.
- Payload valido preservou o contrato `{ success, data, warnings, errors, metadata }`.
- Payload valido atualizou `metadata.step` para `createResponsibleProfile`.
- Smoke test com payload invalido confirmou falha antes de qualquer repository.
- Payload invalido manteve retorno via `onError()`.
- Payload invalido nao persistiu dados.
- Busca confirmou que o `CreateEnrollmentUseCase` nao conhece repositories.
- Busca confirmou que o `CreateEnrollmentUseCase` nao conhece
  `ProfileApplicationService`.
- Busca confirmou ausencia de integracao em controllers, rotas, APIs, frontend,
  banco e SQL.
- Busca confirmou que os Application Services alterados nao executam SQL direto
  nem acessam APIs ou frontend.

## Proximas Etapas

- Criar a etapa de relacionamento somente quando a proxima sprint autorizar.
- Adicionar testes automatizados de contrato para Pessoa + Perfil.
- Evoluir validacoes de duplicidade de perfil sem alterar endpoints legados.
