# Sprint 27.17E.1 — Contexto autenticado da conversão CRM

## Resultado

A rota interna de conversão deriva `unitId` exclusivamente de `crm_leads.unit_id`. A sessão fornece o ator autenticado, mas não possui vínculo canônico com unidade. O cliente não controla `unitId`, `userId` nem outros campos operacionais.

## Contrato HTTP

`POST /internal/crm/leads/:leadId/draft-enrollment`, também disponível sob `/api`, aceita somente:

```json
{
  "studentData": {},
  "enrollmentData": {},
  "idempotencyKey": "opcional"
}
```

`leadId` vem exclusivamente da URL. Campos extras, incluindo `unitId`, `userId`, IDs derivados, estado, plano, turma, financeiro e contrato, retornam `CRM_INPUT_INVALID`.

O controller encaminha ao serviço de conversão:

```js
input = { leadId, studentData, enrollmentData, idempotencyKey };
context = { userId, unitId, correlationId, authorization };
```

## Resolução confiável

`CrmLeadUnitContextService` consulta o repository injetado por `findUnitContextById(leadId)`. O adapter MySQL executa somente `SELECT id, unit_id FROM crm_leads WHERE id = ? LIMIT 1`, sem carregar PII.

Lead inexistente retorna `CRM_LEAD_NOT_FOUND`; Lead sem unidade falha fechado com `CRM_LEAD_UNIT_CONTEXT_UNAVAILABLE`; falhas de infraestrutura são sanitizadas como `CRM_LEAD_UNIT_CONTEXT_FAILED`.

## Autorização

A cadeia permanece `requireAuth → ensureCrmInternalAccess → controller`. A política atual é global para administradores e coordenadores via `canManageSystem`. O contexto registra a autorização confiável `GLOBAL_SYSTEM_MANAGEMENT`/`CRM_INTERNAL_MANAGE`; não foi inventado vínculo granular usuário–unidade.

## Limites

Não houve alteração de frontend, migration ou schema, nem execução de MySQL. A operação continua criando ou reutilizando somente matrícula `DRAFT` e não executa financeiro, turma, contrato, ativação ou notificações. As Sprints MySQL suspensas permanecem intocadas.
