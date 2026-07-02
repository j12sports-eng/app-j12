# Sprint 9.35 - Consulta Interna De Matricula Ativa

## Objetivo

Criar um ponto oficial de leitura interna para recuperar a matricula ativa
(`ACTIVE`) de um aluno/perfil pela camada de aplicacao, sem expor o repository
concreto.

## Metodo Criado

Metodo application-level:

```js
findCurrentActiveEnrollment({
  studentPersonId,
  studentProfileId,
})
```

Arquivo:

```text
backend/src/domains/enrollments/application/services/enrollment-application.service.js
```

## Contrato De Entrada

Entrada esperada:

```text
studentPersonId: string
studentProfileId: string
```

Os identificadores sao normalizados com `trim()` e limite de 64 caracteres.
Entradas incompletas ou invalidas retornam `null` sem consultar o repository.

## Repository E SQL

Contrato documentado em:

```text
backend/src/domains/enrollments/application/repositories/enrollment.repository.js
```

Adapter MySQL atualizado em:

```text
backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment.repository.js
```

Filtro aplicado pela consulta:

```text
status = ACTIVE
deleted_at IS NULL
student_person_id
student_profile_id
```

A ordenacao prioriza a confirmacao mais recente:

```text
confirmed_at DESC
updated_at DESC
created_at DESC
id DESC
```

## Comportamento

Quando existe matricula ativa para o aluno/perfil:

```text
Enrollment persistido normalizado pelo repository
```

Quando nao existe:

```text
null
```

A consulta e somente leitura, nao cria dados, nao atualiza dados e nao executa
migration.

## Validacoes

Comandos obrigatorios:

```bash
node --check backend/src/domains/enrollments/application/repositories/enrollment.repository.js
node --check backend/src/domains/enrollments/application/services/enrollment-application.service.js
node --check backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment.repository.js
cmd /c npm run build
```

## Smoke Test

Smoke test transacional com rollback valida:

```text
CURRENT_ACTIVE_QUERY_ENABLED=true
CURRENT_ACTIVE_FOUND=true
CURRENT_ACTIVE_NOT_FOUND_RETURNS_NULL=true
CURRENT_ACTIVE_QUERY_IS_READ_ONLY=true
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
financeiro
mensalidades
turmas
legado
/public/enrollments
schema
migrations
```

## Observacoes

- A sprint reutiliza o schema atual de `enrollments`; nenhuma coluna, indice ou
  migration foi criada.
- A consulta ativa e interna da camada de aplicacao e depende de repository
  injetado.
