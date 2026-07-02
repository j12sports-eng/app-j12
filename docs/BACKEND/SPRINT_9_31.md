# Sprint 9.31 - Tratamento Seguro De Duplicidade Fisica Em DraftEnrollment

## Objetivo

Normalizar o tratamento do erro de duplicidade fisica criado pela Sprint 9.30
para o fluxo de `draftEnrollment`.

Quando o MySQL/Percona bloquear uma duplicidade pelo indice unico de draft
ativo, o sistema deve tratar o caso como concorrencia esperada, buscar o draft
existente e reutiliza-lo.

## Escopo

Arquivos revisados:

```text
backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment.repository.js
backend/src/domains/enrollments/application/services/enrollment-application.service.js
backend/src/domains/pessoas/application/services/enrollment-application.service.js
```

A alteracao funcional ficou concentrada no repository de MySQL, porque ele e o
ponto que executa `createDraftIfNotExists()`, faz a leitura do draft, tenta o
`INSERT`, controla o `GET_LOCK()`/`RELEASE_LOCK()` e conhece o erro fisico do
banco.

Os services de `enrollments` e `pessoas` foram revisados e nao precisaram de
alteracao: ambos ja consomem o resultado idempotente `{ created, reused,
enrollment/draftEnrollment }` e preservam o fallback seguro atual para erros
reais.

## Erro Tratado

Somente este cenario passa a ser tratado como concorrencia esperada:

```text
code = ER_DUP_ENTRY
errno = 1062
indice = ux_enrollments_active_draft_student_profile
```

Nome do indice fisico criado na Sprint 9.30:

```text
ux_enrollments_active_draft_student_profile
```

Duplicidades de outros indices ou erros de banco sem esse indice continuam
subindo como erro real.

## Fluxo Antes

Fluxo anterior em `MySqlEnrollmentRepository.createDraftIfNotExists()`:

```text
1. adquirir GET_LOCK()
2. procurar DRAFT ativo existente
3. se nao encontrar, tentar INSERT
4. se INSERT falhasse por ER_DUP_ENTRY, o erro subia
5. liberar RELEASE_LOCK()
```

Mesmo com lock, um insert externo ou uma corrida fora do caminho oficial ainda
poderia fazer a constraint fisica bloquear o `INSERT`.

## Fluxo Depois

Fluxo atual:

```text
1. adquirir GET_LOCK()
2. procurar DRAFT ativo existente
3. se nao encontrar, tentar INSERT
4. se INSERT falhar por ER_DUP_ENTRY/1062 do indice de draft ativo:
   - registrar warning controlado
   - buscar novamente o DRAFT ativo existente
   - retornar `{ created: false, reused: true, enrollment }`
5. se nao encontrar o draft apos a duplicidade, manter o erro original
6. se o erro nao for da constraint correta, manter o erro original
7. liberar RELEASE_LOCK()
```

## Logs E Warnings

Quando a constraint correta e acionada e o draft existente e encontrado, o
repository registra warning:

```text
[enrollments] Draft Enrollment duplicate constraint hit; reusing existing draft.
```

Quando a constraint e acionada mas o draft nao e encontrado na releitura, o
repository registra:

```text
[enrollments] Draft Enrollment duplicate constraint hit, but no reusable draft was found.
```

Nesse segundo caso o erro original volta a subir, evitando mascarar falhas
inconsistentes.

## Comportamento Em Concorrencia

O caminho oficial continua idempotente:

```text
createDraftIfNotExists()
```

Se outro processo criar o mesmo `DRAFT` antes do `INSERT`, a unique constraint
bloqueia a duplicidade fisica. O repository reconhece apenas a constraint de
draft ativo, rele o registro existente e devolve reutilizacao ao fluxo.

## Validacoes

Comandos obrigatorios executados:

```bash
node --check backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment.repository.js
node --check backend/src/domains/enrollments/application/services/enrollment-application.service.js
node --check backend/src/domains/pessoas/application/services/enrollment-application.service.js
cmd /c npm run build
```

Resultado:

```text
node --check mysql-enrollment.repository.js: aprovado
node --check enrollments/enrollment-application.service.js: aprovado
node --check pessoas/enrollment-application.service.js: aprovado
cmd /c npm run build: aprovado
```

## Smoke Tests

Foram executados dois smoke tests:

1. smoke com stubs do repository para cobrir erro desconhecido e fluxo oficial
   sem gravar no banco;
2. smoke transacional no MySQL remoto para forcar a constraint fisica real,
   recuperar o draft existente e executar rollback.

Os testes cobriram:

- criacao normal de `DRAFT`;
- reutilizacao quando o draft ja existe;
- simulacao de `ER_DUP_ENTRY`/`1062` para o indice correto;
- recuperacao do draft existente apos duplicidade fisica;
- erro de banco nao relacionado continuando como erro real;
- fluxo oficial via `EnrollmentApplicationService.createDraftEnrollmentIdempotently()`;
- ausencia de massa persistida apos rollback.

Resultado:

```text
DRAFT_DUPLICATE_ERROR_HANDLED=true
DUPLICATE_ERROR_FETCHED_EXISTING_DRAFT=true
UNKNOWN_DB_ERROR_NOT_MASKED=true
NO_DUPLICATE_DRAFT_CREATED=true
OFFICIAL_FLOW_STILL_WORKING=true
NO_TEST_DATA_LEFT=true
```

## Limitacoes

- O tratamento e propositalmente restrito ao indice
  `ux_enrollments_active_draft_student_profile`.
- Se o MySQL/Percona retornar `ER_DUP_ENTRY` sem mencionar o indice esperado,
  o erro nao e mascarado.
- O fluxo nao cria novo registro apos a duplicidade; ele apenas rele o draft
  existente e reutiliza.
- O fallback seguro de `pessoas` continua sendo usado para erros reais de
  persistencia.

## Resultado

```text
DRAFT_DUPLICATE_ERROR_HANDLED=true
DUPLICATE_ERROR_FETCHED_EXISTING_DRAFT=true
UNKNOWN_DB_ERROR_NOT_MASKED=true
NO_DUPLICATE_DRAFT_CREATED=true
OFFICIAL_FLOW_STILL_WORKING=true
NO_TEST_DATA_LEFT=true
```
