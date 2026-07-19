# Sprint 27.18C — SLA e Tempo por Etapa do Funil CRM

## Resultado

A Sprint adiciona medição read-only do tempo por etapa usando exclusivamente `crm_lead_stage_history`. Não cria migration, snapshot, job, notificação, automação, coluna de atraso ou escrita periódica. Nenhum MySQL externo faz parte da validação.

## Gate histórico e cobertura

A tabela existente registra `id`, Lead/unidade, estágios e estados anterior/novo, `action`, `actor_id`, `reason` e `created_at`. O repository atual grava um evento `CREATED` junto da criação de novos Leads e grava transições na mesma transação da mudança de estágio. A migration, porém, não executa backfill.

Por isso foi adotado o cenário B:

- `COMPLETE`: o primeiro evento ordenado por `created_at,id` é `CREATED`, com estágio/status anterior nulos, não há evento inválido, quebra de encadeamento ou truncamento;
- `PARTIAL`: existem períodos comprováveis, mas falta início confiável, há inconsistência, evento inválido ou o limite foi atingido;
- `UNAVAILABLE`: não existe evento utilizável ou o último evento não comprova a entrada na etapa atual.

`crm_leads.created_at` não é usado como fallback. Não há prova de que registros legados/importados tenham sido criados já na etapa `NEW`, portanto sintetizar essa entrada seria incorreto.

## Reconstrução e relógio

Cada evento válido representa a entrada em `new_stage`. A saída é o próximo evento ordenado; a etapa aberta termina no instante do clock injetado. Durações são inteiros em milissegundos e nunca negativos. Empates usam o `id` estável.

O serviço recebe `clock.now()`. Produção usa `Date`; testes usam relógio fixo. O pool retorna DATETIME como string (`dateStrings: true`), e timestamps sem offset são normalizados como instantes UTC, coerentes com as gravações CRM geradas por `toISOString()`. O frontend apenas formata no timezone do navegador.

WON e LOST são terminais. A etapa anterior é fechada no evento terminal, a etapa terminal fica registrada com duração zero enquanto permanecer atual e o SLA é `COMPLETED`; assim ela não acumula SLA ativo indefinidamente.

## Política de SLA

`CrmLeadStageSlaPolicy` centraliza limites, limiar e classificação. Não acessa banco e não produz efeitos.

Não foi encontrada política empresarial aprovada. A configuração operacional entregue possui `limitsMs: {}`; portanto Leads ativos com timing disponível retornam `NOT_CONFIGURED`. Nenhum prazo por etapa foi inventado.

A policy aceita limites injetados para adoção futura e testes. Quando houver limites, usa limiar centralizado de 80% (`DEFAULT_DUE_SOON_RATIO = 0.8`), explicitamente inativo sem metas aprovadas:

- `ON_TRACK`: abaixo do limiar;
- `DUE_SOON`: do limiar até o limite, inclusive;
- `OVERDUE`: acima do limite;
- `COMPLETED`: WON/LOST;
- `UNAVAILABLE`: estágio/evidência indisponível;
- `NOT_CONFIGURED`: evidência disponível sem limite aprovado.

`remainingMs` nunca é negativo; atraso usa `overdueMs`; percentual é limitado entre 0 e 100; zero e valores inválidos são rejeitados.

## Read models e endpoints

Endpoints protegidos por `requireAuth → ensureCrmInternalAccess → controller`:

- `GET /internal/crm/leads/:leadId/stage-timing`;
- `GET /api/internal/crm/leads/:leadId/stage-timing`.

O único filtro aceito no detalhe é `unitId`, que é administrativo e nunca prova autorização. O endpoint retorna Lead/etapa/status, entrada e duração atuais, cobertura, instante de medição, SLA, agregados por etapa e timeline. `reason`, contato, metadata, payload, SQL e stack não são selecionados nem retornados.

