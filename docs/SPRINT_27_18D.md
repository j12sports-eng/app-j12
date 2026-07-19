# Sprint 27.18D — Alertas Operacionais de SLA do CRM

## Resultado

A Sprint adiciona uma projeção operacional read-only dos resultados de timing e SLA da Sprint 27.18C. O alerta não é persistido e não redefine prazo, percentual, cobertura ou terminalidade. Nenhuma migration, tabela, coluna, escrita periódica, fila, cron, job, WebSocket ou notificação faz parte da solução.

Não existem metas empresariais de SLA aprovadas. A configuração operacional continua com limites vazios; por isso Leads ativos com histórico mensurável retornam `NOT_CONFIGURED`. O suporte técnico a `WARNING` e `OVERDUE` permanece exercitável por policy injetada e dados sintéticos, sem ativar prazos fictícios em produção.

## Arquitetura e reutilização

Foi adotada a Strategy A: o serviço de alertas consome a projeção paginada de `CrmLeadQueryService`, que já produz `stageTiming` e aplica `CrmLeadStageSlaPolicy` em uma única leitura limitada. A classificação operacional apenas mapeia o status já calculado:

| SLA existente    | Alerta operacional |
| ---------------- | ------------------ |
| `OVERDUE`        | `OVERDUE`          |
| `DUE_SOON`       | `WARNING`          |
| `NOT_CONFIGURED` | `NOT_CONFIGURED`   |
| `UNAVAILABLE`    | `UNAVAILABLE`      |
| `ON_TRACK`       | `NORMAL`           |
| `COMPLETED`      | `COMPLETED`        |

O classificador é exaustivo e não recalcula percentuais. Um estado desconhecido falha de forma controlada, em vez de inventar classificação.

Fluxo:

```text
crm_leads paginados
→ stageTiming já projetado
→ CrmLeadStageSlaPolicy já aplicada
→ classificação operacional
→ serviço read-only
→ endpoint interno protegido
→ React Query
→ painel Alertas de SLA
```

Não foi criado repository dedicado. O serviço executa uma consulta de Leads por página de origem e não consulta histórico individual por Lead; portanto não há N+1 de aplicação nem carregamento integral do CRM.

## Paginação, ranking e limites

- limite padrão: 25;
- limite máximo: 100;
- sem `OFFSET` e sem `totalCount`;
- cursor de alertas opaco e versionado;
- o cursor encapsula o cursor da página fonte e os filtros `stage`, `slaStatus` e `unitId`;
- reutilizar um cursor com filtros divergentes retorna `CRM_CURSOR_INVALID`;
- `hasMore` e `nextCursor` refletem a paginação limitada da fonte, inclusive quando um filtro de alerta produz uma página vazia.

Os itens retornados em cada página são ordenados por criticidade: `OVERDUE`, `WARNING`, `UNAVAILABLE`, `NOT_CONFIGURED`, `NORMAL` e `COMPLETED`. Dentro da mesma classe, o serviço usa atraso, prazo restante, entrada na etapa e Lead ID como desempates determinísticos aplicáveis.

O ranking é deliberadamente **por página fonte**, não global. Fazer ranking global exigiria carregar todos os Leads ou duplicar a policy no SQL, contrariando os gates de performance e arquitetura. Da mesma forma, `summary.pageCounts` conta apenas os itens efetivamente retornados na página; nunca representa o CRM inteiro.

## Endpoint e filtros

Endpoints:

- `GET /internal/crm/sla-alerts`;
- `GET /api/internal/crm/sla-alerts`.

Ambos preservam `requireAuth → ensureCrmInternalAccess → controller`. A autorização atual é global para administradores e coordenadores. `unitId` é somente filtro administrativo e nunca prova autorização.

Query allowlist:

- `cursor`;
- `limit`;
- `stage`;
- `slaStatus`;
- `unitId`.

Arrays, objetos, campos desconhecidos, valores vazios inválidos, cursores malformados e tentativas de prototype pollution são rejeitados. Os estados aceitos em `slaStatus` são `OVERDUE`, `WARNING`, `NOT_CONFIGURED`, `UNAVAILABLE`, `NORMAL` e `COMPLETED`. Sem esse filtro, `NORMAL` e `COMPLETED` ficam ocultos.

`responsibleId` foi omitido. O schema atual possui somente `assigned_to VARCHAR(64)`, sem foreign key ou contrato que prove tratar-se de identificador canônico; expô-lo como ID poderia divulgar um nome ou outro dado pessoal.

Erros determinísticos:

- `CRM_INPUT_INVALID` — 400;
- `CRM_CURSOR_INVALID` — 400;
- não autenticado — 401;
- `CRM_ACCESS_DENIED` — 403;
- `CRM_SLA_ALERT_QUERY_FAILED` — 500 sanitizado.

