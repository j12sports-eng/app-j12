# Sprint 27.18 — Evolução do Funil CRM

## Contrato canônico

A Sprint reutiliza o pipeline comercial já persistido e validado pelo domínio CRM:

`NEW → CONTACTED → QUALIFIED → PROPOSAL → NEGOTIATION → WON`

`LOST` é uma saída terminal permitida a partir dos estágios comerciais abertos. `WON` e `LOST` não possuem transições de saída. `CONTACT_ATTEMPT` não foi introduzido porque não existe no contrato atual, nos filtros nem nos dados persistidos. `TRIAL_SCHEDULED` e `TRIAL_COMPLETED` permanecem estágios legados compatíveis, exibidos pela interface quando presentes, mas não integram a política comercial canônica desta Sprint.

`backend/src/domains/crm/domain/lead-stage-transition-policy.js` é a fonte única de estágios, transições e metadados. A política preserva os códigos de erro existentes: `CRM_STAGE_INVALID`, `CRM_STAGE_UNCHANGED`, `CRM_STAGE_TERMINAL` e `CRM_STAGE_TRANSITION_INVALID`.

## Serviço e endpoint

`CrmPipelineService` valida uma transição, retorna os próximos estados possíveis e produz o read model do pipeline. Ele não recebe repository e não executa criação, atualização ou exclusão.

Endpoints protegidos e somente leitura:

- `GET /internal/crm/pipeline`
- `GET /api/internal/crm/pipeline`

A resposta contém estágios ordenados, descrições, cores, indicador terminal, transições válidas e a configuração dos campos visíveis nos cards. Query parameters são rejeitados. O fluxo de segurança permanece `requireAuth → ensureCrmInternalAccess → CrmPipelineController`.

## Leads e Kanban

A projeção interna de Leads ganhou somente `source` e `assigned_to`, colunas operacionais necessárias aos cards. A listagem continua sem nome, e-mail, telefone, CPF, metadata, payload ou idempotency key.

A tela protegida `/admin/crm/leads` usa React Query por meio de `useCrmPipeline()` e mantém a consulta paginada de Leads existente. O Kanban não oferece drag-and-drop nem qualquer mutação. Cada card mostra apenas:

- Lead ID;
- origem;
- responsável;
- status;
- última atualização.

As colunas apresentam contagem dos Leads carregados e estado vazio. Como a API existente usa cursor e não possui `totalCount`, as contagens representam apenas as páginas carregadas no navegador. Filtros, paginação, detalhe e preview de conversão permanecem disponíveis.

## Limites de escopo

Não foram adicionados automação, SLA, dashboard, estatística, notificação, atividade, agenda, integração, workflow, WebSocket, migration ou schema. Nenhum MySQL externo foi executado. As Sprints 27.17A.4.1C.1, 27.17A.4.1E e 27.17A.4.2 continuam suspensas.

## Validação

Os testes cobrem política, serviço, controller, aliases de rota, autenticação/autorização, ausência de escrita, API/hook/query keys, componentes Kanban, campos allowlistados e regressões de Leads/conversão/histórico/exportação.
