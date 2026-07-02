# Sprint 9.53 - Integracao de Matriculas com Notificacoes

## Objetivo

Preparar a integracao interna entre o dominio de Matriculas (`enrollments`) e
Notificacoes para que eventos de matricula possam, futuramente, gerar avisos
internos de forma controlada, segura e idempotente.

Esta sprint nao cria notificacao real e nao envia e-mail, WhatsApp ou push.

## Mapeamento do Modulo Notificacoes

Fronteira de dominio reservada:

```text
backend/src/domains/notificacoes/index.js
backend/src/domains/notificacoes/README.md
```

Arquivos operacionais encontrados:

```text
backend/src/services/notificacao.service.js
backend/src/repositories/notificacao.repository.js
backend/src/routes/notificacoes.routes.js
backend/src/controllers/aluno.controller.js
backend/src/routes/responsaveis.routes.js
backend/src/services/portal-schema.service.js
```

Tabelas mapeadas:

```text
j12_notificacoes
student_notifications
```

Schema relevante:

```text
j12_notificacoes.id
j12_notificacoes.aluno_id
j12_notificacoes.titulo
j12_notificacoes.mensagem
j12_notificacoes.tipo
j12_notificacoes.lida
j12_notificacoes.created_at

student_notifications.id
student_notifications.aluno_id
student_notifications.titulo
student_notifications.mensagem
student_notifications.canal
student_notifications.tipo
student_notifications.lida
student_notifications.created_at
student_notifications.updated_at
```

Canais avaliados:

```text
in-app/painel: existe leitura e persistencia parcial
Socket.IO: evento nova_notificacao existe de forma pontual
e-mail: existe infraestrutura separada em server/email.mjs, nao integrada a Notificacoes
WhatsApp: existe uso operacional em Financeiro/BotConversa, nao como Notificacoes de dominio
push/app: nao foi encontrado adapter dedicado
```

Nao foi encontrada tabela dedicada para relacionar:

```text
enrollments.id <-> notificacao
enrollment event <-> notification id
```

Tambem nao foi encontrado padrao de idempotencia por `enrollmentId` + evento.
O service atual evita duplicidade apenas por:

```text
aluno_id + titulo + mensagem + data atual
```

## Decisao Tecnica

Contrato/documentacao preparatoria.

Nao foi implementada notificacao real porque o modulo atual ainda esta fora da
fronteira de dominio `backend/src/domains/notificacoes`, usa `aluno_id` legado,
nao possui chave por `enrollmentId`, nao possui dispatcher/fila de dominio e nao
tem templates/preferencias/canais consolidados para eventos de Matriculas.

Persistir ou enviar agora nao garantiria:

```text
idempotencia por matricula e tipo de evento
auditoria de origem do evento
payload minimo e padronizado
preferencias por canal
templates versionados
envio assincrono resiliente
rollback isolado
```

## Implementacao

Arquivos de aplicacao ajustados:

```text
backend/src/domains/enrollments/application/contracts/enrollment-notification.contract.js
backend/src/domains/enrollments/application/contracts/index.js
backend/src/domains/enrollments/application/services/enrollment-notification.service.js
backend/src/domains/enrollments/application/services/index.js
backend/src/domains/enrollments/application/facades/enrollment.facade.js
```

Novo metodo interno exposto pela facade:

```js
prepareEnrollmentNotification({
  enrollmentId,
  studentPersonId,
  studentProfileId,
  eventType,
  requestedBy,
  metadata,
})
```

Eventos candidatos aceitos:

```text
ENROLLMENT_DRAFT_CREATED
ENROLLMENT_CONFIRMED
ENROLLMENT_CLASS_LINKED
ENROLLMENT_FINANCIAL_CREATED
ENROLLMENT_SCHEDULE_CREATED
```

O service:

```text
valida enrollmentId, eventType e requestedBy
consulta a matricula persistida por id
bloqueia matricula inexistente
valida compatibilidade basica entre eventType e status da matricula
confere studentPersonId/studentProfileId quando informados
retorna contrato preparatorio
nao cria notificacao
nao emite Socket.IO
nao envia e-mail
nao envia WhatsApp
nao envia push
```

## Payload Minimo

Payload preparado:

```text
enrollmentId
studentPersonId
studentProfileId
eventType
```

O contrato nao carrega nome, CPF, telefone, e-mail, responsavel, plano, turma,
valores financeiros ou texto livre sensivel.

## Erros Controlados

Erros adicionados:

