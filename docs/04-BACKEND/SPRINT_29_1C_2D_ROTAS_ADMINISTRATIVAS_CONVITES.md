# Sprint 29.1C.2D - Rotas administrativas seguras de convites digitais

## Objetivo

Expor rotas administrativas internas para criar, renovar, revogar e consultar o estado atual de convites digitais de matrícula, usando apenas `requireAuth`, `UnitContext`, `ActorContext`, `UserUnitMembership` e `EnrollmentDigitalInvitationService`.

## Auditoria e ownership

A auditoria confirmou que:

- `requireAuth` permanece intacto e continua emitindo `req.user` e `req.auth`.
- `UnitContext` e `ActorContext` já existem.
- `UserUnitMembership` adota as roles `admin`, `coordenador`, `professor`, `responsavel` e `aluno`.
- `EnrollmentDigitalInvitationService` já resolve, renova, revoga e expira convites com token bruto somente na criação/renovação.
- O `MySqlEnrollmentRepository` moderno não projeta `unitId`.

Conclusao: o ownership canônico de `Enrollment` por unidade ainda não é verificável de forma persistida no repositório moderno. Por isso, o fluxo foi implementado de forma fail-closed e a montagem operacional global não foi feita.

## Arquitetura

- `EnrollmentInvitationAdminApplicationService`
- `EnrollmentInvitationAdminController`
- `createEnrollmentInvitationAdminRouter`
- `createEnrollmentInvitationAdminComposition`
- `EnrollmentInvitationAdminAction` guard por role

## Rotas

- `POST /admin/enrollments/:enrollmentId/digital-invitations`
- `POST /admin/enrollments/:enrollmentId/digital-invitations/renew`
- `POST /admin/enrollments/:enrollmentId/digital-invitations/revoke`
- `GET /admin/enrollments/:enrollmentId/digital-invitations/current`

## Ordem dos middlewares

1. `requireAuth`
2. `createUnitContextMiddleware`
3. `createActorContextMiddleware`
4. guard de role por ação
5. controller

## ActorContext e UnitContext

- `ActorContext.unitContext.unitId` é a única unidade confiável para a operação.
- `x-unit-id` não autoriza nada, apenas pode solicitar contexto.
- `membershipRole` é a fonte real do guard.
- `globalRole` não substitui `membershipRole`.

## Respostas

- `201` em criação.
- `200` em renovação, revogação e consulta.
- `400` em input inválido.
- `401` quando não autenticado.
- `403` quando role/membership não autorizam.
- `404`/genérico quando ownership ou recurso não puder ser confirmado.
- `409` em conflitos de estado.

## Token bruto

O `rawToken` só é retornado em criação e renovação. Nunca aparece em consulta, logs, exceções ou metadata.

## Auditoria

Eventos previstos:

- `ENROLLMENT_INVITATION_ADMIN_CREATED`
- `ENROLLMENT_INVITATION_ADMIN_RENEWED`
- `ENROLLMENT_INVITATION_ADMIN_REVOKED`
- `ENROLLMENT_INVITATION_ADMIN_VIEWED`
- `ENROLLMENT_INVITATION_ADMIN_REJECTED`

Campos permitidos:

- `invitationId`
- `enrollmentId`
- `unitId`
- `authIdentityId`
- `membershipRole`
- `action`
- `result`
- `requestId`
- `correlationId`

## Concorrência

O serviço cobre:

- criação duplicada concorrente;
- renovação concorrente;
- revogação concorrente;
- divergência de unidade na saída;
- recarga do contexto de unidade quando o resolvedor está disponível.

## Rate limit

Não houve criação de limitador novo. As rotas permanecem sob a proteção global existente.

## Segurança

- sem montagem em `server.js`;
- sem alteração de rotas legadas;
- sem `unitId` confiável vindo de body, query ou params;
- sem bypass global por admin;
- sem vazamento de PII, token bruto ou hash;
- sem frontend, documentos, contratos, financeiro, agenda, turmas ou migration.

## Rotas montadas

Nenhuma nova rota foi montada globalmente. A factory foi entregue pronta para montagem controlada futura.

## Bloqueios

O ownership canônico do `Enrollment` por unidade ainda não está persistido no aggregate/repository moderno. Sem isso, a ativação operacional deve continuar proibida.

## Fora do escopo

- frontend
- contrato público
- documentos
- financeiro
- agenda
- notificações externas
- migrations
- alteração de `.env`

## Próximos passos da 29.1C.3

- operar `/matricula/:token` publicamente;
- amarrar a experiência mínima de consulta/abertura do convite;
- manter o fluxo administrativo isolado até o ownership canônico de `Enrollment` por unidade ser persistido.
