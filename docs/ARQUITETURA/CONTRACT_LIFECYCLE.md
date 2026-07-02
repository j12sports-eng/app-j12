# Contract Lifecycle

Modelo conceitual do ciclo de vida de contratos da J12 Sports.

## Estados

```text
DRAFT
->
PENDING_APPROVAL
->
PENDING_SIGNATURE
->
ACTIVE
->
SUSPENDED
->
RENEWED
->
ENDED
->
TERMINATED
->
ARCHIVED
```

Estados adicionais:

- `CANCELLED`: contrato cancelado antes de entrar em vigor ou antes de
  assinatura final.

## Descricao dos Estados

| Estado | Significado |
| --- | --- |
| `DRAFT` | Contrato em preparacao, ainda editavel. |
| `PENDING_APPROVAL` | Conteudo pronto aguardando aprovacao interna. |
| `PENDING_SIGNATURE` | Aprovado e enviado para assinatura. |
| `ACTIVE` | Assinado e vigente. |
| `SUSPENDED` | Vigente, mas temporariamente bloqueado. |
| `RENEWED` | Substituido ou continuado por renovacao. |
| `ENDED` | Encerrado por termino natural da vigencia. |
| `TERMINATED` | Rescindido antes do termino previsto. |
| `CANCELLED` | Cancelado antes de produzir efeitos completos. |
| `ARCHIVED` | Retido somente para consulta historica/auditoria. |

## Transicoes Permitidas

| Origem | Destino | Condicao |
| --- | --- | --- |
| `DRAFT` | `PENDING_APPROVAL` | Campos minimos completos. |
| `DRAFT` | `CANCELLED` | Rascunho descartado antes de assinatura. |
| `PENDING_APPROVAL` | `DRAFT` | Ajustes solicitados. |
| `PENDING_APPROVAL` | `PENDING_SIGNATURE` | Aprovacao interna concluida. |
| `PENDING_APPROVAL` | `CANCELLED` | Aprovacao negada ou contrato abandonado. |
| `PENDING_SIGNATURE` | `ACTIVE` | Todas as assinaturas obrigatorias concluidas. |
| `PENDING_SIGNATURE` | `DRAFT` | Alteracao material exige nova versao antes de assinar. |
| `PENDING_SIGNATURE` | `CANCELLED` | Partes desistem antes da ativacao. |
| `ACTIVE` | `SUSPENDED` | Inadimplencia, bloqueio operacional ou decisao administrativa. |
| `SUSPENDED` | `ACTIVE` | Regularizacao financeira/operacional. |
| `ACTIVE` | `RENEWED` | Renovacao aprovada com nova vigencia/versao/contrato. |
| `ACTIVE` | `ENDED` | Vigencia chegou ao fim sem renovacao. |
| `ACTIVE` | `TERMINATED` | Rescisao aprovada antes do fim. |
| `SUSPENDED` | `TERMINATED` | Rescisao durante suspensao. |
| `RENEWED` | `ARCHIVED` | Retencao historica apos renovacao. |
| `ENDED` | `ARCHIVED` | Retencao historica apos encerramento. |
| `TERMINATED` | `ARCHIVED` | Retencao historica apos rescisao. |
| `CANCELLED` | `ARCHIVED` | Retencao de rascunho/cancelamento quando necessario. |

## Regras por Estado

### DRAFT

- Permite edicao.
- Nao permite assinatura.
- Nao deve gerar cobranca definitiva.
- Pode ter anexos preliminares.

### PENDING_APPROVAL

- Conteudo congelado para revisao.
- Alteracao material retorna para `DRAFT`.
- Aprovacao deve gerar evento no historico.

### PENDING_SIGNATURE

- Versao a ser assinada deve estar congelada.
- Assinaturas devem apontar para `ContractVersion`.
- Mudanca de valor, vigencia, parte ou clausula retorna para `DRAFT` com nova
  versao.

### ACTIVE

- Contrato vigente.
- Pode gerar ou manter `PaymentPlan`.
- Pode receber anexos e eventos.
- Alteracoes materiais exigem nova versao.

### SUSPENDED

- Deve indicar motivo.
- Deve preservar cobrancas, historico e contrato.
- Pode bloquear acesso, agenda, turma ou uso de quadra conforme tipo.
- Regularizacao deve gerar evento de retorno a `ACTIVE`.

### RENEWED

- Indica que contrato teve continuidade formal.
- Renovacao pode gerar nova versao ou novo contrato, conforme regra do tipo.
- Contrato anterior deve continuar consultavel.

### ENDED

- Encerramento natural.
- Nao deve criar novas cobrancas.
- Deve preservar cobrancas ja emitidas.

### TERMINATED

- Encerramento antecipado com processo formal de rescisao.
- Deve apontar para `ContractTermination`.
- Pode gerar multa, saldo, reembolso ou baixa.

### ARCHIVED

- Estado de retencao.
- Nao permite operacao comercial nova.
- Consulta deve respeitar LGPD, permissoes e prazo de guarda.

## Eventos Obrigatorios

Todo cambio de status deve criar `ContractHistory` com:

- `fromStatus`
- `toStatus`
- `actorId`
- `occurredAt`
- `reason`
- `metadata`

## Restrições

- Contrato assinado nao deve voltar a ser editavel diretamente.
- Rescisao nao deve ser representada apenas como `cancelado`.
- Suspensao nao deve apagar cobrancas nem assinatura.
- Arquivamento nao deve excluir historico.

