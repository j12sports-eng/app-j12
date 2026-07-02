# Contract Termination

Modelo conceitual unico para rescisao contratual.

## Objetivo

Padronizar a rescisao de contratos de alunos, professores, locatarios,
funcionarios e prestadores, preservando historico, calculos financeiros,
documentos, aprovacao e auditoria.

## Entidade Conceitual

```text
ContractTermination
```

Atributos:

- `terminationId`
- `contractId`
- `reason`
- `reasonCategory`
- `requestedBy`
- `requestedByProfileId`
- `requestedAt`
- `effectiveDate`
- `noticePeriod`
- `penaltyAmount`
- `outstandingAmount`
- `refundAmount`
- `approvedBy`
- `approvedByProfileId`
- `approvedAt`
- `status`
- `notes`
- `attachments`
- `createdAt`
- `updatedAt`

## Status de Rescisao

| Status | Significado |
| --- | --- |
| `REQUESTED` | Rescisao solicitada. |
| `UNDER_REVIEW` | Em analise administrativa/financeira. |
| `APPROVED` | Aprovada, aguardando data efetiva ou baixa. |
| `REJECTED` | Negada com justificativa. |
| `EFFECTIVE` | Rescisao efetivada. |
| `CANCELLED` | Solicitacao cancelada antes de efetivar. |

## Motivos

Categorias:

- `CLIENT_REQUEST`
- `J12_REQUEST`
- `NON_PAYMENT`
- `DISCIPLINE`
- `MEDICAL`
- `SCHEDULE_UNAVAILABLE`
- `FORCE_MAJEURE`
- `CONTRACT_BREACH`
- `END_OF_RELATIONSHIP`
- `OTHER`

Cada motivo deve aceitar observacao detalhada.

## Fluxo

```text
Solicitar rescisao
->
Registrar motivo e data solicitada
->
Levantar financeiro pendente
->
Calcular multa, proporcional e reembolso
->
Anexar documentos quando necessario
->
Enviar para aprovacao
->
Aprovar ou rejeitar
->
Definir data efetiva
->
Executar baixa financeira
->
Atualizar contrato para TERMINATED
->
Registrar historico
```

## Campos Obrigatorios

| Campo | Obrigatorio | Observacao |
| --- | --- | --- |
| `contractId` | Sim | Contrato ativo ou suspenso. |
| `reason` | Sim | Motivo textual. |
| `reasonCategory` | Sim | Categoria canonica. |
| `requestedBy` | Sim | Pessoa/usuario solicitante. |
| `requestedAt` | Sim | Data/hora da solicitacao. |
| `effectiveDate` | Sim para efetivar | Data de fim real. |
| `approvedBy` | Sim para aprovar | Responsavel interno. |
| `approvedAt` | Sim para aprovar | Data/hora da aprovacao. |

## Aviso Previo

`noticePeriod` deve representar:

- Quantidade de dias de aviso.
- Data inicial de contagem.
- Data final esperada.
- Se houve dispensa de aviso.
- Quem aprovou a dispensa.

## Multas e Calculo Proporcional

O processo deve registrar:

- Valor de multa.
- Base de calculo.
- Meses/dias restantes.
- Valor proporcional devido.
- Valor ja pago.
- Valor em aberto.
- Valor a reembolsar.
- Decisao administrativa de isencao, se houver.

Para aluno, o contrato atual menciona multa de 50% dos meses restantes. A
arquitetura deve permitir essa regra sem fixar a regra no dominio generico,
pois outros tipos terao calculos diferentes.

## Obrigacoes Pendentes

Antes de efetivar:

- Cobrancas vencidas.
- Cobrancas futuras.
- Materiais/equipamentos emprestados.
- Documentos pendentes.
- Chaves/acessos.
- Agenda/reservas futuras.
- Assinaturas e anexos obrigatorios.

## Documentos Anexos

Possiveis anexos:

- Solicitação assinada.
- Conversa autorizada.
- Termo de distrato.
- Comprovante de pagamento.
- Comprovante de reembolso.
- Documentos medicos.
- Evidencias de inadimplencia.

## Auditoria

Eventos obrigatorios em `ContractHistory`:

- `TERMINATION_REQUESTED`
- `TERMINATION_REVIEW_STARTED`
- `TERMINATION_APPROVED`
- `TERMINATION_REJECTED`
- `TERMINATION_EFFECTIVE`
- `FINANCIAL_SETTLEMENT_CREATED`
- `CONTRACT_STATUS_CHANGED`

## Regras

- Rescisao aprovada deve apontar para um contrato especifico.
- Contrato rescindido nao deve ser editado.
- Rescisao nao apaga cobrancas anteriores.
- Cobrancas futuras podem ser canceladas, recalculadas ou substituidas por
  saldo de rescisao.
- Reembolso deve ser rastreavel.
- Rejeicao deve ter motivo.

