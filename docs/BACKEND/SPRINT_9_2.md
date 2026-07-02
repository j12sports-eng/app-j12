# Sprint 9.2 - Camada de Transacoes

Esta sprint cria a infraestrutura conceitual de transacoes para futuros Use
Cases da aplicacao.

## Escopo

Criado em:

```text
backend/src/core/transactions/
  TransactionManager.js
  TransactionContext.js
  UnitOfWork.js
  BaseUseCase.js
  index.js
```

Nao foi alterado:

- Controllers existentes.
- Services existentes.
- Repositories existentes.
- Banco de dados.
- SQL.
- APIs.
- Frontend.
- Rotas.
- Modulos atuais.

## Objetivo da Camada

A camada `core/transactions` prepara um contrato interno para coordenar
operacoes transacionais futuras sem acoplar os Use Cases a um driver especifico
de banco.

Nesta sprint ela nao usa:

- `mysql2`.
- SQL.
- Repositories concretos.
- Services concretos.
- Controllers.
- Rotas.
- APIs.

## TransactionManager

Arquivo:

```text
backend/src/core/transactions/TransactionManager.js
```

Responsabilidade:

- Criar um `TransactionContext` conceitual com `begin()`.
- Marcar contexto como concluido com `commit()`.
- Marcar contexto como revertido com `rollback()`.

Restricoes:

- Nao abre transacao real.
- Nao executa comando SQL.
- Nao conhece `mysql2`.
- Nao guarda conexao de banco.

## TransactionContext

Arquivo:

```text
backend/src/core/transactions/TransactionContext.js
```

Responsabilidade:

- Armazenar metadados da unidade transacional.
- Guardar `id`, `status`, `metadata`, `startedAt` e `completedAt`.
- Servir como objeto de contexto futuro entre Use Cases e Unit of Work.

Restricoes:

- Nao acessa banco.
- Nao carrega connection.
- Nao conhece repositories.

## UnitOfWork

Arquivo:

```text
backend/src/core/transactions/UnitOfWork.js
```

Responsabilidade:

- Coordenar a execucao de uma unidade logica.
- Criar contexto via `TransactionManager`.
- Chamar a unidade recebida.
- Marcar sucesso ou erro no contexto conceitual.

Restricoes:

- Nao executa SQL.
- Nao instancia repositories.
- Nao conhece services existentes.
- Nao e usado por nenhum modulo atual nesta sprint.

## BaseUseCase

Arquivo:

```text
backend/src/core/transactions/BaseUseCase.js
```

Responsabilidade:

- Definir fluxo padrao para Use Cases futuros:

```text
beforeExecute()
->
validate()
->
run()
->
afterExecute()
->
return
```

Metodos:

- `execute(input, context)`
- `validate(input, context)`
- `run(input, context)`
- `beforeExecute(input, context)`
- `afterExecute(result, input, context)`
- `onError(error, input, context)`

Restricoes:

- Nao contem regra de negocio concreta.
- Nao chama banco.
- Nao chama repositories.
- Nao e usado pelos Use Cases atuais nesta sprint.

## Uso Futuro

Em sprint futura, um Use Case podera herdar de `BaseUseCase` e ser executado
dentro de `UnitOfWork`, quando a integracao for aprovada.

Fluxo futuro conceitual:

```text
Controller
->
UseCase extends BaseUseCase
->
UnitOfWork
->
TransactionManager
->
Repositories via interfaces
```

Esse fluxo ainda nao foi implementado nem conectado.

## Garantias da Sprint

- Infraestrutura criada de forma desacoplada.
- Nenhum modulo existente depende de `core/transactions`.
- Nenhuma transacao real e executada.
- Nenhum acesso ao banco e feito.
- Nenhum endpoint e criado.
- Nenhuma funcionalidade atual e alterada.

## Auditoria Esperada

- `npm run build`.
- `node --check` nos arquivos novos.
- Confirmar que nenhum modulo existente importa `core/transactions`.
- Confirmar que nao ha uso de `mysql2`, SQL, pool ou query nessa camada.
- Confirmar que routes, controllers, services e repositories nao foram
  modificados por esta sprint.

