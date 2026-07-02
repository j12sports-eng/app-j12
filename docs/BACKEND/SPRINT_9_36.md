# Sprint 9.36 - Guard Interno Contra Matricula Ativa Duplicada

## Objetivo

Adicionar uma protecao application-level para impedir continuidade quando ja
existir uma matricula `ACTIVE` para o mesmo aluno/perfil.

## Metodo Criado

Metodo interno:

```js
ensureNoActiveEnrollment({
  studentPersonId,
  studentProfileId,
})
```

Arquivo:

```text
backend/src/domains/enrollments/application/services/enrollment-application.service.js
```

## Comportamento

Quando nao existe matricula ativa para o par:

```js
{
  activeEnrollment: null,
  allowed: true,
  studentPersonId,
  studentProfileId,
}
```

Quando ja existe matricula `ACTIVE`, o metodo lanca erro controlado:

```text
ACTIVE_ENROLLMENT_ALREADY_EXISTS
```

Quando a entrada esta incompleta, o metodo lanca erro controlado:

```text
ACTIVE_ENROLLMENT_GUARD_INPUT_REQUIRED
```

## Decisao Tecnica

O guard reutiliza `findCurrentActiveEnrollment()` e nao acessa o repository
concreto diretamente. A consulta continua sendo somente leitura e o guard nao
cria, atualiza ou remove dados.

Entrada incompleta nao e tratada como "liberada"; ela gera erro controlado para
evitar continuidade operacional sem a chave completa `studentPersonId +
studentProfileId`.

## Validacoes

Comandos obrigatorios:

```bash
node --check backend/src/domains/enrollments/application/services/enrollment-application.service.js
cmd /c npm run build
```

## Smoke Test

Smoke test transacional com rollback valida:

```text
ACTIVE_ENROLLMENT_GUARD_ENABLED=true
NO_ACTIVE_ENROLLMENT_ALLOWED=true
EXISTING_ACTIVE_ENROLLMENT_BLOCKED=true
GUARD_IS_READ_ONLY=true
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
- O guard e interno da camada de aplicacao e depende da consulta ativa criada
  na Sprint 9.35.
