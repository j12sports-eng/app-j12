# Sprint 27.17E — API interna de conversão de Lead

`POST /internal/crm/leads/:leadId/draft-enrollment` (também sob `/api`) exige `requireAuth` e `canManageSystem`.

O payload informa `unitId`, `studentData`, `enrollmentData: { startDate }` e, opcionalmente, `idempotencyKey`. O ator vem da sessão e o Lead da URL. O controller valida somente o envelope HTTP; as regras continuam no `CrmLeadEnrollmentConversionService`.

A factory compõe os repositórios oficiais, `StudentApplicationService` e `EnrollmentFacade`. Erros seguem ao handler global. Não há alteração de frontend ou schema, nem execução de migration. A tabela contratual da 27.17D precisa existir antes do uso real.
