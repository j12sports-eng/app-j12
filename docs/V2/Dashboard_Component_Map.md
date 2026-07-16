# Dashboard Executivo Inteligente V2.1 — Mapa de Componentes

## 1. Status e escopo

Este documento é um contrato de projeto. Ele define nomes, limites, estados, fontes e ordem de implementação dos componentes futuros.

Nesta Sprint de planning:

- nenhum componente React é criado;
- nenhum componente é importado;
- nenhuma rota é criada ou ativada;
- src/routes/dashboard.tsx não é alterado;
- src/features/bi não é alterado;
- nenhum endpoint ou payload é alterado.

Os caminhos descritos são uma estrutura futura proposta.

## 2. Regras de componentização

1. ExecutiveDashboard compõe a tela, mas não implementa fórmulas de negócio.
2. Cards e gráficos são apresentacionais e não fazem fetch.
3. Controllers e hooks convertem queries em view models.
4. Adapters preservam available, reason, comparison, contractVersion e generatedAt.
5. Cada widget funciona de forma independente nos estados loading, error, empty, unavailable e stale.
6. Componentes V2 não importam funções internas do dashboard V1.
7. A identidade visual reutiliza AppShell, tokens Tailwind e componentes UI atuais.
8. Dados ausentes não são exibidos como zero.

## 3. Árvore visual completa

    ExecutiveDashboard
    ├── ExecutiveDashboardHeader
    │   ├── ExecutiveDashboardTitle
    │   ├── ExecutiveFreshnessIndicator
    │   └── ExecutiveRefreshButton
    ├── ExecutiveFilterRegion
    │   ├── ExecutiveFilterBar
    │   ├── ExecutiveMobileFilterSheet
    │   ├── PeriodFilter
    │   ├── DateRangeFilter
    │   ├── UnitFilter
    │   ├── ProfessorFilter
    │   ├── CategoryFilter
    │   ├── ModalityFilter
    │   ├── PaymentMethodFilter
    │   └── FinancialStatusFilter
    ├── ExecutiveKPIGrid
    │   ├── RevenueCard
    │   │   └── ExecutiveKPICard
    │   ├── CashFlowCard
    │   │   └── ExecutiveKPICard
    │   ├── StudentGrowthCard
    │   │   └── ExecutiveKPICard
    │   ├── DelinquencyCard
    │   │   └── ExecutiveKPICard
    │   ├── OccupancyCard
    │   │   └── ExecutiveKPICard
    │   └── FinancialForecastCard
    │       └── ExecutiveKPICard
    ├── ExecutiveFinancialSection
    │   ├── RevenueTrendLineChart
    │   ├── CashFlowAreaChart
    │   ├── RevenueCompositionPieChart
    │   └── ComparativeIndicatorsChart
    ├── ExecutiveGrowthSection
    │   ├── StudentGrowthBarChart
    │   ├── ModalityRankingCard
    │   └── ProfessorRankingCard
    ├── ExecutiveOperationsSection
    │   ├── OccupancyHeatmap
    │   ├── DelinquencyGauge
    │   ├── ClassesSummaryCard
    │   └── ChampionshipsSummaryCard
    ├── ExecutiveIntelligenceSection
    │   ├── ExecutiveAlertsCard
    │   └── ExecutiveInsightsCard
    ├── QuickActionsCard
    └── WidgetStatePrimitives
        ├── WidgetShell
        ├── WidgetSkeleton
        ├── WidgetError
        ├── WidgetEmpty
        ├── WidgetUnavailable
        └── WidgetStaleBadge

## 4. View models compartilhados

Os nomes abaixo são propostas futuras e não constituem código nesta Sprint.

### 4.1 ExecutiveMetricViewModel

Campos mínimos:

| Campo | Finalidade |
| --- | --- |
| id | identificador estável |
| label | rótulo acessível |
| available | diferencia valor de ausência de fonte |
| reason | motivo seguro quando indisponível |
| value | número ou null |
| unit | count, currency, percentage, hours, days ou average |
| comparison | valor anterior, percentual, tendência e disponibilidade |
| generatedAt | horário da origem |
| contractVersion | versão do contrato de origem |
| source | domínio BI responsável |

### 4.2 ExecutiveWidgetState

Campos mínimos:

- status: idle, loading, success, empty, unavailable ou error;
- isFetching;
- isStale;
- errorMessage seguro;
- retry opcional;
- generatedAt opcional.

