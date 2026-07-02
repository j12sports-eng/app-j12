# Sprint 9.4 - Application Services

Esta sprint separa a orquestracao do processo de matricula da camada de Use
Cases, mantendo o comportamento funcional da Sprint 9.3.

## Objetivo

Introduzir Application Services no dominio Pessoas para que o Use Case deixe de
conhecer diretamente o `PersonRepository`.

Fluxo implementado:

```text
CreateEnrollmentUseCase
->
EnrollmentApplicationService
->
PersonApplicationService
->
PersonRepository
```

## Arquivos Criados

```text
backend/src/domains/pessoas/application/services/person-application.service.js
backend/src/domains/pessoas/application/services/enrollment-application.service.js
backend/src/domains/pessoas/application/services/index.js
docs/BACKEND/SPRINT_9_4.md
```

## Arquivo Atualizado

```text
backend/src/domains/pessoas/application/use-cases/create-enrollment.use-case.js
```

## UseCase vs ApplicationService

O `CreateEnrollmentUseCase` permanece responsavel pelo ciclo de execucao:

- `beforeExecute()`
- `validate()`
- `run()`
- `afterExecute()`
- `onError()`

O `EnrollmentApplicationService` passa a concentrar a orquestracao do fluxo de
matricula. Nesta sprint ele executa somente a etapa
`createResponsiblePerson`.

O `PersonApplicationService` concentra operacoes de Pessoa e encapsula o uso do
`PersonRepository`.

## PersonApplicationService

Implementado nesta sprint:

- `createPerson()`

Responsabilidades futuras:

- `updatePerson()`
- `findPerson()`
- `findPersonByCpf()`
- `validateDuplicatePerson()`

Restricoes:

- Usa exclusivamente o `PersonRepository` existente.
- Nao adiciona regras de negocio novas.
- Nao altera persistencia.
- Nao cria repositories novos.

## EnrollmentApplicationService

Implementado nesta sprint:

- `createEnrollment()`

Responsabilidades futuras:

- `approveEnrollment()`
- `rejectEnrollment()`

Restricoes:

- Usa apenas `PersonApplicationService`.
- Cria somente a Pessoa do primeiro responsavel.
- Prepara o `EnrollmentCreatedEvent`, sem disparar EventBus.
- Nao cria perfil, relacionamento, matricula, contrato, financeiro ou turma.

## Limitacoes

Nao foi implementado nesta sprint:

- PersonProfile.
- Relationship.
- Matricula.
- Contrato.
- Financeiro.
- Turmas.
- EventBus.
- Commands, Queries ou CQRS.
- Endpoints, controllers, rotas ou APIs.
- Frontend.
- Banco, SQL ou migrations.
- Repositories novos.
- Refatoracoes fora do escopo.

## Garantia de Comportamento

O retorno externo permanece igual ao da Sprint 9.3:

```json
{
  "success": true,
  "data": {},
  "warnings": [],
  "errors": [],
  "metadata": {
    "step": "createResponsiblePerson"
  }
}
```

O caminho de erro continua usando `onError()` e nao chama repository quando a
validacao falha.

## Auditoria Executada

| Validacao | Resultado |
| --- | --- |
| `node --check` nos JS criados/alterados | Aprovado em `create-enrollment.use-case.js`, `person-application.service.js`, `enrollment-application.service.js` e `services/index.js`. |
| `npm run build` | Aprovado via `cmd /c npm run build`. |
| Smoke test com payload valido | Aprovado usando `CreateEnrollmentUseCase -> EnrollmentApplicationService -> PersonApplicationService -> PersonRepository` injetado. |
| Pessoa criada corretamente | Aprovado: 1 chamada para `personRepository.create()`. |
| Retorno preservado | Aprovado: chaves `success`, `data`, `warnings`, `errors`, `metadata`; `metadata.step = createResponsiblePerson`. |
| Evento | Apenas preparado como `EnrollmentCreatedEvent`; `dispatched: false`. |
| Perfil, relacionamento, matricula, contrato, financeiro e turma | Nenhum criado. |
| Smoke test com payload invalido | Aprovado: `onError()` retornou o contrato padrao. |
| Repository em payload invalido | Nao chamado; o Use Case padrao tambem falha na validacao antes de instanciar repository. |
| Dependencia direta do UseCase | Nenhum uso de `PersonRepository`, `PersonApplicationService` ou `EnrollmentCreatedEvent` no Use Case. |
| Busca em controllers, rotas, APIs e frontend | Nenhuma referencia nova ao Use Case ou Application Services encontrada. |

Observacao: o smoke test usa repository injetado para validar a arquitetura sem
alterar dados reais do ambiente local.
