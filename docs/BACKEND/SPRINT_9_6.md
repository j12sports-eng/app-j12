# Sprint 9.6 - Create Enrollment Validator

Esta sprint cria o `CreateEnrollmentValidator` para validar explicitamente o
`CreateEnrollmentCommand` antes da execucao do fluxo de criacao de matricula.

## Objetivo

Separar a validacao da entrada do `CreateEnrollmentUseCase`, mantendo o
comportamento funcional da Sprint 9.5.

Fluxo valido:

```text
Payload
->
CreateEnrollmentCommand
->
CreateEnrollmentValidator
->
EnrollmentApplicationService
->
PersonApplicationService
->
PersonRepository
->
Pessoa criada
```

Fluxo invalido:

```text
Payload
->
CreateEnrollmentCommand
->
CreateEnrollmentValidator
->
onError()
```

## Arquivos Criados

```text
backend/src/domains/pessoas/application/validators/create-enrollment.validator.js
backend/src/domains/pessoas/application/validators/index.js
docs/BACKEND/SPRINT_9_6.md
```

## Arquivo Atualizado

```text
backend/src/domains/pessoas/application/use-cases/create-enrollment.use-case.js
```

## Responsabilidade dos Validators

Validators validam a entrada de aplicacao antes da execucao do fluxo.

Nesta sprint, `CreateEnrollmentValidator`:

- recebe `CreateEnrollmentCommand`;
- valida a estrutura ja validada anteriormente pelo Use Case;
- valida existencia de responsavel;
- valida dados minimos do responsavel para criar Pessoa;
- preserva as mensagens e codigos de erro existentes;
- retorna `{ isValid, errors, warnings }`;
- nao acessa banco;
- nao chama repository;
- nao executa SQL;
- nao acessa APIs;
- nao acessa frontend;
- nao dispara eventos;
- nao executa persistencia.

## Command vs Validator vs UseCase vs ApplicationService

O `CreateEnrollmentCommand` encapsula o payload e expoe metodos de leitura.

O `CreateEnrollmentValidator` decide se o Command e valido para seguir.

O `CreateEnrollmentUseCase` continua responsavel pelo ciclo:

- `beforeExecute()`;
- `validate()`;
- `run()`;
- `afterExecute()`;
- `onError()`.

O `EnrollmentApplicationService` continua orquestrando a criacao da Pessoa do
primeiro responsavel quando a validacao passa.

## Limitacoes

Nao foi implementado nesta sprint:

- novas regras de negocio alem das validacoes existentes;
- DTOs novos;
- Queries;
- CQRS completo;
- PersonProfile;
- Relationship;
- Matricula;
- Contrato;
- Financeiro;
- Turmas;
- EventBus;
- Endpoints, controllers, rotas ou APIs;
- Frontend;
- Banco, SQL ou migrations;
- Repositories novos;
- Refatoracoes fora do escopo.

## Auditoria Executada

- `node --check` executado nos arquivos JavaScript criados ou alterados.
- `npm run build` executado com sucesso.
- Smoke test com payload valido executado com sucesso.
- Smoke test com payload invalido executado com sucesso.
- Payload valido confirmou criacao do `CreateEnrollmentCommand`.
- Payload valido confirmou validacao pelo `CreateEnrollmentValidator`.
- Payload valido confirmou criacao somente da Pessoa do primeiro responsavel.
- Payload valido preservou `metadata.step` como `createResponsiblePerson`.
- Payload invalido falhou antes de qualquer chamada ao repository.
- Payload invalido manteve retorno via `onError()`.
- Payload invalido nao persistiu dados.
- Busca confirmou que controllers, rotas, APIs, frontend, banco, SQL e modulos
  legados nao foram integrados ao validator.
- Busca confirmou que `validators/` nao acessa repository, banco, SQL, API,
  frontend ou eventos.

## Proximas Etapas

- Consolidar validadores de Application quando novos Commands forem criados.
- Adicionar testes automatizados de contrato antes de integrar endpoints.
- Evoluir validacoes somente quando novas etapas da matricula forem aprovadas.
