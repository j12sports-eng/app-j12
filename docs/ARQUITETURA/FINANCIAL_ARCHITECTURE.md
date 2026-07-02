# Financial Architecture

Arquitetura conceitual da integracao entre contratos e financeiro.

## Fluxo Alvo

```text
Contract
->
PaymentPlan
->
Recebimentos
->
Cobrancas
->
Inadimplencia
->
Rescisao
->
Baixa Financeira
```

## Responsabilidades

### Contract

- Define acordo, vigencia, partes e condicoes.
- Nao executa cobranca diretamente.
- Informa parametros para `PaymentPlan`.

### PaymentPlan

- Representa plano financeiro derivado do contrato.
- Define parcelas, vencimentos, recorrencia, desconto, multa e juros.
- Deve apontar para contrato e versao de origem.

### Recebimentos

- Registram valores recebidos.
- Devem apontar para cobranca/parcela.
- Podem vir de Pix, dinheiro, cartao, boleto ou ajuste manual.

### Cobrancas

- Representam obrigacoes financeiras emitidas.
- Devem preservar responsavel financeiro vigente no momento da emissao.
- Nao devem depender de dados vivos que possam mudar sem historico.

### Inadimplencia

- Estado derivado de cobrancas vencidas.
- Pode suspender contrato ou enrollment conforme regra.
- Deve gerar historico e notificacoes.

### Rescisao

- Calcula saldo, multa, reembolso e cancelamento de futuras cobrancas.
- Deve usar `ContractTermination`.

### Baixa Financeira

- Confirma pagamento, cancelamento, estorno, desconto ou reembolso.
- Deve ser auditavel.

## Regras

- Contrato ativo pode gerar `PaymentPlan`.
- Contrato em rascunho nao deve gerar cobranca definitiva.
- Contrato pendente de assinatura pode gerar previsao, mas nao cobranca final
  sem decisao explicita.
- Cobranca emitida deve preservar snapshot de pagador/responsavel financeiro.
- Alterar contrato nao deve alterar cobrancas ja pagas.
- Rescisao deve cancelar ou recalcular cobrancas futuras, nao apagar historico.
- Baixas manuais devem exigir permissao e motivo.

## Eventos Financeiros

- `PAYMENT_PLAN_CREATED`
- `CHARGE_CREATED`
- `CHARGE_CANCELLED`
- `PAYMENT_RECEIVED`
- `PAYMENT_OVERDUE`
- `DELINQUENCY_STARTED`
- `CONTRACT_SUSPENDED_BY_DELINQUENCY`
- `TERMINATION_BALANCE_CALCULATED`
- `REFUND_CREATED`
- `FINANCIAL_SETTLEMENT_DONE`

## Integracao por Tipo

### Aluno

- Gera mensalidade, matricula, uniforme, evento e multas.
- Responsavel financeiro vem do relacionamento aluno-responsavel.
- Suspensao pode afetar presenca/turma.

### Professor

- Pode gerar contas a pagar, repasses ou recibos.
- Valores podem depender de aulas, turmas ou contrato fixo.

### Locatario

- Pode gerar cobranca por reserva, pacote, caução, multa de cancelamento.
- Integra com agenda/quadra.

### Funcionario

- Futuro: folha, adiantamentos, beneficios, descontos.
- Pode integrar com sistema externo, nao necessariamente financeiro atual.

### Prestador

- Contas a pagar mediante nota, contrato e aceite do servico.

## Riscos e Controles

| Risco | Controle |
| --- | --- |
| Duplicar cobrancas por reenvio | Idempotencia por contrato/versao/plano. |
| Alterar contrato e quebrar historico financeiro | Versionamento e snapshots. |
| Rescindir sem calcular saldo | `ContractTermination` obrigatorio. |
| Baixa sem auditoria | Historico e permissao. |
| Responsavel financeiro mudou | Cobranca preserva responsavel da emissao. |