```text
ENROLLMENT_NOTIFICATION_INPUT_REQUIRED
ENROLLMENT_NOTIFICATION_INVALID_EVENT_TYPE
ENROLLMENT_NOTIFICATION_INVALID_ENROLLMENT_STATUS
ENROLLMENT_NOTIFICATION_PREPARATION_INPUT_REQUIRED
ENROLLMENT_NOTIFICATION_PREPARATION_ENROLLMENT_NOT_FOUND
ENROLLMENT_NOTIFICATION_PREPARATION_STUDENT_LINK_MISSING
ENROLLMENT_NOTIFICATION_PREPARATION_STUDENT_MISMATCH
```

## Contrato Criado

Arquivo:

```text
backend/src/domains/enrollments/application/contracts/enrollment-notification.contract.js
```

O contrato declara:

```text
contractVersion=sprint-9.53
blockedBySchemaOrModuleGap=true
notificationCreationBlockedBySchemaOrModuleGap=true
requiresDedicatedNotificationLinkTable=true
requiresDispatcher=true
duplicateNotificationCheckAvailable=false
notificationCreated=false
emailSent=false
whatsappSent=false
pushSent=false
safePayload=true
persisted=false
```

## Smoke Tests

Smoke preparatorio validado por testes unitarios:

```text
ENROLLMENT_NOTIFICATION_INTEGRATION_PREPARED=true
NOTIFICATION_MODULE_MAPPED=true
NOTIFICATION_CONTRACT_DOCUMENTED=true
NOTIFICATION_CREATION_BLOCKED_BY_SCHEMA_OR_MODULE_GAP=true
NO_NOTIFICATION_CREATED=true
NO_EMAIL_SENT=true
NO_WHATSAPP_SENT=true
NO_PUSH_SENT=true
OFFICIAL_FLOW_STILL_WORKING=true
NO_TEST_DATA_LEFT=true
```

Cenarios cobertos:

```text
ENROLLMENT_CONFIRMED prepara contrato sem envio
ENROLLMENT_DRAFT_CREATED prepara contrato sem envio
matricula inexistente retorna erro controlado
status incompatível com evento e bloqueado
student ids divergentes sao bloqueados
payload minimo e seguro e retornado
repeticao retorna chave idempotente sem criar dados
```

## Validacoes

Validacoes executadas nesta sprint:

```text
node --check backend/src/domains/enrollments/application/contracts/enrollment-notification.contract.js
node --check backend/src/domains/enrollments/application/contracts/index.js
node --check backend/src/domains/enrollments/application/services/enrollment-notification.service.js
node --check backend/src/domains/enrollments/application/services/index.js
node --check backend/src/domains/enrollments/application/facades/enrollment.facade.js
node --check backend/src/domains/enrollments/application/tests/enrollment-notification.service.test.js
node --check backend/src/domains/enrollments/application/tests/enrollment.facade.test.js
node --test backend/src/domains/enrollments/application/tests/*.test.js
cmd /c npm run build
```

## Migration Futura Necessaria

Antes de criar notificacoes reais por Matricula, criar estrutura dedicada, por
exemplo:

```text
enrollment_notification_links
```

Colunas sugeridas:

```text
id
enrollment_id
student_person_id
student_profile_id
event_type
notification_id
status
idempotency_key
requested_by
metadata_json
created_at
updated_at
```

Regras sugeridas:

```text
FK enrollment_id -> enrollments.id
referencia notification_id -> tabela canonica de notificacoes
unicidade por idempotency_key
status prepared/created/skipped/failed
dispatcher assincrono para envio real
templates e preferencias resolvidos em Notificacoes
```

## Riscos

- Existem duas representacoes historicas: `j12_notificacoes` e
  `student_notifications`.
- O service atual e idempotente apenas por titulo/mensagem/data/aluno, nao por
  evento de Matricula.
- Socket.IO `nova_notificacao` e usado pontualmente, sem dispatcher padronizado.
- E-mail, WhatsApp e push nao estao integrados ao dominio de Notificacoes.

## Rollback

Rollback de codigo:

```text
remover o contrato de notificacao
remover o service de notificacao de Matriculas
remover o metodo da facade
remover exports adicionados
remover a documentacao da sprint
```

Nao ha rollback de banco porque nenhuma migration foi criada e nenhum dado foi
gravado.

## Fora Do Escopo

Nao foram alterados:

```text
frontend
API publica
financeiro
mensalidades
turmas
agenda
app
legado
schema
migrations
fluxo publico de criacao de aluno
```

## Proximos Passos

1. Definir tabela canonica de notificacoes ou consolidar `j12_notificacoes` e
   `student_notifications`.
2. Criar migration `enrollment_notification_links`.
3. Criar dispatcher/fila de Notificacoes.
4. Criar templates por evento de Matricula.
5. Implementar preferencias por canal e adapters de e-mail/WhatsApp/push.
6. Implementar criacao real com transacao e chave idempotente.
