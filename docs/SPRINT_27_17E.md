# Sprint 27.17E — API interna de conversão de Lead

`POST /internal/crm/leads/:leadId/draft-enrollment` (também sob `/api`) exige `requireAuth` e a política global `canManageSystem` para administradores e coordenadores.

O payload aceita somente `studentData`, `enrollmentData` e, opcionalmente, `idempotencyKey`. O ator vem da sessão, o Lead vem da URL e a unidade é derivada no servidor de `crm_leads.unit_id`. `unitId`, `userId` e quaisquer campos extras são rejeitados com `CRM_INPUT_INVALID`.

O `CrmLeadUnitContextService` usa uma leitura estreita e parametrizada do repository para construir `{ userId, unitId, correlationId, authorization }`. O controller mantém esse contexto separado do input `{ leadId, studentData, enrollmentData, idempotencyKey }` e encaminha ambos ao `CrmLeadEnrollmentConversionService`.

A factory compõe os repositórios oficiais, `StudentApplicationService`, `EnrollmentFacade` e o resolvedor de contexto. Erros seguem ao handler global e falhas de infraestrutura da resolução são sanitizadas. Não há alteração de frontend ou schema, nem execução de migration ou MySQL. A tabela contratual da 27.17D precisa existir antes do uso real.

Detalhes contratuais e testes da correção estão em `docs/SPRINT_27_17E_1.md`.
