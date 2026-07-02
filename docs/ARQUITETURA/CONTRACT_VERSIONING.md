# Contract Versioning

Modelo conceitual de versionamento contratual.

## Objetivo

Preservar historico completo de alteracoes, garantindo que contratos assinados
continuem imutaveis e auditaveis.

## Modelo

```text
Contrato 001
->
Versao 1
->
Versao 2
->
Versao 3
```

`Contract` e a raiz. `ContractVersion` guarda o documento, variaveis e hash de
cada versao.

## Quando Criar Nova Versao

Criar nova `ContractVersion` quando houver:

- Alteracao de valor.
- Alteracao de vigencia.
- Alteracao de plano.
- Alteracao de unidade, horario ou modalidade contratada.
- Alteracao de parte assinante.
- Alteracao de clausula.
- Renovacao com novas condicoes.
- Aditivo contratual.
- Correcao material em contrato pendente de assinatura.

Nao criar nova versao para:

- Upload de anexo sem alterar contrato.
- Evento de historico.
- Alteracao cadastral de pessoa que nao muda snapshot assinado.
- Baixa financeira.

## Imutabilidade

- Versao assinada nao deve ser alterada.
- Versao enviada para assinatura deve ficar congelada.
- Nova versao deve possuir `changeReason`.
- Comparacao entre versoes deve ser possivel.

## Atributos de ContractVersion

- `versionId`
- `contractId`
- `versionNumber`
- `status`
- `contentSnapshot`
- `variablesSnapshot`
- `documentHash`
- `previousVersionId`
- `changeReason`
- `createdBy`
- `createdAt`
- `approvedBy`
- `approvedAt`
- `effectiveFrom`
- `effectiveUntil`

## Status de Versao

- `DRAFT`
- `PENDING_APPROVAL`
- `APPROVED`
- `PENDING_SIGNATURE`
- `SIGNED`
- `SUPERSEDED`
- `VOIDED`

## Renovacao: Novo Contrato ou Nova Versao?

Decisao arquitetural:

- Renovacao sem mudanca substancial e com continuidade operacional deve criar
  nova `ContractVersion` no mesmo `Contract`.
- Renovacao com nova relacao juridica, novo objeto, nova parte principal ou
  ruptura de continuidade deve criar novo `Contract` relacionado ao anterior.

Justificativa:

- Nova versao preserva linha historica quando o contrato continua o mesmo acordo
  com novas condicoes.
- Novo contrato evita misturar relacoes juridicas diferentes em uma unica raiz.

Exemplos:

| Situacao | Resultado |
| --- | --- |
| Aluno renova plano anual com reajuste e mesma responsabilidade | Nova versao. |
| Aluno muda responsavel financeiro mas mantem matricula | Nova versao/aditivo. |
| Aluno encerra e retorna meses depois em nova matricula | Novo contrato. |
| Locatario fecha novo evento independente | Novo contrato. |
| Professor muda de prestador para funcionario | Novo contrato de outro tipo. |

## Historico Obrigatorio

Cada nova versao deve gerar evento:

- `CONTRACT_VERSION_CREATED`
- `CONTRACT_VERSION_APPROVED`
- `CONTRACT_VERSION_SENT_TO_SIGNATURE`
- `CONTRACT_VERSION_SIGNED`
- `CONTRACT_VERSION_SUPERSEDED`