### 4.3 ExecutiveDashboardFilters

Campos planejados:

- period;
- startDate;
- endDate;
- unitId;
- professorId;
- categoryId;
- modalityId;
- paymentMethod;
- financialStatus.

Somente period, startDate, endDate e unitId possuem suporte parcial atual. Os demais dependem de capabilities futuras.

## 5. Componentes estruturais

### 5.1 ExecutiveDashboard

Responsabilidade:

- raiz da feature;
- recebe filtros normalizados;
- coordena capabilities e consultas;
- distribui view models;
- organiza seções críticas e lazy;
- não calcula KPIs.

Props futuras:

- initialFilters opcional;
- mode opcional, route ou embedded;
- onNavigate opcional para ações controladas.

Estado:

- filtros derivados da URL;
- regiões lazy já visíveis;
- atualização manual em andamento.

Fonte:

- useExecutiveDashboardV2;
- useExecutiveCapabilities;
- useExecutiveRealtimeInvalidation.

Estados:

- skeleton apenas para a primeira dobra sem cache;
- dados anteriores durante refresh;
- falhas isoladas por seção;
- banner somente para erro transversal de capabilities ou autorização.

### 5.2 ExecutiveDashboardHeader

Responsabilidade:

- título e contexto;
- data de geração;
- indicador de cache ou atualização;
- botão de atualização manual.

Props:

- generatedAt;
- isFetching;
- isStale;
- onRefresh;
- refreshDisabled.

Não acessa QueryClient diretamente.

### 5.3 ExecutiveFilterBar

Responsabilidade:

- filtros desktop;
- aplicação validada;
- indicação de capability;
- sincronização por callback com a URL.

Props:

- value;
- capabilities;
- validation;
- onChange;
- onReset.

Estado local permitido:

- rascunho do intervalo customizado;
- estado aberto de selects.

Não filtra resultados agregados no navegador.

### 5.4 ExecutiveMobileFilterSheet

Responsabilidade:

- mesma semântica do ExecutiveFilterBar em formato móvel;
- aplicar e cancelar mudanças de forma explícita;
- preservar foco e navegação por teclado.

Props:

- value;
- capabilities;
- open;
- onOpenChange;
- onApply;
- onReset.

## 6. Primitive principal de KPI

### 6.1 ExecutiveKPICard

Responsabilidade:

- apresentar qualquer métrica executiva;
- formatar unidade;
- exibir comparação;
- anunciar indisponibilidade;
- manter altura estável.

Props:

- metric: ExecutiveMetricViewModel;
- icon;
- tone;
- emphasis opcional;
- description opcional;
- action opcional.

Estado:

- nenhum estado de domínio;
- somente interação visual local quando necessária.

Comportamento por estado:

- loading: WidgetSkeleton;
- error: WidgetError com retry local;
- unavailable: WidgetUnavailable com reason;
- success: valor e comparação;
- stale: valor preservado e WidgetStaleBadge.

Não recebe valores já formatados quando isso impedir consistência entre cards.

## 7. Cards executivos obrigatórios

| Componente | Responsabilidade | Fonte preferencial atual | Props específicas | Estado ou lacuna |
| --- | --- | --- | --- | --- |
| RevenueCard | receita do dia, mês ou ano conforme período | executive.receivedRevenue e financial.receivedRevenue | metric, periodLabel, breakdownLink opcional | suportado por período |
| CashFlowCard | entradas, saídas e saldo do período | financial recebido e expenses, apenas após contrato canônico | inflow, outflow, balance, comparison | fluxo canônico ainda indisponível |
| StudentGrowthCard | novos alunos, crescimento líquido e retenção | students | newStudents, netGrowth, retentionRate | algumas comparações podem ser unavailable |
| DelinquencyCard | taxa, valor vencido e devedores agregados | executive e delinquency | rate, overdueValue, uniqueDebtors | suportado sem PII |
| OccupancyCard | ocupação de quadras e turmas | courts e classes | courtRate, classRate, reservedHours | suporte parcial por domínio |
| FinancialForecastCard | previsão, horizonte e confiança | contrato futuro | forecast, horizon, confidence, methodology | indisponível; média móvel não é previsão |
| ProfessorRankingCard | ranking por critério aprovado | contrato futuro | rows, metricLabel, page, onPageChange | indisponível; critério não definido |
| ExecutiveAlertsCard | prioridades executivas acionáveis | insights e regras aprovadas | items, maxItems, onAction | insights atuais são determinísticos |
| ExecutiveInsightsCard | explicações, comparações e recomendações | insights e financial.insights | items, thresholds, generatedAt | não rotular como IA |
| QuickActionsCard | atalhos para rotas existentes | mapa estático autorizado | actions, role, onNavigate | ações não executam mutação no card |

