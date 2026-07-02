# Sprint 9.3 - Primeiro Use Case Executavel

Esta sprint transforma o `CreateEnrollmentUseCase` no primeiro fluxo
parcialmente executavel da arquitetura nova do dominio Pessoas.

## Fluxo Implementado

Fluxo aprovado para esta sprint:

```text
Payload
->
beforeExecute()
->
validate()
->
run()
->
Criar Pessoa do Responsavel
->
afterExecute()
->
Retornar resultado padronizado
```

Em caso de erro, o fluxo passa por `onError()` e retorna o mesmo contrato de
saida.

## Arquivos Alterados

```text
backend/src/domains/pessoas/application/use-cases/create-enrollment.use-case.js
backend/src/domains/pessoas/application/events/enrollment-created.event.js
docs/BACKEND/SPRINT_9_3.md
```

## Responsabilidades

### CreateEnrollmentUseCase

- Estende `BaseUseCase`.
- Usa o ciclo `beforeExecute()`, `validate()`, `run()`, `afterExecute()` e
  `onError()`.
- Normaliza o payload com `CreateEnrollmentRequest`.
- Valida dados de aluno, responsavel, relacionamento e matricula conforme o
  contrato existente.
- Persiste somente a Pessoa do primeiro responsavel usando `PersonRepository`.
- Retorna resultado no padrao:

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

### PersonRepository

Nesta sprint o use case chama apenas `personRepository.create()` para gravar a
Pessoa do responsavel na tabela independente `people`.

Nenhum repository de perfil, relacionamento, pre-matricula, contrato,
financeiro, turma ou modulo legado e chamado.

### EnrollmentCreatedEvent

Foi preparada a estrutura do evento `EnrollmentCreatedEvent`.

O evento:

- nao e disparado;
- nao usa EventBus;
- nao integra listeners;
- nao confirma criacao de matricula;
- acompanha o retorno para uso futuro.

## Limitacoes

Esta sprint nao cria:

- Pessoa do aluno.
- Perfil de responsavel.
- Perfil de aluno.
- Relacionamentos.
- Matricula.
- Contrato.
- Financeiro.
- Turma.

Tambem nao altera:

- Cadastro atual de alunos.
- Cadastro atual de responsaveis.
- Dashboard.
- Financeiro.
- Agenda.
- Contratos.
- Frontend.
- Rotas.
- Controllers.
- APIs atuais.
- Modulos legados.

## Proximos Passos

- Adicionar criacao do perfil de responsavel em sprint futura.
- Adicionar criacao da Pessoa do aluno somente apos aprovacao.
- Envolver o fluxo em `UnitOfWork` quando a camada transacional real for
  aprovada.
- Criar testes de contrato e idempotencia antes de integrar com rotas.
- Definir EventBus antes de disparar eventos de dominio.

## Auditoria Esperada

- `npm run build`.
- `node --check` nos arquivos alterados.
- Smoke test do `CreateEnrollmentUseCase`.
- Confirmar que apenas Pessoa do responsavel e criada.
- Confirmar que nenhum perfil, relacionamento, matricula, contrato, financeiro
  ou turma e criado.
- Confirmar que nenhum modulo legado, API, rota ou controller foi alterado por
  esta sprint.

## Auditoria Executada

| Validacao | Resultado |
| --- | --- |
| `npm run build` | Aprovado via `cmd /c npm run build`. |
| `node --check` | Aprovado em `create-enrollment.use-case.js` e `enrollment-created.event.js`. |
| Smoke test do `CreateEnrollmentUseCase` | Aprovado com `personRepository` injetado. |
| Pessoa Responsavel criada corretamente | Aprovado: 1 chamada para `personRepository.create()`. |
| Perfil criado | Nenhum. |
| Relacionamento criado | Nenhum. |
| Matricula criada | Nenhuma. |
| Contrato criado | Nenhum. |
| Financeiro criado | Nenhum. |
| Evento de dominio | Apenas preparado; `dispatched: false`. |
| Rotas/controllers/APIs | Nenhuma referencia ao use case encontrada. |
| Dependencias adicionais no use case | Nenhum uso de PersonService, UnitOfWork, transacao real, perfil, relacionamento, matricula, contrato, financeiro ou turma. |

Observacao: o smoke test usou repository injetado para validar a arquitetura sem
alterar dados reais do ambiente local.
