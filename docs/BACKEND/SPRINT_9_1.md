# Sprint 9.1 - Application Layer e CreateEnrollmentUseCase

Esta sprint inicia a camada `Application` do dominio Pessoas sem alterar
funcionalidades existentes do ERP.

## Escopo

Criado em:

```text
backend/src/domains/pessoas/application/
  use-cases/
  dtos/
  contracts/
  interfaces/
  events/
```

Nao foi alterado:

- Cadastro atual de alunos.
- Cadastro atual de responsaveis.
- Professores.
- Funcionarios.
- Locatarios.
- Dashboard.
- Financeiro.
- Agenda.
- Contratos existentes.
- Frontend.
- Rotas.
- Controllers.
- APIs existentes.
- Banco de dados.
- SQL.
- Repositories existentes.
- Services existentes.

## Finalidade da Camada Application

A camada `Application` passa a ser o limite para casos de uso do dominio
Pessoas. Ela coordena validacoes e planos de execucao, mas nesta sprint ainda
nao executa persistencia nem integra com modulos existentes.

Responsabilidades futuras:

- Orquestrar casos de uso.
- Validar entrada em nivel de aplicacao.
- Montar planos de execucao.
- Coordenar contratos de interfaces.
- Emitir eventos quando a integracao for aprovada em sprint futura.

## CreateEnrollmentUseCase

Arquivo:

```text
backend/src/domains/pessoas/application/use-cases/create-enrollment.use-case.js
```

Responsabilidade:

- Receber payload conceitual de matricula.
- Validar estrutura minima.
- Validar dados de aluno.
- Validar responsaveis.
- Validar relacionamento.
- Validar perfis necessarios.
- Retornar um plano de execucao.

Restricoes:

- Nao grava dados.
- Nao chama MySQL.
- Nao utiliza Repository.
- Nao altera banco.
- Nao cria Pessoas.
- Nao cria Perfis.
- Nao cria Relacionamentos.
- Nao executa eventos.
- Sempre retorna `executable: false`.

Plano retornado:

```json
{
  "steps": [
    "createResponsiblePerson",
    "createResponsibleProfile",
    "createStudentPerson",
    "createStudentProfile",
    "createRelationship",
    "createEnrollment",
    "generateContract",
    "generateFinancialPlan",
    "assignClass",
    "activateStudent"
  ],
  "executable": false
}
```

## DTOs

Arquivos:

- `create-enrollment-request.dto.js`
- `create-enrollment-response.dto.js`

Responsabilidade:

- Representar entrada e saida do use case.
- Manter independencia de banco, SQL, Express e modulos atuais.
- Padronizar o formato do plano retornado.

## Contracts

Arquivo:

- `enrollment.contract.js`

Responsabilidade:

- Declarar payload esperado.
- Declarar resposta esperada.
- Declarar campos obrigatorios.
- Declarar steps do plano conceitual.

O contrato nao executa validacao e nao possui persistencia.

## Interfaces

Arquivos:

- `iperson.repository.js`
- `iprofile.repository.js`
- `irelationship.repository.js`
- `ienrollment.repository.js`
- `icontract.service.js`
- `ifinancial.service.js`
- `iclass.service.js`

Responsabilidade:

- Definir contratos JSDoc para dependencias futuras.
- Preparar inversao de dependencia.
- Evitar acoplamento direto com repositorios e services concretos.

Nesta sprint nenhuma interface possui implementacao concreta.

## Events

Arquivos:

- `enrollment-created.event.js`
- `enrollment-approved.event.js`
- `enrollment-rejected.event.js`

Responsabilidade:

- Reservar estrutura conceitual de eventos de dominio.
- Definir nomes e payloads esperados para evolucao futura.

Nenhum evento e disparado nesta sprint.

## Uso Futuro

Em sprint futura, apos aprovacao explicita, o use case podera receber
implementacoes concretas via interfaces:

```text
CreateEnrollmentUseCase
  -> IPersonRepository
  -> IProfileRepository
  -> IRelationshipRepository
  -> IEnrollmentRepository
  -> IContractService
  -> IFinancialService
  -> IClassService
```

Antes dessa integracao, deverao existir testes de contrato, transacao,
idempotencia e compatibilidade com os cadastros atuais.

## Auditoria Esperada

- `npm run build`.
- `node --check` nos arquivos novos.
- Verificacao de que nenhum modulo existente importa `application`.
- Verificacao de que nao houve alteracao em rotas, controllers, services,
  repositories, SQL ou frontend.

## Auditoria Executada

Resultado desta sprint:

| Validacao | Resultado |
| --- | --- |
| `npm run build` | Aprovado. |
| `node --check` nos JS novos | Aprovado em 20 arquivos. |
| Busca por importacao da nova camada em modulos existentes | Nenhuma ocorrencia encontrada. |
| Busca por MySQL, SQL, pool ou query na camada Application | Nenhuma ocorrencia encontrada. |
| Smoke conceitual do use case | Retornou `valid: true`, `executable: false`, 10 steps e 0 erros para payload valido. |
| Rotas/controllers/services/repositories atuais | Nao alterados por esta sprint. |
| Banco/SQL/migrations | Nao alterados por esta sprint. |

Observacao: a build gera artefatos em `dist/` como comportamento normal do
script, mas nao houve alteracao rastreada em `dist/` no escopo desta sprint.