### 7.1 RevenueCard

Deve:

- deixar o período explícito;
- diferenciar recebido, previsto e vencido;
- nunca misturar competência e caixa;
- permitir comparação somente quando o contract a fornecer.

Pode compor ExecutiveKPICard, mas não deve repetir consulta.

### 7.2 CashFlowCard

Até existir contrato canônico:

- renderiza WidgetUnavailable;
- informa “Fluxo de caixa canônico não disponível”;
- não reutiliza silenciosamente o cálculo local de useFinanceiroAdmin;
- não calcula saldo disponível no frontend.

### 7.3 StudentGrowthCard

Deve diferenciar:

- pessoa;
- perfil de aluno;
- matrícula;
- crescimento líquido;
- retenção;
- churn.

Não apresenta cancelamento temporal como disponível quando a origem retornar reason.

### 7.4 DelinquencyCard

Não apresenta:

- nomes;
- documentos;
- contatos;
- lista individual de devedores.

Pode fornecer link autorizado para /admin/bi/inadimplencia.

### 7.5 OccupancyCard

Deve manter duas métricas separadas:

- ocupação de quadras;
- ocupação de turmas.

Um único percentual consolidado só poderá existir com fórmula contratual aprovada.

### 7.6 ProfessorRankingCard

Critérios que exigem decisão antes de implementação:

- presença;
- quantidade de aulas;
- ocupação média;
- retenção;
- receita atribuída.

O componente não escolherá o critério por conta própria.

### 7.7 FinancialForecastCard

Props futuras devem incluir:

- forecastValue;
- lowerBound;
- upperBound;
- horizon;
- confidence;
- methodologyLabel;
- generatedAt;
- available;
- reason.

Sem esses campos, o estado correto é unavailable.

### 7.8 ExecutiveAlertsCard

Ordenação:

1. critical;
2. warning;
3. info;
4. success.

Cada alerta deve possuir:

- id;
- severidade;
- título;
- descrição;
- fonte;
- timestamp;
- ação recomendada;
- destino autorizado opcional.

### 7.9 ExecutiveInsightsCard

Deve explicar:

- métrica atual;
- referência anterior;
- variação;
- fonte;
- limite aplicado;
- ação sugerida.

Não deve afirmar causalidade e não deve usar linguagem de IA quando a regra for determinística.

### 7.10 QuickActionsCard

Ações futuras candidatas, sempre por navegação:

- novo aluno;
- nova cobrança;
- registrar presença;
- criar turma;
- agenda de quadras;
- relatórios;
- aula experimental.

O componente recebe ações já filtradas por papel. Ele não chama endpoints financeiros, Pix ou Banco Inter.

## 8. Gráficos obrigatórios

### 8.1 RevenueTrendLineChart — linha

Responsabilidade:

- mostrar evolução temporal da receita;
- permitir série atual e referência anterior;
- exibir tabela ou resumo acessível.

Fonte:

- financial.evolution;
- comparativos do contract financial.

Props:

- series;
- comparisonSeries opcional;
- currency;
- periodGranularity;
- state.

### 8.2 StudentGrowthBarChart — barra

Responsabilidade:

- comparar novos alunos e novas matrículas;
- opcionalmente mostrar crescimento líquido quando suportado.

Fonte:

- students.evolution.

Props:

- series;
- showEnrollments;
- showNetGrowth;
- state.

### 8.3 RevenueCompositionPieChart — pizza

Responsabilidade:

- composição por categoria, modalidade, unidade ou meio de pagamento;
- limitar categorias visuais e agrupar excedente como “Outros” somente em adapter de apresentação;
- fornecer lista textual completa.

Fonte:

- financial.breakdowns.

Props:

- title;
- rows;
- valueFormatter;
- maxSlices;
- state.

### 8.4 OccupancyHeatmap — heatmap

Responsabilidade:

