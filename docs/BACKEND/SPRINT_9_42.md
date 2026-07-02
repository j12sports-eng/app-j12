# Sprint 9.42 - Eventos Internos de Matriculas

## Objetivo

Criar eventos internos do dominio de matriculas para preparar futuras
integracoes com Turmas, Financeiro, Agenda, Notificacoes e App sem acoplar
esses modulos ao fluxo de matricula.

## Eventos Criados

```text
EnrollmentDraftCreated
EnrollmentConfirmed
```

Arquivos:

```text
backend/src/domains/enrollments/application/events/enrollment-draft-created.event.js
backend/src/domains/enrollments/application/events/enrollment-confirmed.event.js
backend/src/domains/enrollments/application/events/enrollment-internal-event-dispatcher.js
backend/src/domains/enrollments/application/events/enrollment-event.helpers.js
backend/src/domains/enrollments/application/events/index.js
```

## Payload

Cada evento serializa apenas o payload minimo e seguro:

```js
{
  type,
  enrollmentId,
  studentPersonId,
  studentProfileId,
  status,
  occurredAt,
  metadata,
}
```

`metadata` e filtrado para valores escalares e inclui:

```text
internal=true
externalIntegrationsTriggered=false
operation=<ponto interno de emissao>
```

O payload nao inclui nome, CPF, e-mail, telefone, responsavel, dados
financeiros, turmas, agenda ou dados livres do request.

## Pontos de Emissao

Emissao centralizada na `EnrollmentFacade`:

```text
createDraftEnrollmentIdempotently()
createDraftEnrollmentAndPersist()
confirmDraftEnrollment()
```

Regras:

```text
EnrollmentDraftCreated: emitido somente quando created=true.
EnrollmentConfirmed: emitido somente quando confirmed=true.
```

Nao ha evento quando um DRAFT existente e apenas reutilizado. Tambem nao ha
evento quando uma confirmacao retorna `alreadyConfirmed`.

## Dispatcher Interno

Foi criado `EnrollmentInternalEventDispatcher`, um dispatcher simples e interno.

Ele:

```text
nao cria filas
nao chama HTTP
nao chama workers
nao integra Financeiro
nao integra Turmas
nao integra Agenda
nao integra Notificacoes
nao integra App
```

A fachada aceita `eventDispatcher` injetado para testes e integracoes futuras.
Falhas no dispatcher sao capturadas e registradas em log, sem corromper ou
reverter a operacao principal de matricula.

## Registro

Os eventos foram exportados pela camada:

```text
backend/src/domains/enrollments/application/index.js
```

O boundary do dominio tambem expoe a fachada e os eventos:

```text
backend/src/domains/enrollments/index.js
```

Esse ajuste mantem o modulo Pessoas usando o entrypoint do dominio sem depender
diretamente de services internos de matricula.

## Validacoes

Valido:

```text
cmd /c npm run build
node --check backend/src/domains/enrollments/application/facades/enrollment.facade.js
node --check nos arquivos de eventos
smoke test interno
```

Smoke esperado:

```text
ENROLLMENT_EVENTS_CREATED=true
DRAFT_CREATED_EVENT_EMITTED=true
ENROLLMENT_CONFIRMED_EVENT_EMITTED=true
NO_EVENT_ON_DRAFT_REUSE=true
EVENT_PAYLOAD_SAFE=true
NO_EXTERNAL_INTEGRATION_TRIGGERED=true
OFFICIAL_FLOW_STILL_WORKING=true
NO_TEST_DATA_LEFT=true
```

## Limitacoes

Nesta sprint os eventos sao apenas internos. Nenhum consumidor operacional foi
conectado e nenhum efeito externo e executado.

## Proximos Passos

Futuras sprints podem adicionar consumidores internos explicitamente
orquestrados para:

```text
turmas
financeiro
agenda
notificacoes
app
```

Essas integracoes devem continuar consumindo eventos sem acoplar os modulos ao
fluxo de confirmacao ou criacao de matriculas.

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
agenda
notificacoes
app
legado
```
