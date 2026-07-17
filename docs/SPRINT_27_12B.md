# Sprint 27.12B — Preview de Eventos

Integra o contrato backend 27.12, commit 89033ef, por uma única chamada GET a /admin/bi/events (alias backend /api/admin/bi/events). A fonte é read-only e aceita period, startDate e endDate; unitId é rejeitado no backend e não existe na API frontend.

O fluxo é EventsCommandCenterPreview -> useEventsBI -> eventsPreviewProvider -> normalizeEventsPreviewSource -> createEventsProvider -> adaptEventsContract -> getBiEvents. Contrato, adapter, provider, hook e query key são específicos de Eventos; apenas as factories e estados genéricos são compartilhados.

São exibidos totalEvents, publishedEvents, completedEvents e upcomingEvents. scheduledEvents e cancelledEvents permanecem indisponíveis. monthlyEvolution, eventsByType e eventsByStatus participam somente da normalização e regra de vazio; eventsByUnit é descartado.

O normalizador exige version 27.12, source j12_campeonatos e readOnly true; mantém apenas agregados, valida números e datas e elimina campos desconhecidos, PII, IDs e linhas operacionais. Não há fallback de Campeonatos, Agenda, inscrições ou participantes, mutação, unitId, tenant arbitrário ou dependência nova.

O componente reutiliza PreviewShell, PreviewField, PreviewReloadButton, PreviewStatePanel, createPreviewQueryOptions e os estados loading, refresh, empty, erro inicial, erro de refresh e success. A rota usa feature flag, AppShell e ProtectedRoute para admin e coordenador.

O commit 6d63b24 documentou o bloqueio da Sprint 27.11; apesar da mensagem incorreta, não implementou preview. A implementação funcional de Eventos ocorre somente nesta Sprint 27.12B.

Limitações: unidade, agendamento e cancelamento continuam indisponíveis até existir persistência canônica. Próximo passo é validação funcional em ambiente autorizado, sem ampliar o contrato.
