# Sprint 9.28 - Auditoria E Hardening Da Idempotencia De DraftEnrollment

## Objetivo

Auditar e fortalecer a idempotencia de `draftEnrollment` persistido, com foco em
uso seguro de `GET_LOCK()` e `RELEASE_LOCK()` no repository MySQL.

Esta sprint nao criou funcionalidade nova. O foco foi estabilidade,
previsibilidade, logs e fallback seguro.

## Riscos Tratados

- lock adquirido sem liberacao correspondente;
- erro entre `GET_LOCK()` e `RELEASE_LOCK()`;
- timeout de lock tratado como erro generico;
- falha de leitura criando duplicidade;
- falha de escrita deixando lock preso;
- fallback sem log claro;
- warnings pouco especificos para timeout de idempotencia.

## Estrategia De Hardening

O hardening ficou centralizado em:

```text
backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment.repository.js
```

Mudancas principais:

- `GET_LOCK()` passou a receber timeout parametrizado;
- retorno `0` de `GET_LOCK()` agora gera erro explicito
  `DRAFT_ENROLLMENT_LOCK_TIMEOUT`;
- retorno inesperado/null de `GET_LOCK()` gera
  `DRAFT_ENROLLMENT_LOCK_FAILED`;
- a liberacao do lock acontece em `finally`;
- erro apos lock adquirido nao impede tentativa de `RELEASE_LOCK()`;
- falha de `RELEASE_LOCK()` e registrada com
  `DRAFT_ENROLLMENT_LOCK_RELEASE_FAILED`;
- logs foram adicionados para lock adquirido, lock nao adquirido, lock liberado,
  reuso de draft e criacao de draft.

## Comportamento Do Lock

Fluxo esperado:

```text
GET_LOCK(lockName, timeout)
findDraftByStudent()
create() somente se nao existir draft
RELEASE_LOCK(lockName)
```

Garantias:

- se o lock nao for adquirido, o repository nao executa leitura/criacao;
- se leitura falhar apos o lock, nao ha insert e o lock e liberado;
- se escrita falhar apos o lock, o lock e liberado;
- se o draft ja existir, ele e reutilizado e o lock e liberado;
- se o draft for criado, o lock e liberado.

## Fallback

O orquestrador de `pessoas` continua preservando o fluxo seguro:

```text
backend/src/domains/pessoas/application/services/enrollment-application.service.js
```

Quando persistencia falha:

- registra erro;
- registra fallback ativado;
- cria `draftEnrollment` em memoria;
- retorna warning;
- nao reporta persistencia como concluida.

Quando o erro e timeout de lock, o warning agora usa:

```text
DRAFT_ENROLLMENT_LOCK_TIMEOUT
```

Para demais falhas de persistencia, o warning continua:

```text
DRAFT_ENROLLMENT_PERSISTENCE_FAILED
```

## Logs

Logs adicionados ou ajustados:

- lock adquirido;
- lock nao adquirido;
- lock liberado;
- retorno nao bem-sucedido de release;
- falha de release;
- reutilizacao de draft dentro do lock;
- criacao de novo draft dentro do lock;
- fallback de persistencia ativado.

## Smoke Test

Smoke test executado com query runner falso, sem tocar no banco e sem deixar
massa de teste.

Cenarios cobertos:

1. criacao normal de draft;
2. segunda chamada reutilizando o mesmo draft;
3. erro apos adquirir lock;
4. liberacao do lock apos erro;
5. lock indisponivel/timeout;
6. fallback sem travamento;
7. ausencia de duplicidade de `DRAFT`.

Resultado:

```text
ENROLLMENTS_TABLE_EXISTS=true
DRAFT_ENROLLMENT_IDEMPOTENCY_HARDENED=true
LOCK_ACQUIRED=true
LOCK_RELEASED_AFTER_SUCCESS=true
LOCK_RELEASED_AFTER_ERROR=true
LOCK_TIMEOUT_HANDLED=true
NO_DUPLICATE_DRAFT_CREATED=true
FALLBACK_STILL_WORKING=true
```

## Validacoes

Executado:

```bash
node --check backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment.repository.js
node --check backend/src/domains/enrollments/application/services/enrollment-application.service.js
node --check backend/src/domains/pessoas/application/services/enrollment-application.service.js
cmd /c npm run build
```

Resultado: aprovado.

Buscas de escopo executadas confirmaram que os novos marcadores de lock,
idempotencia e fallback nao foram adicionados em rotas, frontend ou server.
Tambem foi confirmado que nao existe caminho `public/enrollments` no workspace.

## Nao Alterado

Nao foi alterado:

- frontend;
- API publica;
- controllers;
- rotas;
- `/public/enrollments`;
- financeiro;
- mensalidades;
- turmas;
- legado;
- estrutura da tabela `enrollments`;
- migrations.

## Limitacoes Conhecidas

- O smoke test desta sprint usa query runner falso para cobrir cenarios de erro
  sem escrever no banco.
- A protecao fisica contra duplicidade ainda depende do caminho oficial usando
  `createDraftIfNotExists()`. Uma constraint de unicidade parcial/logica deve
  ser tratada em sprint propria, se aprovada.