- cruzar dia e horário para mostrar ocupação;
- oferecer alternativa tabular;
- nunca depender apenas da cor.

Fonte atual:

- courts rankings.days e rankings.hours não formam uma matriz confiável.

Estado:

- unavailable até existir matriz canônica por dia, horário e unidade;
- a grade artesanal do V1 não deve ser promovida automaticamente a KPI BI.

Props futuras:

- rows;
- columns;
- cells;
- scale;
- state;
- accessibleSummary.

### 8.5 DelinquencyGauge — gauge

Responsabilidade:

- exibir taxa de inadimplência contra faixas aprovadas;
- mostrar valor numérico e rótulo;
- não inferir meta.

Fonte:

- delinquency.delinquencyRate;
- thresholds somente quando fornecidos.

Props:

- value;
- min;
- max;
- thresholds;
- state.

Implementação pode usar primitives Recharts existentes. Não há biblioteca de gauge dedicada aprovada.

### 8.6 CashFlowAreaChart — área

Responsabilidade:

- apresentar entradas e saídas ao longo do tempo;
- destacar saldo sem ocultar séries;
- respeitar competência e caixa definidos no contrato.

Fonte:

- contrato futuro de fluxo de caixa;
- financial.evolution isoladamente não é suficiente para saídas.

Estado:

- unavailable até contrato apropriado.

### 8.7 ComparativeIndicatorsChart — indicadores comparativos

Responsabilidade:

- comparar atual, anterior, meta e variação quando disponíveis;
- funcionar como barras compactas, bullet chart ou linhas;
- preservar reason por indicador.

Fonte:

- BiComparison;
- financial.insights;
- contratos futuros de metas.

Meta ausente não pode ser desenhada como zero.

## 9. Componentes auxiliares

### 9.1 ModalityRankingCard

Fonte possível:

- students.distributions.modalities;
- financial.breakdowns.modalities.

Essas fontes representam dimensões diferentes. O título deve declarar “alunos por modalidade” ou “receita por modalidade”; não existe ranking genérico sem métrica.

### 9.2 ClassesSummaryCard

Fonte:

- classes.kpis.

Conteúdo:

- turmas ativas;
- alunos matriculados;
- vagas;
- ocupação;
- lotadas;
- subutilizadas.

### 9.3 ChampionshipsSummaryCard

Fonte:

- championships.kpis.

Conteúdo:

- campeonatos ativos;
- inscrições;
- equipes;
- partidas realizadas e pendentes.

### 9.4 ExecutiveFreshnessIndicator

Deve usar generatedAt e estado de query.

Rótulos:

- atualizado;
- atualizando;
- dados em cache;
- desatualizado;
- horário indisponível.

### 9.5 ExecutiveRefreshButton

Dispara callback do controller. Não conhece query keys e não executa fetch diretamente.

## 10. Estados padronizados

### 10.1 WidgetShell

Responsabilidade:

- título;
- descrição;
- ação;
- timestamp;
- região de conteúdo;
- associação acessível;
- tamanho mínimo estável.

### 10.2 WidgetSkeleton

- replica dimensões finais;
- não anima quando prefers-reduced-motion estiver ativo;
- não substitui dados existentes durante refetch.

### 10.3 WidgetError

- mensagem segura;
- botão “Tentar novamente” opcional;
- retry somente da query afetada;
- sem stack trace na interface.

### 10.4 WidgetEmpty

Usado quando a consulta foi válida e a coleção está vazia.

Exemplo: nenhum campeonato no período.

### 10.5 WidgetUnavailable

Usado quando:

- fonte não existe;
- capability está ausente;
- contract marcou available igual a false;
- versão não é reconhecida;
- filtro não é suportado.

Exibe reason seguro. Não exibe zero.

### 10.6 WidgetStaleBadge

Mantém o último valor válido enquanto:

- revalidação ocorre;
- conexão está temporariamente indisponível;
- dado ultrapassou o budget de frescor.

## 11. Props, estado e fonte por região

| Região | Dono do estado | Fonte | Fetch dentro do presenter |
| --- | --- | --- | --- |
| Header | ExecutiveDashboard | generatedAt agregado e query state | não |
| Filtros | URL + controller | capabilities | não |
| KPI grid | controller V2 | executive, financial, students, classes, courts | não |
| Financeiro | controller da seção | financial e contrato futuro | não |
| Crescimento | controller da seção | students e contrato futuro de professores | não |
| Operação | controller da seção | classes, courts e championships | não |
| Inteligência | controller da seção | insights e financial.insights | não |
| Ações rápidas | composição estática autorizada | rotas existentes | não |

