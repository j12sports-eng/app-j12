# Sprint 9.32 - Consulta Interna Consolidada De DraftEnrollment

## Objetivo

Criar um ponto oficial de leitura interna para recuperar o `draftEnrollment`
atual de um aluno/perfil pela camada de aplicacao, sem expor o repository
concreto para camadas superiores.

## Metodo Consolidado

Metodo application-level adicionado:

```js
findCurrentDraftEnrollment({
  studentPersonId,
  studentProfileId,
})
```

Arquivo:

```text
backend/src/domains/enrollments/application/services/enrollment-application.service.js
```

O metodo antigo `findDraftEnrollment()` foi preservado como alias de
compatibilidade e agora delega para `findCurrentDraftEnrollment()`.

## Contrato De Entrada

Entrada esperada:

```text
studentPersonId: string
studentProfileId: string
```

Os identificadores sao normalizados com `trim()` e limite de 64 caracteres,
compativel com o schema atual de `enrollments`.

Entradas incompletas ou invalidas retornam `null` sem consultar o repository.
Isso evita leitura ampla por apenas um identificador quando o objetivo e o draft
atual da combinacao aluno/perfil.

## Contrato De Saida

Quando existe `DRAFT` ativo:

```text
Enrollment persistido normalizado pelo repository
```

Quando nao existe:

```text
null
```

O metodo nao cria matricula, nao altera dados e nao executa migration.

## Repository E SQL

Nao foi criada nova consulta SQL.

O service reutiliza o metodo de adapter ja existente:

```text
MySqlEnrollmentRepository.findDraftByStudent()
```

Esse adapter continua filtrando:

```text
status = DRAFT
deleted_at IS NULL
student_person_id
student_profile_id
```

O contrato em:

```text
backend/src/domains/enrollments/application/repositories/enrollment.repository.js
```

foi documentado para deixar claro que `findDraftByStudent()` e o metodo
read-only usado pela aplicacao para resolver o draft ativo atual.

## Integracao Com Pessoas

Arquivo revisado:

```text
backend/src/domains/pessoas/application/services/enrollment-application.service.js
```

O orquestrador agora prefere:

```text
findCurrentDraftEnrollment()
```

e preserva fallback para:

```text
findDraftEnrollment()
```

Isso mantem compatibilidade com servicos ja existentes e nao altera o fluxo de
criacao de matricula.

## Comportamento Quando Nao Existe Draft

`findCurrentDraftEnrollment()` retorna `null`.

Nenhum registro e criado e nenhum dado e alterado.

## Comportamento Com Entrada Invalida

Entradas sem `studentPersonId` ou sem `studentProfileId` retornam `null`.

Nessa situacao, o repository nao e chamado.

## Validacoes

Comandos executados:

```bash
node --check backend/src/domains/enrollments/application/repositories/enrollment.repository.js
node --check backend/src/domains/enrollments/application/services/enrollment-application.service.js
node --check backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment.repository.js
node --check backend/src/domains/pessoas/application/services/enrollment-application.service.js
cmd /c npm run build
```

Resultado:

```text
node --check enrollment.repository.js: aprovado
node --check enrollments/enrollment-application.service.js: aprovado
node --check mysql-enrollment.repository.js: aprovado
node --check pessoas/enrollment-application.service.js: aprovado
cmd /c npm run build: aprovado
```

## Smoke Tests

Foi executado smoke test transacional no MySQL remoto com rollback.

O teste validou:

- consulta retorna `null` quando nao existe draft;
- consulta retorna o draft quando existe;
- consulta nao cria registro;
- consulta nao altera registro existente;
- entrada invalida retorna `null` sem chamar repository;
- fluxo oficial de criacao continua funcionando;
- nenhuma massa de teste fica no banco.

Resultado:

```text
CURRENT_DRAFT_QUERY_ENABLED=true
CURRENT_DRAFT_FOUND=true
CURRENT_DRAFT_NOT_FOUND_RETURNS_NULL=true
CURRENT_DRAFT_QUERY_IS_READ_ONLY=true
INVALID_INPUT_HANDLED=true
OFFICIAL_FLOW_STILL_WORKING=true
NO_TEST_DATA_LEFT=true
```

## Limitacoes

- A sprint nao cria endpoint, rota, controller ou API publica.
- A consulta consolidada e interna da camada de aplicacao.
- A leitura exige a combinacao `studentPersonId + studentProfileId`; consultas
  por apenas um identificador continuam disponiveis somente no repository para
  compatibilidade interna.
- Erros reais de banco continuam seguindo o tratamento/fallback ja existente no
  orquestrador de `pessoas`.

## Resultado

```text
CURRENT_DRAFT_QUERY_ENABLED=true
CURRENT_DRAFT_FOUND=true
CURRENT_DRAFT_NOT_FOUND_RETURNS_NULL=true
CURRENT_DRAFT_QUERY_IS_READ_ONLY=true
INVALID_INPUT_HANDLED=true
OFFICIAL_FLOW_STILL_WORKING=true
NO_TEST_DATA_LEFT=true
```