## Read model e privacidade

Cada item contém exclusivamente Lead ID, unidade, etapa, status, classificação, cobertura, entrada e tempo na etapa, instante de medição, resumo SLA e data de atualização. A resposta não inclui contato, nome, CPF, e-mail, telefone, data de nascimento, `reason`, `metadata`, payload, idempotency key, SQL, stack ou o corpo integral do Lead.

O envelope inclui:

```text
items
nextCursor
hasMore
appliedFilters
summary.pageCounts
```

O mapeamento constrói um novo objeto allowlistado; não espalha a projeção original do Lead.

## Frontend e atualização

O painel “Alertas de SLA” foi integrado acima do Kanban, sem substituir o pipeline. Ele possui estados de loading, erro, vazio, dados, filtro ativo, próxima página, SLA não configurado e histórico indisponível. Os grupos apresentam texto além de cor e os controles possuem labels acessíveis.

Os filtros são enviados ao backend; não há filtragem enganosa apenas sobre os itens já exibidos. A paginação usa o cursor retornado. A ação de abrir detalhe reutiliza o diálogo canônico do Lead e permanece acessível por teclado.

As query keys de alertas ficam sob a raiz de SLA já reservada pela Sprint 27.18C. Assim, mudança manual, drag-and-drop, conflito e conversão reutilizam as invalidações existentes, sem um segundo `PATCH`, refetch manual duplicado ou lógica paralela.

Não foi criado polling novo. O clock visual compartilhado de 60 segundos continua responsável apenas pela apresentação e pausa em aba oculta.

## Observabilidade e segurança

Os eventos específicos da consulta usam somente campos allowlistados e falham em modo fail-open. Não registram Lead IDs em lote, filtros completos, body, PII, SQL, stack ou token. Métricas, quando um adapter é injetado, usam dimensões de baixa cardinalidade; IDs de Lead, unidade, usuário, responsável e correlação não são labels.

O frontend registra apenas visualização, aplicação de filtro, abertura do detalhe e falha de carga. Os eventos não armazenam resposta, filtros completos ou alertas em `localStorage`, e não são emitidos a cada render.

## E2E sintético

`e2e/crm-kanban/crm-kanban.sla-alerts.spec.cjs` reutiliza o servidor Vite e a interceptação HTTP do Kanban. O fixture entrega quatro estados operacionais sem PII, paginação por cursor, atraso controlado, erro controlável e contadores de requests.

Os cenários cobrem painel, grupos, mensagens de `NOT_CONFIGURED` e `UNAVAILABLE`, filtros enviados e limpeza, carregamento da próxima página, abertura do detalhe por teclado, layout mobile, drag preservado, exatamente um `PATCH` e uma invalidação funcional dos alertas. O backend real não é iniciado e MySQL não é acessado.

Comando isolado:

```bash
npm exec playwright -- test e2e/crm-kanban/crm-kanban.sla-alerts.spec.cjs --config=playwright.crm-kanban.config.cjs --project=chromium-desktop
```

Regressão completa do Kanban:

```bash
npm run e2e:27.18b.1
```

## Limitações e riscos conhecidos

- sem limites empresariais, `NOT_CONFIGURED` pode dominar as páginas e isso não significa atraso;
- ranking e `pageCounts` são locais à página fonte limitada, não totais globais;
- a qualidade do alerta herda a cobertura `COMPLETE`, `PARTIAL` ou `UNAVAILABLE` da projeção de timing;
- `assigned_to` não possui identidade canônica comprovada e permanece fora do contrato;
- a autorização da plataforma não possui vínculo granular usuário–unidade;
- a observabilidade HTTP global preexistente usa a URL original e pode incluir a query string nos eventos genéricos; os novos eventos de SLA não repetem filtros, e uma sanitização global futura deve ser avaliada separadamente;
- o índice histórico atual não inclui o ID de desempate; volumes extremos podem exigir análise futura, sem criar índice nesta Sprint.

Nenhum desses riscos foi contornado com migration, acesso ao MySQL externo, escrita, cache persistente ou cálculo alternativo de SLA.

## Fora do escopo e próximo passo

Não foram criados notificações, e-mail, WhatsApp, SMS, jobs, filas, cron, scheduler, WebSocket, automação de estágio, dashboard executivo, gráficos, configuração de SLA pelo usuário, exportação, PDF ou Excel.

As Sprints `27.17A.4.1C.1`, `27.17A.4.1E` e `27.17A.4.2` continuam suspensas por dependência externa de MySQL. O próximo passo possível é a Sprint 27.18E — Dashboard Comercial do CRM, que não foi iniciada.