## 12. Estrutura futura de pastas

    src/features/executive-dashboard-v2/
    ├── api/
    │   └── executive-dashboard-v2.api.ts
    ├── adapters/
    │   ├── executive.adapter.ts
    │   ├── financial.adapter.ts
    │   ├── students.adapter.ts
    │   ├── operations.adapter.ts
    │   └── executive-dashboard.adapter.ts
    ├── components/
    │   ├── ExecutiveDashboard.tsx
    │   ├── actions/
    │   │   └── QuickActionsCard.tsx
    │   ├── charts/
    │   │   ├── CashFlowAreaChart.tsx
    │   │   ├── ComparativeIndicatorsChart.tsx
    │   │   ├── DelinquencyGauge.tsx
    │   │   ├── OccupancyHeatmap.tsx
    │   │   ├── RevenueCompositionPieChart.tsx
    │   │   ├── RevenueTrendLineChart.tsx
    │   │   └── StudentGrowthBarChart.tsx
    │   ├── filters/
    │   │   ├── ExecutiveFilterBar.tsx
    │   │   └── ExecutiveMobileFilterSheet.tsx
    │   ├── intelligence/
    │   │   ├── ExecutiveAlertsCard.tsx
    │   │   └── ExecutiveInsightsCard.tsx
    │   ├── kpis/
    │   │   ├── CashFlowCard.tsx
    │   │   ├── DelinquencyCard.tsx
    │   │   ├── ExecutiveKPICard.tsx
    │   │   ├── FinancialForecastCard.tsx
    │   │   ├── OccupancyCard.tsx
    │   │   ├── RevenueCard.tsx
    │   │   └── StudentGrowthCard.tsx
    │   ├── layout/
    │   │   ├── ExecutiveDashboardHeader.tsx
    │   │   ├── ExecutiveKPIGrid.tsx
    │   │   └── ExecutiveSection.tsx
    │   ├── rankings/
    │   │   ├── ModalityRankingCard.tsx
    │   │   └── ProfessorRankingCard.tsx
    │   ├── states/
    │   │   ├── WidgetEmpty.tsx
    │   │   ├── WidgetError.tsx
    │   │   ├── WidgetShell.tsx
    │   │   ├── WidgetSkeleton.tsx
    │   │   ├── WidgetStaleBadge.tsx
    │   │   └── WidgetUnavailable.tsx
    │   └── summaries/
    │       ├── ChampionshipsSummaryCard.tsx
    │       └── ClassesSummaryCard.tsx
    ├── hooks/
    │   ├── useExecutiveCapabilities.ts
    │   ├── useExecutiveDashboardV2.ts
    │   ├── useExecutiveFilters.ts
    │   ├── useExecutiveRealtimeInvalidation.ts
    │   └── useVisibleExecutiveSection.ts
    ├── query-keys/
    │   └── executive-dashboard-v2-query-keys.ts
    ├── types/
    │   └── executive-dashboard-v2.types.ts
    ├── utils/
    │   ├── executive-formatters.ts
    │   └── executive-validation.ts
    └── tests/
        ├── adapters/
        ├── components/
        └── contracts/

Rota futura, fora desta Sprint:

    src/routes/admin/dashboard-executivo-v2.tsx

Essa rota não substitui src/routes/dashboard.tsx.

## 13. Lazy loading e boundaries

Carregamento planejado:

1. ExecutiveDashboard e primeira dobra.
2. KPIs críticos.
3. seção financeira.
4. crescimento quando próximo da viewport.
5. operação quando próximo da viewport.
6. inteligência quando próximo da viewport.

Cada grupo de gráficos terá:

- import lazy;
- Suspense local;
- Error Boundary local;
- skeleton com altura fixa;
- retry de chunk separado do retry da query.

Cards de texto pequenos não precisam de lazy individual.

## 14. Memoização

Aplicar:

- React.memo em ExecutiveKPICard, linhas de ranking e cards apresentacionais;
- useMemo para séries, matrizes do heatmap e view models;
- useCallback para refresh, navegação e paginação;
- objetos de filtros normalizados e estáveis.

Não aplicar memoização indiscriminada a componentes triviais. Primeiro medir rerenders.

