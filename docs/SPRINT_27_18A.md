# Sprint 27.18A — Mudança segura de estágio do Lead

Implementada a transição explícita de estágio no CRM interno, reutilizando o pipeline e a política canônica da Sprint 27.18. O endpoint `PATCH /internal/crm/leads/:leadId/stage` mantém a cadeia `requireAuth → ensureCrmInternalAccess → controller`, deriva unidade pelo `CrmLeadUnitContextService` e não aceita `unitId`, `userId` ou campos extras no corpo.

O corpo aceita apenas `nextStage`, `reason`, `expectedStage` e `expectedStatus`. `LOST` exige motivo limitado e sanitizado; `WON` apenas altera estágio/status para `CONVERTED`, sem conversão automática. As pré-condições e o compare-and-swap permanecem no repositório transacional existente, incluindo histórico e rollback atômicos.

A observabilidade registra início, sucesso e falha sem motivo completo, com correlação, duração, estados e `reasonProvided`; métricas são limitadas ao coletor existente. O frontend adiciona ação “Alterar estágio”, diálogo baseado nas transições retornadas pelo pipeline, confirmação, tratamento de conflito e invalidação de Leads, pipeline e histórico. Não há drag-and-drop, migration, schema ou acesso MySQL externo novo.

Limitações: estados legados continuam somente leitura e a autorização segue global para administradores/coordenadores conforme a política atual.
