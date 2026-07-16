# Dashboard Executivo Inteligente V2.1 — Arquitetura

## 1. Status deste documento

Este documento é um contrato de projeto da Sprint V2.1. Ele descreve a arquitetura pretendida para o Dashboard Executivo Inteligente, mas não cria, importa, registra nem ativa componentes React.

Nesta Sprint de planejamento:

- a rota atual /dashboard permanece inalterada;
- as rotas atuais /admin/bi e /admin/bi/* permanecem inalteradas;
- nenhum endpoint, payload, contrato, migration ou regra de negócio é modificado;
- nenhuma biblioteca é adicionada;
- nenhuma consulta externa ou mudança de produção é realizada.

Qualquer arquivo, rota, endpoint, tipo ou componente marcado como “futuro” neste documento depende de uma Sprint de implementação própria e de gates específicos.

## 2. Objetivo arquitetural

Construir, em uma etapa futura, uma nova superfície executiva capaz de:

- consolidar indicadores financeiros, comerciais e operacionais;
- reutilizar os contratos BI existentes antes de propor novos contratos;
- apresentar ausência de dados de forma explícita, sem fabricar números;
- preservar integralmente o dashboard V1 e todas as rotas públicas atuais;
- permitir evolução incremental, rollback simples e comparação de paridade;
- manter segurança, responsividade, acessibilidade e desempenho mensuráveis.

## 3. Baseline atual

### 3.1 Dashboard V1

O dashboard administrativo atual vive em src/routes/dashboard.tsx e atende /dashboard.

Seu comportamento de autorização é:

- admin e coordenador recebem o dashboard executivo atual;
- professor é direcionado ao fluxo de presenças;
- responsável é direcionado ao portal do responsável;
- aluno é direcionado ao portal do aluno.

O dashboard V1 agrega dados no navegador por meio de stores e hooks de módulos operacionais:

| Fonte atual | Cliente ou store | Uso executivo atual |
| --- | --- | --- |
| /alunos | alunos-store | base ativa, novos alunos, retenção e modalidades |
| /turmas | turmas-store | aulas, presença e ocupação |
| /professores | professores-store | professores ativos e agenda |
| /api/state/trial-classes | trial-classes-store | aulas experimentais |
| /financeiro/resumo | useFinanceiroAdmin | resumo financeiro |
| /financeiro | useFinanceiroAdmin | cobranças, receita e inadimplência |
| /financeiro/automacoes/status | useFinanceiroAdmin | estado de automações |
| /financeiro/despesas | useFinanceiroAdmin | despesas e fluxo local |
| /dashboard/birthdays | BirthdayService | aniversariantes |

O V1 usa useMemo para montar uma visão local a partir de coleções completas. Essa solução deve continuar funcionando, mas não deve ser tratada como contrato canônico para os novos KPIs V2. Cálculos de lucro, previsão, saldo ou retenção não devem ser copiados para a V2 sem semântica backend formal.

### 3.2 Fundação BI existente

O frontend BI está isolado em src/features/bi e usa TanStack Query, tipos explícitos e contratos somente leitura.

| Domínio | Endpoint existente | Versão tipada | Conteúdo principal |
| --- | --- | --- | --- |
| Capabilities | GET /admin/bi/foundation | 21.1 | períodos, filtros e disponibilidade |
| Executivo | GET /admin/bi/executive | 21.2 | oito KPIs executivos |
| Financeiro | GET /admin/bi/financial | 21.3 | KPIs, evolução, composições e comparativos |
| Alunos | GET /admin/bi/students | 21.4 | crescimento, retenção e distribuições |
| Turmas | GET /admin/bi/classes | 21.5 | capacidade, ocupação, dimensões e tabela |
| Inadimplência | GET /admin/bi/delinquency | 21.6 | aging, recuperação e status |
| Quadras | GET /admin/bi/courts | 21.7 | horas, ocupação, receita e rankings |
| Campeonatos | GET /admin/bi/championships | 21.8 | competições, inscrições e partidas |
| Insights | GET /admin/bi/insights | 21.11 | regras administrativas explicáveis |
| Exportações | GET /admin/bi/exports/:report/:format | atual | CSV, XLSX e PDF |

Os query keys atuais partem de [bi] e incluem o domínio e filtros normalizados. Os hooks principais usam staleTime de cinco minutos e retry igual a um. Não existe polling BI contínuo.

### 3.3 Relação entre V1, BI e V2

O V1 e o BI atual são superfícies válidas e independentes. A V2 não substitui nenhuma delas nesta Sprint.

Diretriz:

1. V1 continua sendo a rota operacional corrente.
2. BI continua sendo a fonte agregada preferencial.
3. V2 nasce como feature isolada e consumidora dos contratos BI.
4. Lacunas permanecem indisponíveis até existir contrato canônico.
5. A eventual promoção da V2 depende de paridade, autorização e aceite formal.

## 4. Princípios e decisões

### 4.1 Compatibilidade primeiro

- Não importar componentes internos de src/routes/dashboard.tsx.
- Não mover funções, stores ou JSX do dashboard atual.
- Não mudar o significado dos endpoints BI existentes.
- Não alterar query keys atuais sem uma estratégia de migração.
- Não usar zero como substituto de informação indisponível.

### 4.2 Feature isolada

A implementação futura deverá residir em src/features/executive-dashboard-v2. O nome explícito evita colisão com a função interna ExecutiveDashboard do dashboard V1 e com BiExecutiveDashboard.

### 4.3 Rota aditiva

Uma Sprint futura poderá criar /admin/dashboard-executivo-v2, protegida para admin e coordenador.

Essa rota:

- não substituirá /dashboard durante desenvolvimento e homologação;
- não será adicionada automaticamente ao menu antes do piloto;
- não redirecionará rotas existentes;
- poderá ser removida ou desativada sem afetar o V1;
- exigirá atualização controlada do route tree na Sprint de implementação.

### 4.4 Apresentação sem regra de negócio

Componentes devem receber view models já normalizados. Eles podem formatar moeda, número, data e tendência, mas não definir fórmulas financeiras ou operacionais.

## 5. Arquitetura em camadas

### 5.1 Camada de rota futura

Responsabilidades:

- aplicar ProtectedRoute para admin e coordenador;
- carregar o módulo V2 de forma lazy;
- validar parâmetros de busca;
- hospedar o AppShell;
- não executar consultas antes de autenticação e papel estarem resolvidos.

### 5.2 Camada de composição

ExecutiveDashboard será o orquestrador visual.

Responsabilidades:

- manter filtros globais validados;
- solicitar capabilities;
- organizar regiões críticas e secundárias;
- coordenar queries sem duplicá-las;
- repassar view models para widgets;
- expor atualização manual e horário de geração;
- isolar falhas por widget.

### 5.3 Camada de dados

Será formada por:

- clientes existentes em src/features/bi/api;
- query keys existentes em src/features/bi/query-keys;
- hooks ou useQueries com os mesmos query keys;
- adapters V2 puros;
- tipos V2 de apresentação;
- um eventual cliente agregado aditivo, somente se aprovado.

### 5.4 Camada de apresentação

Cards e gráficos serão componentes controlados, sem fetch próprio e sem acesso direto ao token.

Cada widget receberá:

- dados;
- estado loading;
- estado error;
- estado unavailable com reason;
- estado stale;
- ação de retry limitada à sua query;
- timestamp de geração quando disponível.

### 5.5 Camada de infraestrutura compartilhada

Reutilizar:

- AppShell;
- ProtectedRoute;
- api e ApiError;
- QueryClientProvider existente;
- ChartContainer e tooltips existentes;
- Tailwind e tokens visuais atuais;
- Sonner somente para ações iniciadas pelo usuário.

## 6. Fluxo de dados textual

Fluxo planejado:

    Usuário autenticado
      -> rota futura protegida
      -> validação de papel admin/coordenador
      -> leitura dos filtros da URL
      -> normalização dos filtros
      -> consulta de capabilities
      -> planejamento das queries habilitadas
      -> TanStack Query usando query keys BI existentes
      -> clientes HTTP existentes
      -> endpoints BI somente leitura
      -> contracts versionados
      -> adapters V2 puros
      -> view model executivo
      -> widgets independentes
      -> gráficos e resumos acessíveis

Fluxo de revalidação:

    evento autorizado ou atualização manual
      -> mapeamento evento/domínio
      -> coalescimento
      -> invalidateQueries da chave afetada
      -> refetch pelo TanStack Query
      -> novo contract completo
      -> novo view model

O payload de um evento nunca deve substituir diretamente um total executivo.

## 7. Orquestração dos endpoints

### 7.1 Estratégia inicial

A primeira implementação deve orquestrar contratos existentes em paralelo, por domínio, usando os mesmos query keys de src/features/bi.

Consultas críticas acima da dobra:

1. foundation, para capabilities;
2. executive, para KPIs consolidados;
3. financial, para receita, despesas e comparativos.

Consultas secundárias poderão ser habilitadas por seção visível:

- students;
- classes;
- delinquency;
- courts;
- championships;
- insights.

Isso reduz competição na carga inicial sem esconder indisponibilidade.

### 7.2 Adapters

Adapters serão funções puras, sem hooks e sem efeitos colaterais.

Exemplos futuros:

- adaptExecutiveContractToKpis;
- adaptFinancialContractToRevenue;
- adaptStudentsContractToGrowth;
- adaptClassesContractToOccupancy;
- adaptCourtsContractToHeatmap;
- adaptInsightsContractToAlerts;
- mergeExecutiveDashboardViewModel.

Os adapters devem:

- preservar contractVersion;
- preservar generatedAt;
- preservar available e reason;
- preservar a comparação original;
- converter apenas forma, não semântica;
- rejeitar ou marcar versões desconhecidas;
- nunca somar métricas incompatíveis.

### 7.3 Endpoint agregado futuro

Se medição real demonstrar excesso de latência ou inconsistência temporal, poderá ser proposto um endpoint novo e aditivo:

    GET /admin/bi/v2/executive-dashboard

Ele não faz parte desta Sprint e não deverá substituir endpoints atuais.

Um contrato agregado futuro deverá incluir:

- contractVersion próprio;
- generatedAt único;
- filtros aplicados;
- capabilities por filtro e widget;
- KPIs com available e reason;
- seções parciais versionadas;
- identificação segura de dados stale;
- nenhuma informação pessoal desnecessária.

## 8. KPIs e lacunas

### 8.1 Cobertura atual

Há base BI para:

- receita recebida por período;
- receita prevista, pendente e vencida;
- despesas pagas;
- ticket médio;
- inadimplência;
- novos alunos;
- cancelamentos quando a fonte temporal estiver disponível;
- retenção e churn;
- ocupação de turmas e quadras;
- quantidade de turmas;
- campeonatos, equipes, inscrições e partidas;
- ranking de modalidades;
- alertas e insights determinísticos.

### 8.2 Lacunas que não podem ser simuladas

Permanecem sem contrato executivo suficiente:

- lucro;
- fluxo de caixa canônico;
- saldo disponível;
- receita da lanchonete;
- ranking de professores;
- previsão financeira.

FinancialForecastCard deve mostrar unavailable até existir modelo e contrato aprovados. Tendência por média móvel não deve ser rotulada como previsão.

## 9. Filtros e capabilities

### 9.1 Filtros existentes

Os contratos BI atuais aceitam, conforme o domínio:

- period;
- startDate;
- endDate;
- unitId.

Campeonatos não possui unitId no cliente atual.

### 9.2 Filtros solicitados sem suporte atual

Ainda não há filtro de query BI para:

- professor;
- categoria;
- modalidade;
- forma de pagamento;
- status financeiro.

Modalidade e forma de pagamento aparecem como dimensões de saída, o que não equivale a suporte de filtro.

### 9.3 Comportamento V2

O estado de filtros deverá ficar na URL da rota futura para permitir refresh e links reproduzíveis.

Regras:

- valores são normalizados antes de formar query keys;
- CUSTOM exige startDate e endDate válidos;
- startDate não pode ser posterior a endDate;
- troca de período preserva apenas filtros compatíveis;
- filtros sem capability ficam desabilitados;
- tooltip e texto auxiliar explicam o motivo;
- nenhum filtro parcial é aplicado apenas no navegador sobre agregados;
- alterações rápidas devem ser coalescidas antes de novas queries.

Modelo futuro de capability:

| Filtro | Estado | Motivo |
| --- | --- | --- |
| período | supported | contrato comum |
| unidade | partial | indisponível em alguns domínios |
| professor | unavailable | sem filtro BI canônico |
| categoria | unavailable | categoria de turma não canônica |
| modalidade | unavailable | apenas dimensão de saída |
| forma de pagamento | unavailable | apenas dimensão de saída |
| status financeiro | unavailable | sem filtro BI público |

## 10. Query keys e cache

### 10.1 Reuso de chaves

Enquanto consumir endpoints existentes, a V2 deve reutilizar biQueryKeys. Isso permite compartilhar cache com as telas BI e evita chamadas duplicadas.

Uma raiz exclusiva executive-dashboard-v2 só será necessária para um endpoint agregado novo.

Formato futuro possível:

    [executive-dashboard-v2, snapshot, filtros-normalizados, contractVersion]

### 10.2 Política inicial

- capabilities: staleTime alvo de 30 minutos;
- contratos BI existentes: preservar inicialmente staleTime de cinco minutos;
- gcTime explícito alvo de 15 minutos na feature futura;
- retry máximo igual a um para leitura;
- refetchOnWindowFocus desabilitado para evitar rajadas inesperadas;
- keepPreviousData durante troca de filtros;
- dados anteriores podem permanecer visíveis com indicador “Atualizando”;
- cache nunca transforma unavailable em zero.

Valores finais dependem de medição de produção e não são ativados nesta Sprint.

### 10.3 Atualização manual

O botão de atualização:

- invalida somente queries habilitadas;
- informa progresso;
- impede múltiplos disparos simultâneos;
- preserva dados anteriores durante refetch;
- não executa mutações de domínio.

## 11. Atualização em tempo real

Não haverá polling contínuo por padrão.

O uso futuro de Socket.IO seguirá estas regras:

- somente eventos já autorizados e documentados;
- mapeamento explícito entre evento e query key;
- invalidação, nunca alteração direta do agregado;
- debounce ou coalescimento de eventos repetidos;
- nenhuma conexão adicional por widget;
- unsubscribe no unmount;
- pausa ou redução quando a aba não estiver visível;
- fallback seguro para atualização manual.

Eventos financeiros já observados no V1 podem invalidar apenas executive e financial, após validação em Sprint própria:

- financeiro:cobranca-atualizada;
- financeiro:pagamento-atualizado;
- dashboard:financeiro-atualizado.

Não se presume a existência de eventos confiáveis para alunos, turmas, quadras ou campeonatos.

## 12. Performance

### 12.1 Estratégias

- Lazy loading da rota futura.
- Lazy loading dos blocos de gráficos abaixo da dobra.
- Suspense com skeleton de dimensões estáveis.
- Recharts permanece no chunk vendor-charts já configurado.
- useMemo apenas para adapters, séries e cálculos relevantes.
- React.memo para cards e linhas com props estáveis.
- useCallback para ações repassadas a componentes memoizados.
- Consultas secundárias habilitadas por visibilidade.
- Paginação para rankings e tabelas.
- Virtualização somente quando volume real justificar.
- Evitar contextos globais que rerenderizem toda a grade.
- Manter filtros em um objeto normalizado e estável.

### 12.2 Paginação e virtualização

Não existe hoje uma biblioteca dedicada de virtualização no package.json.

Ordem de decisão:

1. limitar e paginar no backend;
2. usar paginação ou “ver mais” no frontend;
3. usar content-visibility para conteúdo secundário;
4. adicionar virtualização apenas com medição e aprovação de dependência.

Listas com até 50 itens não devem receber virtualização automaticamente.

### 12.3 Budgets de homologação

São metas futuras, não resultados medidos nesta Sprint:

| Métrica | Budget alvo |
| --- | --- |
| LCP p75 | até 2,5 s |
| INP p75 | até 200 ms |
| CLS p75 | até 0,10 |
| resposta visual após filtro em cache | até 250 ms |
| dados críticos sem cache no ambiente de referência | até 1,5 s p95 |
| requests BI simultâneos na primeira dobra | no máximo 3 |
| chunk próprio inicial da feature, gzip, excluindo vendors compartilhados | até 200 KB |
| chunk individual de widget lazy, gzip | até 60 KB |
| revalidações por domínio após rajada de eventos | no máximo 1 a cada 5 s |

Qualquer violação exige medição, justificativa e plano antes da promoção da rota.

## 13. Responsividade

Comportamento planejado:

- mobile: uma coluna e filtros em Sheet;
- sm: duas colunas para KPIs quando houver largura;
- lg: seções comparativas em duas colunas;
- xl: até quatro KPIs por linha;
- gráficos com altura reservada para evitar CLS;
- tabelas com scroll horizontal e alternativa resumida;
- rankings longos com paginação;
- AppShell, sidebar desktop, menu móvel e bottom navigation continuam sendo reutilizados.

O menu inferior móvel atual não possui destinos BI. A rota V2 poderá fornecer navItems próprios em Sprint futura, sem alterar a navegação V1.

## 14. Acessibilidade

Requisitos:

- ordem de heading consistente;
- landmark main e seções nomeadas;
- filtros com label associado;
- foco visível e navegação completa por teclado;
- alvos de toque com pelo menos 44 por 44 pixels;
- status loading, error e atualização anunciados por região apropriada;
- gráficos acompanhados de resumo textual ou tabela acessível;
- tendência nunca comunicada apenas por cor;
- contraste mínimo compatível com WCAG AA;
- tooltips não podem ser a única fonte de informação;
- suporte a prefers-reduced-motion;
- valores monetários e percentuais com leitura clara em pt-BR.

## 15. Autorização e privacidade

- A rota futura será exclusiva de admin e coordenador.
- ProtectedRoute controla a experiência, mas não é barreira de segurança suficiente.
- Todos os endpoints devem manter middleware backend de autenticação e autorização.
- Nenhuma query deve ser habilitada antes da resolução da sessão.
- 401 limpa a sessão conforme o cliente atual.
- 403 apresenta acesso negado sem revelar dados.
- O dashboard usa agregados; nomes, documentos, contatos e payloads pessoais não devem aparecer.
- Logs e eventos de observabilidade não devem registrar filtros sensíveis ou respostas completas.

## 16. Erros, indisponibilidade e observabilidade

### 16.1 Estados

Cada widget diferencia:

- loading: consulta ainda sem valor;
- refreshing: valor anterior visível durante revalidação;
- error: falha inesperada com retry local;
- empty: consulta válida sem itens;
- unavailable: fonte ou capability ausente;
- stale: dado válido, porém além da janela de frescor.

Empty, unavailable e zero são estados diferentes.

### 16.2 Isolamento

- Um erro em campeonatos não remove KPIs financeiros.
- Error boundaries ficam por região lazy.
- Retry atua apenas na query afetada.
- Erros de contrato desconhecido bloqueiam o widget afetado.
- Uma falha no endpoint futuro agregado deve permitir fallback planejado apenas se a paridade estiver comprovada.

### 16.3 Observabilidade futura

Sem alterar a observabilidade nesta Sprint, a implementação deverá prever:

- duração por query e por adapter;
- cache hit e cache miss;
- versão de contrato;
- generatedAt e idade do dado;
- quantidade de widgets loading, unavailable e error;
- tempo até primeira dobra utilizável;
- ação de atualização manual;
- falhas de lazy chunk;
- correlation ou request ID quando fornecido pelo backend.

Os registros devem ser estruturados, sem PII e sem valores financeiros completos quando não necessários.

## 17. Rollout e rollback

### Fase 0 — planejamento

Somente documentação. Estado desta Sprint.

### Fase 1 — fundação isolada

Criar tipos, adapters, estados, testes e componentes sem rota pública.

### Fase 2 — rota aditiva interna

Criar /admin/dashboard-executivo-v2, protegida e fora do menu padrão.

### Fase 3 — paridade em sombra

Comparar resultados V2 com BI e V1 em ambiente controlado, sem exibir diferenças como verdade.

### Fase 4 — piloto administrativo

Liberar por flag para usuários admin selecionados. Coordenadores permanecem no V1.

### Fase 5 — piloto de coordenação

Ampliar após performance, acessibilidade, segurança e paridade aprovadas.

### Fase 6 — decisão de navegação

Somente aprovação formal poderá tornar a V2 o destino preferencial. /dashboard e /admin/bi/* permanecem compatíveis.

### Rollback

O rollback consiste em desabilitar a flag ou remover o acesso à rota aditiva. Como a V2 não modifica o V1, o retorno não exige rollback de migration, contrato ou dados.

## 18. Decisões pendentes

- Definição canônica de lucro.
- Definição canônica de fluxo de caixa e saldo disponível.
- Origem e escopo da lanchonete.
- Critério de ranking de professores.
- Modelo, horizonte e confiança da previsão financeira.
- Suporte backend aos filtros adicionais.
- Necessidade real do endpoint agregado.
- Estratégia de feature flag existente ou a ser criada.
- Baseline de volume para paginação e virtualização.
- Orçamento final validado em dispositivo e rede de referência.

## 19. Critérios arquiteturais para iniciar implementação

A implementação só deve começar quando:

- este contrato e o mapa de componentes forem aprovados;
- as lacunas de KPI estiverem classificadas como supported ou unavailable;
- nenhuma fórmula nova estiver escondida no frontend;
- a rota aditiva estiver aprovada;
- os papéis autorizados estiverem confirmados;
- contratos e versões existentes estiverem cobertos por fixtures;
- budgets e ambiente de medição estiverem definidos;
- estratégia de rollback estiver aceita.

Até lá, o Dashboard Executivo V2.1 permanece um projeto documentado, sem alteração funcional.
