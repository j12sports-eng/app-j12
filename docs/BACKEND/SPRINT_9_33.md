# Sprint 9.33 - Preparar Confirmacao Interna De DraftEnrollment

## Objetivo

Preparar a confirmacao interna de uma matricula persistida em `DRAFT`, sem
integrar frontend, API publica, financeiro, mensalidades, turmas ou legado.

Fluxo preparado:

```text
draftEnrollment -> enrollment ACTIVE
```

## Metodo Criado

Metodo application-level:

```js
confirmDraftEnrollment({
  enrollmentId,
  confirmedBy,
  confirmedAt,
})
```

Arquivo:

```text
backend/src/domains/enrollments/application/services/enrollment-application.service.js
```

O metodo nao expoe o repository concreto para camadas superiores. Ele usa o
contrato de repository injetado pela camada de aplicacao.

## Contrato De Entrada

Campos:

```text
enrollmentId: string obrigatorio
confirmedBy: string opcional
confirmedAt: string opcional
```

`enrollmentId` e normalizado com `trim()` e limite de 64 caracteres.

## Contrato De Saida

Quando confirma um `DRAFT`:

```js
{
  alreadyConfirmed: false,
  confirmed: true,
  confirmedAt,
  confirmedBy,
  enrollment,
  status: "ACTIVE"
}
```

Quando a matricula ja esta em `ACTIVE`:

```js
{
  alreadyConfirmed: true,
  confirmed: false,
  confirmedAt,
  confirmedBy,
  enrollment,
  status: "ACTIVE"
}
```

## Validacoes De Status

Regras implementadas:

- `DRAFT` pode ser confirmado;
- `ACTIVE` e tratado como ja confirmado;
- qualquer outro status valido do dominio gera erro controlado;
- matricula inexistente gera erro controlado;
- `enrollmentId` ausente gera erro controlado.

Codigos exportados:

```text
CONFIRM_DRAFT_ENROLLMENT_ID_REQUIRED
CONFIRM_DRAFT_ENROLLMENT_NOT_FOUND
CONFIRM_DRAFT_ENROLLMENT_INVALID_STATUS
```

## Repository

Contrato documentado:

```text
findById(id)
updateStatus(id, status, { updatedAt })
```

Implementacao MySQL:

```text
backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment.repository.js
```

A atualizacao persiste apenas:

```text
status
updated_at
```

## Bloqueios Encontrados

Consulta somente leitura no schema confirmou que `enrollments` possui:

```text
status varchar(32) NOT NULL
updated_at datetime NOT NULL
```

Nao existem:

```text
confirmed_at
confirmed_by
```

Por isso, esta sprint nao persiste `confirmedAt` nem `confirmedBy`. Esses
campos ficam preparados no contrato de entrada/saida e devem receber migration
propria antes de uso operacional completo.

## Update Real

Houve update real somente no campo `status`, com transicao:

```text
DRAFT -> ACTIVE
```

O update tambem ajusta `updated_at` usando o valor normalizado de `confirmedAt`
quando informado, ou `CURRENT_TIMESTAMP` quando ausente.

Nenhum outro dado e alterado.

## Smoke Tests

Smoke test executado no MySQL remoto com transacao e rollback.

Cenarios validados:

- confirmacao de matricula `DRAFT`;
- tentativa de confirmar matricula inexistente;
- tentativa de confirmar matricula ja `ACTIVE`;
- tentativa de confirmar matricula em status invalido para confirmacao;
- ausencia de efeitos em financeiro/mensalidades;
- ausencia de efeitos em turmas/classes;
- fluxo oficial de criacao idempotente de draft continua funcionando;
- nenhuma massa de teste ficou no banco.

Resultado:

```text
CONFIRM_DRAFT_ENROLLMENT_PREPARED=true
DRAFT_CAN_BE_CONFIRMED=true
MISSING_ENROLLMENT_HANDLED=true
ALREADY_CONFIRMED_HANDLED=true
INVALID_STATUS_HANDLED=true
NO_FINANCIAL_SIDE_EFFECTS=true
NO_CLASS_SIDE_EFFECTS=true
OFFICIAL_DRAFT_FLOW_STILL_WORKING=true
NO_TEST_DATA_LEFT=true
```

## Validacoes

Comandos executados:

```bash
node --check backend/src/domains/enrollments/application/repositories/enrollment.repository.js
node --check backend/src/domains/enrollments/application/services/enrollment-application.service.js
node --check backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment.repository.js
cmd /c npm run build
```

Resultado: aprovado.

## Limitacoes

- Nao ha endpoint, controller, rota ou API publica para confirmacao.
- O fluxo de `pessoas` nao chama `confirmDraftEnrollment()`.
- Nao ha criacao de contrato, financeiro, mensalidades ou turmas.
- `confirmed_at` e `confirmed_by` dependem de migration futura.
- A confirmacao operacional completa ainda precisa definir responsavel,
  auditoria, eventos e efeitos posteriores em sprints separadas.

## Proximos Passos

1. Definir contrato de auditoria de confirmacao.
2. Criar migration para `confirmed_at` e `confirmed_by`, se aprovada.
3. Planejar integracao futura com contrato/financeiro/turmas em sprints
   separadas.
4. Criar endpoint interno ou use case especifico apenas quando o fluxo for
   aprovado.
