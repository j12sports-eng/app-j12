# Sprint 27.18B — Drag-and-Drop Seguro no Kanban

## Decisão arquitetural

O Kanban usa `@dnd-kit/core`. A matriz de destinos não existe no frontend: cada coluna consulta `stage.transitions`, recebida por `GET /internal/crm/pipeline`. O card original não muda de coluna enquanto a API processa a solicitação.

## Fluxo

1. O operador inicia o drag pelo handle acessível.
2. O overlay representa o movimento, mantendo o card original como fonte da verdade visual.
3. Somente colunas presentes no pipeline e listadas em `transitions` recebem destaque e aceitam drop.
4. LOST e WON abrem o diálogo existente, com o destino travado. LOST exige motivo; WON exige confirmação e não cria matrícula.
5. Os demais destinos chamam `PATCH /internal/crm/leads/:leadId/stage` com `nextStage`, `expectedStage` e `expectedStatus`.
6. Após a resposta, React Query invalida leads, pipeline, detalhe e histórico de conversão.

## Falhas e concorrência

Não há atualização otimista definitiva nem `setQueryData`. Em erro, o overlay é removido e o card continua imediatamente na coluna original. Em `CRM_STAGE_CONFLICT`, as quatro projeções CRM são invalidadas para reposicionar o card com o snapshot do backend; a mensagem exibida não expõe detalhes internos.

## Observabilidade

Os eventos `DRAG_STARTED`, `DRAG_DROPPED`, `DRAG_CANCELLED`, `DRAG_SUCCEEDED` e `DRAG_FAILED` contêm apenas `leadId`, `fromStage`, `toStage`, `duration` e `correlationId`. As métricas locais de baixa cardinalidade são `crm_drag_attempts_total`, `crm_drag_success_total`, `crm_drag_failure_total` e `crm_drag_duration_ms`, rotuladas somente por estágio e resultado. Nenhuma PII é registrada.

## Acessibilidade e compatibilidade

O sensor de teclado permanece habilitado, e o botão “Alterar estágio” continua disponível como alternativa completa. Nenhuma migration foi criada, nenhum acesso MySQL externo foi realizado e os contratos de conversão, histórico, exportação e preview não foram alterados.