A listagem existente de Leads recebeu `stageTiming` para os cards. Ela preserva cursor, filtros e limite 50/100, executando uma única query com subconsultas indexadas e limitadas para o primeiro e o último evento de cada Lead da página. Não há N+1 de aplicação.

`GET /internal/crm/sla` não foi criado. Sem metas aprovadas e sem necessidade de uma visão global, um endpoint que filtrasse somente a página carregada seria enganoso; carregar históricos globais violaria o gate de performance. Consequentemente não há filtro global de SLA no Kanban nesta Sprint. A query key `crmLeadSla` fica centralizada apenas para invalidação/compatibilidade futura.

## Limites e performance

O detalhe executa no máximo duas leituras: projeção mínima do Lead e os 501 eventos mais recentes para detectar truncamento, retornando no máximo 500. A consulta usa `created_at DESC,id DESC`; o domínio reordena deterministicamente em ordem crescente.

A tabela possui índice `(lead_id, created_at)`, mas não um índice composto incluindo `id`. O identificador continua sendo o desempate correto, embora volumes extremos possam se beneficiar de avaliação futura de índice. Nenhuma migration foi criada nesta Sprint.

## Frontend e acessibilidade

O Kanban mostra tempo atual, badge textual de SLA, indicação de dados parciais e tooltip com entrada na etapa. Cor nunca é a única informação; o badge possui nome acessível.

O detalhe do Lead possui a seção “Tempo no funil”, com estados de loading/erro, etapa atual, entrada, duração, cobertura, resumo e timeline. Nenhum motivo sensível é exibido.

Um clock visual compartilhado por contexto atualiza a apresentação a cada 60 segundos e pausa quando a aba fica oculta. Não há polling por segundo. O backend permanece fonte de `entryAt`, medição e classificação inicial.

Após transição de etapa, React Query invalida lista, detalhe, pipeline, timing do Lead, SLA e histórico de conversões. Conflitos fazem as mesmas invalidações. Após conversão, as invalidações anteriores são preservadas e timing/SLA também são invalidados.

## Observabilidade e métricas

O serviço registra apenas `CRM_STAGE_TIMING_QUERY_SUCCEEDED` e `CRM_STAGE_TIMING_QUERY_FAILED`, com etapa, cobertura, status ou código sanitizado. Não registra Lead, usuário, unidade, contato, reason, SQL ou stack; falha do logger é fail-open.

Não foram adicionadas métricas. O adapter CRM disponível é process-local e específico da conversão; criar séries isoladas sem exportador compartilhado não agregaria observabilidade operacional confiável. A policy e o read model já expõem dimensões de baixa cardinalidade para integração futura (`stage`, `slaStatus`).

## Testes e segurança

Há testes de reconstrução, UTC, clock fixo, cobertura, empate, agregação, visitas, terminal, policy e todos os estados, service, sanitização, repository limitado/parametrizado, controller/rotas/alias/auth, frontend, invalidações e E2E sintético.

Os E2E continuam interceptando HTTP no navegador, não iniciam backend e não acessam MySQL. O secret scan e as regressões de pipeline, transição manual, drag-and-drop, conversão, histórico, exportação e observabilidade fazem parte do gate final.

## Limitações, riscos e próximos passos

- históricos anteriores ao evento inicial confiável não podem ser recuperados sem backfill comprovado;
- truncamento acima de 500 eventos reduz cobertura para `PARTIAL`;
- DATETIME não carrega offset; o contrato CRM assume UTC porque as gravações atuais vêm de `toISOString()`;
- não existem metas empresariais, visão global ou filtro global de SLA;
- a classificação muda visualmente com o tempo, mas nenhum evento é emitido por minuto.

Próximo passo possível: Sprint 27.18D — Alertas Operacionais de SLA, somente após aprovação dos prazos, validação da qualidade histórica e homologação desta medição. Não iniciada.

As Sprints 27.17A.4.1C.1, 27.17A.4.1E e 27.17A.4.2 permanecem suspensas.
