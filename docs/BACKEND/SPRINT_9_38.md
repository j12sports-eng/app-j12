# Sprint 9.38 - Status Consolidado Da Matricula

## Objetivo

Criar uma consulta interna application-level para retornar o estado consolidado
da matricula de um aluno/perfil, preparando integracoes futuras sem expor o
repository concreto.

## Metodo Criado

Metodo interno:

```js
getEnrollmentStatusSummary({
  studentPersonId,
  studentProfileId,
})
```

Arquivo:

```text
backend/src/domains/enrollments/application/services/enrollment-application.service.js
```

## Retorno

Quando a entrada e valida, o retorno segue o contrato:

```js
{
  hasDraftEnrollment: boolean,
  hasActiveEnrollment: boolean,
  draftEnrollment: object | null,
  activeEnrollment: object | null,
  status: "NONE" | "DRAFT" | "ACTIVE" | "CONFLICT",
}
```

## Regras

O metodo reutiliza:

```text
findCurrentDraftEnrollment()
findCurrentActiveEnrollment()
```

Mapeamento de status:

```text
NONE: nenhum DRAFT e nenhum ACTIVE encontrado
DRAFT: apenas DRAFT encontrado
ACTIVE: apenas ACTIVE encontrado
CONFLICT: DRAFT e ACTIVE encontrados simultaneamente
```

Entrada incompleta retorna `null` sem tocar no repository, seguindo o padrao
das consultas internas de leitura atuais.

## Comportamento

A consulta e somente leitura:

```text
nao cria dados
nao altera dados
nao chama endpoints
nao integra frontend
nao integra financeiro
nao integra turmas
```

## Smoke Test

Smoke test transacional com rollback valida:

```text
ENROLLMENT_STATUS_SUMMARY_ENABLED=true
STATUS_NONE_RETURNED=true
STATUS_DRAFT_RETURNED=true
STATUS_ACTIVE_RETURNED=true
STATUS_CONFLICT_RETURNED=true
SUMMARY_IS_READ_ONLY=true
INVALID_INPUT_HANDLED=true
NO_TEST_DATA_LEFT=true
```

## Fora Do Escopo

Nao foram alterados:

```text
frontend
API publica
controllers
rotas
repository
schema
migrations
financeiro
mensalidades
turmas
legado
/public/enrollments
```

## Observacoes

- Nenhuma alteracao em repository, SQL, schema ou migration foi necessaria.
- `CONFLICT` e apenas um estado de leitura diagnostica; esta sprint nao executa
  correcao automatica nem efeitos operacionais.
