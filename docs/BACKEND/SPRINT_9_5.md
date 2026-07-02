# Sprint 9.5 - Create Enrollment Command

Esta sprint cria o `CreateEnrollmentCommand` para representar explicitamente o
contrato de entrada do fluxo de matricula, sem alterar o comportamento funcional
da Sprint 9.4.

## Objetivo

Encapsular o payload recebido pelo `CreateEnrollmentUseCase` em uma estrutura de
entrada simples, preparando o backend para futuras integracoes com endpoints,
validacao centralizada e frontend.

Fluxo implementado:

```text
Payload
->
CreateEnrollmentCommand
->
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
backend/src/domains/pessoas/application/commands/create-enrollment.command.js
backend/src/domains/pessoas/application/commands/index.js
docs/BACKEND/SPRINT_9_5.md
```

## Arquivos Atualizados

```text
backend/src/domains/pessoas/application/use-cases/create-enrollment.use-case.js
backend/src/domains/pessoas/application/services/enrollment-application.service.js
```

## Responsabilidade de Commands

Commands representam entrada de aplicacao. Nesta sprint o
`CreateEnrollmentCommand`:

- recebe o payload original;
- preserva o formato usado pela validacao atual;
- expoe `getPayload()`;
- expoe `getFirstResponsible()`;
- expoe `hasResponsible()`;
- nao valida;
- nao acessa banco;
- nao chama repository;
- nao executa persistencia;
- nao dispara evento;
- nao integra APIs.

## Command vs UseCase vs ApplicationService

O `CreateEnrollmentCommand` carrega dados de entrada e fornece metodos de
leitura.

O `CreateEnrollmentUseCase` continua responsavel pelo ciclo:

- `beforeExecute()`;
- `validate()`;
- `run()`;
- `afterExecute()`;
- `onError()`.

O `EnrollmentApplicationService` continua responsavel pela orquestracao da
matricula. Nesta sprint ele apenas usa o Command para obter o primeiro
responsavel.

O `PersonApplicationService` continua encapsulando o `PersonRepository`.

## Limitacoes

Nao foi implementado nesta sprint:

- Validators novos.
- DTOs novos.
- Queries.
- CQRS completo.
- PersonProfile.
- Relationship.
- Matricula.
- Contrato.
- Financeiro.
- Turmas.
- EventBus.
- Endpoints, controllers, rotas ou APIs.
- Frontend.
- Banco, SQL ou migrations.
- Repositories novos.
- Refatoracoes fora do escopo.

## Proximas Etapas

- Centralizar validacoes em camada propria quando aprovado.
- Preparar endpoint somente em sprint futura.
- Evoluir Command para cobrir novas etapas da matricula.
- Manter testes de contrato antes de integrar com rotas ou frontend.

## Auditoria Executada

| Validacao | Resultado |
| --- | --- |
| `node --check` nos JS criados/alterados | Aprovado em `create-enrollment.command.js`, `commands/index.js`, `create-enrollment.use-case.js` e `enrollment-application.service.js`. |
| `npm run build` | Aprovado via `cmd /c npm run build`. |
| Smoke test com payload valido | Aprovado. |
| `CreateEnrollmentCommand` criado corretamente | Aprovado: `getPayload()`, `getFirstResponsible()` e `hasResponsible()` validados. |
| Pessoa do primeiro responsavel | Continua sendo criada via `EnrollmentApplicationService -> PersonApplicationService -> PersonRepository`. |
| Retorno | Preservado com `success`, `data`, `warnings`, `errors` e `metadata`. |
| `metadata.step` | Preservado como `createResponsiblePerson`. |
| Smoke test com payload invalido | Aprovado: `onError()` retornou o contrato padrao. |
| Repository em payload invalido | Nao chamado. |
| Persistencia no Command | Nenhuma. |
| Busca em commands | Nenhum uso de repository, banco, SQL, evento, APIs ou frontend. |
| Busca em controllers, rotas, APIs e frontend | Nenhuma referencia nova ao Command encontrada. |

Observacao: os smoke tests usam repository injetado para validar o fluxo sem
alterar dados reais do ambiente local.
