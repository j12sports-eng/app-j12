# Sprint 10.8 - Notificacoes a partir de Eventos de Matricula

## Objetivo

Preparar a integracao entre Matriculas e Notificacoes a partir de eventos internos do dominio, mantendo payload minimo, idempotencia futura e nenhum envio real.

## Mapeamento de Notificacoes

- Service legado encontrado: `backend/src/services/notificacao.service.js`.
- Repository legado encontrado: `backend/src/repositories/notificacao.repository.js`.
- Tabela principal encontrada: `j12_notificacoes`.
- Outra superficie encontrada: `student_notifications`.
- Socket.IO: evento `nova_notificacao` existe em pontos legados.
- E-mail: existe infraestrutura separada fora do dominio de Notificacoes.
- WhatsApp e push: nao foi encontrado provider/fila consolidado para eventos de Matriculas.
- Templates por evento de Matricula: nao encontrados.
- Preferencias por canal: nao encontradas como contrato seguro para este fluxo.

## Eventos utilizados

Eventos aceitos no contrato:

- `ENROLLMENT_CONFIRMED`
- `ENROLLMENT_CLASS_LINKED`
- `ENROLLMENT_FINANCIAL_OBLIGATION_CREATED`
- `ENROLLMENT_SCHEDULE_CREATED`

O evento legado `ENROLLMENT_FINANCIAL_CREATED` permanece aceito por compatibilidade.

## Payload seguro

O metodo `prepareEnrollmentNotificationFromEvent()` reduz o payload a:

```js
{
  eventType,
  enrollmentId,
  studentPersonId,
  studentProfileId,
  occurredAt
}
```

Payloads recebidos com CPF, token, stack trace ou dados completos sao descartados e nao aparecem no contrato retornado.

## Decisao tecnica

Contrato/documentacao preparatoria.

Nao foi criada notificacao real porque o modulo atual nao possui tabela/link idempotente por evento de matricula, templates por evento, preferencias de canal, fila/worker e providers seguros para e-mail, WhatsApp ou push.

## Fluxo preparado

```text
EnrollmentFacade.prepareEnrollmentNotificationFromEvent()
        -> EnrollmentNotificationService.prepareEnrollmentNotificationFromEvent()
        -> enrollmentReader
        -> contrato no-send
```

## Idempotencia

O contrato retorna chave estavel por matricula e tipo de evento:

```text
enrollment:<enrollmentId>:event:<eventType>
```

Como nao ha escrita real, chamadas repetidas permanecem seguras para retry.

## Smoke tests

```text
ENROLLMENT_NOTIFICATION_PREPARED=true
NOTIFICATION_MODULE_MAPPED=true
NOTIFICATION_CREATION_BLOCKED_BY_SCHEMA_OR_INFRA_GAP=true
NOTIFICATION_CONTRACT_DOCUMENTED=true
NOTIFICATION_PAYLOAD_SAFE=true
NO_EMAIL_SENT=true
NO_WHATSAPP_SENT=true
NO_PUSH_SENT=true
OFFICIAL_FLOW_STILL_WORKING=true
NO_TEST_DATA_LEFT=true
```

## Validacoes executadas

```bash
node --check backend/src/domains/enrollments/application/contracts/enrollment-notification.contract.js
node --check backend/src/domains/enrollments/application/services/enrollment-notification.service.js
node --check backend/src/domains/enrollments/application/facades/enrollment.facade.js
node --check backend/src/domains/enrollments/application/tests/enrollment-notification.service.test.js
node --check backend/src/domains/enrollments/application/tests/enrollment.facade.test.js
node --test backend/src/domains/enrollments/application/tests/*.test.js
cmd /c npm run build
```

## Bloqueios

- Falta tabela/link dedicada `enrollment_notification_links`.
- Falta dispatcher/fila para eventos de Matriculas.
- Falta catalogo de templates por evento.
- Falta politica de preferencias por canal.
- Falta provider seguro para envio real de e-mail, WhatsApp e push neste fluxo.

## Proximos passos

- Definir tabela canonica ou consolidar `j12_notificacoes` e `student_notifications`.
- Criar migration de idempotencia por evento de matricula.
- Criar templates e dispatcher de Notificacoes.
- Implementar providers/canais somente com configuracao segura e confirmada.
