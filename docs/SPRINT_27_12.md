# Sprint 27.12 — Fonte BI Agregada de Eventos

Foi criada a fonte backend read-only GET /admin/bi/events no fluxo BiEventsController -> BiEventsService -> MySqlBiEventsRepository -> MySQL. O alias existente /api/admin/bi também permanece disponível.

A fonte canônica é j12_campeonatos, documentada pelo BI 21.8 como BI de Campeonatos e Eventos. Eventos técnicos, notificações e Agenda não participam do agregado.

O DTO retorna version, generatedAt, source, readOnly, filters, kpis e dimensions. readOnly é sempre true. Estão disponíveis total, publicados, concluídos e próximos. Agendados e cancelados ficam indisponíveis porque DRAFT não prova agendamento e REMOVED não prova cancelamento. Há dimensões mensais, por categoria e status. Unidade fica vazia e unitId é rejeitado porque não há vínculo canônico.

O router reutiliza requireAuth e canManageSystem. Quatro consultas parametrizadas usam somente SELECT, COUNT, SUM e GROUP BY. Não há PII, linhas operacionais, IDs, N+1, escrita ou migration. Nenhuma regra de Campeonatos e nenhum frontend foram alterados.

Testes dedicados cobrem service/DTO, controller e repository: contrato, GET, período, unitId, vazio/parcial, PII, escrita e quantidade fixa de consultas. Cancelamento, agendamento e unidade dependem de futura persistência canônica.