## 15. Paginação e virtualização

ProfessorRankingCard, ModalityRankingCard, alertas e tabelas devem começar paginados.

Regras:

- página inicial pequena;
- total informado pelo contrato quando existir;
- filtros reiniciam a página;
- botão “ver mais” é aceitável em mobile;
- virtualização somente acima de volume medido;
- nenhuma dependência nova nesta Sprint.

## 16. Responsividade por componente

| Componente | Mobile | Desktop |
| --- | --- | --- |
| ExecutiveFilterBar | substituído pelo Sheet | linha ou grade |
| ExecutiveKPIGrid | uma coluna | duas a quatro colunas |
| RevenueTrendLineChart | altura fixa e legenda compacta | legenda completa |
| RevenueCompositionPieChart | gráfico seguido de lista | gráfico e lista lado a lado |
| OccupancyHeatmap | scroll controlado e resumo | matriz completa |
| ProfessorRankingCard | cards ou lista paginada | tabela compacta |
| QuickActionsCard | grade 2 colunas | até 4 ou 7 ações |
| ExecutiveAlertsCard | lista vertical | uma ou duas colunas |

## 17. Acessibilidade por componente

- ExecutiveKPICard anuncia rótulo, valor, unidade e comparação.
- DelinquencyGauge possui valor textual equivalente.
- OccupancyHeatmap possui tabela ou resumo equivalente.
- PieChart possui lista completa de categorias.
- Tooltips complementam, nunca substituem labels.
- Filtros unavailable permanecem identificáveis, com motivo.
- WidgetError move foco apenas quando provocado por ação do usuário.
- Refresh usa aria-busy e não remove o conteúdo anterior.
- QuickActionsCard expõe destino e não usa apenas ícone.

## 18. Ordem de implementação futura

### Etapa 1 — contratos e fixtures

- congelar exemplos dos contracts 21.1 a 21.8 e 21.11;
- testar versões;
- documentar unavailable e reason;
- definir tipos V2.

### Etapa 2 — adapters e query orchestration

- adapters puros;
- reuso de biQueryKeys;
- useExecutiveCapabilities;
- useExecutiveDashboardV2;
- testes de paridade.

### Etapa 3 — estados e layout

- WidgetShell;
- WidgetSkeleton;
- WidgetError;
- WidgetEmpty;
- WidgetUnavailable;
- header e filtros.

### Etapa 4 — KPIs suportados

- ExecutiveKPICard;
- RevenueCard;
- StudentGrowthCard;
- DelinquencyCard;
- OccupancyCard.

CashFlowCard e FinancialForecastCard entram desde o início com estado unavailable, sem simulação.

### Etapa 5 — gráficos suportados

- RevenueTrendLineChart;
- StudentGrowthBarChart;
- RevenueCompositionPieChart;
- ComparativeIndicatorsChart;
- DelinquencyGauge quando thresholds forem aprovados.

### Etapa 6 — operação e inteligência

- ClassesSummaryCard;
- ChampionshipsSummaryCard;
- ModalityRankingCard;
- ExecutiveAlertsCard;
- ExecutiveInsightsCard;
- QuickActionsCard.

OccupancyHeatmap e ProfessorRankingCard permanecem unavailable até contrato suficiente.

### Etapa 7 — rota aditiva

- criar a rota futura;
- manter fora da navegação padrão;
- proteger admin e coordenador;
- validar SSR e lazy chunks.

### Etapa 8 — desempenho e acessibilidade

- medir budgets;
- otimizar lazy boundaries;
- validar teclado e leitor de tela;
- decidir paginação ou virtualização;
- testar mobile real.

### Etapa 9 — piloto e paridade

- comparar BI, V1 e V2;
- revisar divergências;
- executar gates completos;
- obter aceite antes de qualquer promoção.

## 19. Critérios de aceite do mapa

O mapa estará pronto para implementação quando:

- cada KPI possuir fonte ou estado unavailable;
- cada filtro possuir capability;
- nenhum presenter executar fetch ou regra de negócio;
- loading, error, empty, unavailable e stale tiverem representação;
- todos os gráficos possuírem alternativa acessível;
- rota futura e rollback estiverem definidos;
- budgets estiverem associados a medição;
- componentes V1 permanecerem intocados.

Até a aprovação desses critérios, este arquivo permanece exclusivamente documental.
