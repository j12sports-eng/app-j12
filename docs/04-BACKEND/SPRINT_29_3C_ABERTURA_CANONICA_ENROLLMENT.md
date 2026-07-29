# Sprint 29.3C — Abertura canônica da matrícula digital

## Objetivo

Esta sprint torna o `Enrollment` em estado `DRAFT` a única origem da abertura administrativa da matrícula digital moderna. O fluxo não reutiliza pré-matrícula de Pessoas, matrícula pública legada, controllers antigos ou services paralelos.

## Arquitetura implementada

O fluxo usa a composição administrativa já existente:

`EnrollmentAdminRouter` → `EnrollmentAdminController` → `EnrollmentFacade` → `EnrollmentApplicationService` → `MySqlEnrollmentRepository`.

A operação pública da aplicação é `openDraftEnrollment`. O controller apenas valida o contrato HTTP, encaminha o `ActorContext` e formata a resposta. A resolução dos perfis ativos e do vínculo responsável-aluno é feita pelo repositório canônico, sem SQL no controller ou no service.

Não foi criada composição paralela. O router continua protegido, na ordem, por autenticação, autorização administrativa e middleware canônico de `ActorContext`.

## Endpoint

- Método e caminho canônico: `POST /admin/enrollments`
- Autenticação: obrigatória
- Autorização administrativa: obrigatória
- `ActorContext`: obrigatório

O bootstrap anterior já monta o mesmo router também sob o prefixo de compatibilidade `/api`; a sprint não adicionou alias nem novo mount.

### Request

```json
{
  responsiblePersonId: person-responsible,
  studentPersonId: person-student,
  startDate: 2026-08-01
}
```

Somente esses três campos pertencem ao comando. `status`, `ACTIVE`, ids de perfil, id de relacionamento, ownership e outros campos internos são rejeitados. `unitId` e `unit_id` no body são descartados na borda e nunca chegam à aplicação; headers, query strings e parâmetros externos de unidade também não participam da operação.

### Response

Criação retorna HTTP `201`; reuso idempotente retorna HTTP `200`.

```json
{
  success: true,
  data: {
    created: true,
    enrollmentId: enrollment-id,
    reused: false,
    startDate: 2026-08-01,
    status: DRAFT
  }
}
```

A projeção não expõe unidade, ids internos de ownership, locks ou campos de auditoria.

## ActorContext e ownership

A unidade é lida exclusivamente de `actorContext.unitContext.unitId`. Ausência ou formato inválido falha de forma fechada. O repositório resolve, dentro dessa unidade canônica, exatamente um perfil ativo de responsável, um perfil ativo de aluno e um relacionamento ativo na direção responsável → aluno. Resolução inexistente, ambígua ou incompatível é rejeitada.

Antes da persistência, permanecem ativas as validações completas e unit-scoped da Sprint 29.3B.

## Idempotência e conflitos

Se já existir um `DRAFT` com o mesmo ownership canônico na unidade, a operação retorna o mesmo `enrollmentId`. A criação usa `createDraftIfNotExists`, mantendo lock, transação, validação de ownership e constraints físicas existentes.

Um `ACTIVE` conflitante retorna HTTP `409`. Estado físico inconsistente com `DRAFT` e `ACTIVE` simultâneos também é bloqueado para revisão assistida.

## Limitações deliberadas

Esta sprint não implementa convite, contrato, aceite, documentos, transição para `REVIEW`, turma, financeiro, portal ou qualquer rota pública. O legado permanece intacto e não é chamado pela abertura moderna. Nenhuma migration faz parte desta entrega.

## Testes

Foram cobertos abertura simples, idempotência, conflito com `ACTIVE`, ownership inválido ou ambíguo, `ActorContext` obrigatório, descarte de `unitId` do body, rejeição de campos internos, controller, ordem da rota autenticada e integração router-facade-service-repository.

## Próxima sprint

Os próximos estados e capacidades do processo digital devem ser introduzidos separadamente, preservando o `Enrollment DRAFT` e seu ownership canônico como origem. Convite, contrato, aceite, documentos, `REVIEW`, turma, financeiro e portal continuam fora desta sprint.
