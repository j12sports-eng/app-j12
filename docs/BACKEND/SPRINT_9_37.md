# Sprint 9.37 - Guard Na Confirmacao De Draft

## Objetivo

Integrar o guard `ensureNoActiveEnrollment()` ao fluxo interno de confirmacao
de matricula, impedindo que um `DRAFT` seja confirmado para `ACTIVE` quando ja
existir outra matricula ativa para o mesmo aluno/perfil.

## Arquivo Alterado

```text
backend/src/domains/enrollments/application/services/enrollment-application.service.js
```

## Implementacao

`confirmDraftEnrollment()` agora mantem a sequencia:

```text
1. localizar Enrollment por id;
2. validar existencia;
3. tratar ACTIVE como ja confirmado, preservando compatibilidade;
4. validar que o status e DRAFT;
5. executar ensureNoActiveEnrollment() com studentPersonId + studentProfileId;
6. confirmar para ACTIVE via repository.updateStatus().
```

O guard e executado antes da transicao para `ACTIVE`. Se ja existir outra
matricula ativa para o mesmo aluno/perfil, a confirmacao e bloqueada com o erro
controlado:

```text
ACTIVE_ENROLLMENT_ALREADY_EXISTS
```

## Auditoria

A persistencia existente foi preservada:

```text
confirmed_at
confirmed_by
updated_at
```

Esses campos continuam sendo gravados pelo repository na confirmacao permitida.

## Smoke Test

Smoke test transacional com rollback valida:

```text
CONFIRM_DRAFT_ACTIVE_GUARD_ENABLED=true
DRAFT_CONFIRMED_WHEN_NO_ACTIVE=true
DRAFT_CONFIRMATION_BLOCKED_WHEN_ACTIVE_EXISTS=true
CONFIRMATION_AUDIT_STILL_PERSISTED=true
NO_FINANCIAL_SIDE_EFFECTS=true
NO_CLASS_SIDE_EFFECTS=true
NO_TEST_DATA_LEFT=true
```

## Fora Do Escopo

Nao foram alterados:

```text
frontend
API publica
controllers
rotas
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
- A confirmacao de uma matricula que ja esta `ACTIVE` continua retornando o
  resultado idempotente `alreadyConfirmed`.
