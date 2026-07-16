# Dashboard Executivo Inteligente — J12 Sports V2.1

## 1. Status do documento

- Tipo: planejamento funcional e de experiência.
- Sprint: V2.1 — Dashboard Executivo Inteligente.
- Estado: arquitetura proposta; nenhuma ativação em runtime.
- Público-alvo: administração e coordenação da J12 Sports.
- Compatibilidade: aditiva, com preservação integral da versão 1.0.

Este documento especifica o futuro Dashboard Executivo Inteligente da plataforma J12 Sports V2. Ele não autoriza alteração de regra de negócio, contrato, endpoint, migration histórica, Browser E2E, Banco Inter, Pix ou dashboard atual.

Os componentes React citados aqui são somente especificados nesta Sprint. Eles não são conectados, registrados em rota, ativados por navegação nem renderizados pela aplicação durante a V2.1, pois o artefato é de planejamento e os gates autorizados não incluem build nem execução completa do frontend.

## 2. Visão

O Dashboard Executivo V2 será uma superfície administrativa de leitura que reúne crescimento, financeiro, operação esportiva, ocupação, campeonatos e alertas em uma única visão. Sua função é reduzir o tempo necessário para perceber tendências, riscos e prioridades, sem transformar o dashboard em uma segunda tela operacional de cada domínio.

O painel deverá:

- responder rapidamente às perguntas executivas mais frequentes;
- reutilizar APIs administrativas de BI já existentes sempre que a semântica for suficiente;
- preservar a origem, a unidade e a disponibilidade de cada métrica;
- diferenciar valor real, comparação, estimativa e informação indisponível;
- permitir aprofundamento por links para os módulos responsáveis;
- operar com privilégios administrativos já existentes;
- manter comportamento previsível em desktop, tablet e celular.

## 3. Objetivos

1. Consolidar KPIs executivos confiáveis sem duplicar regras de cálculo no frontend.
2. Exibir receita, inadimplência, alunos, turmas, quadras e campeonatos com filtros coerentes.
3. Apresentar alertas e insights derivados de dados agregados, sem expor PII.
4. Criar uma hierarquia visual clara entre resultado, tendência, causa provável e ação de aprofundamento.
5. Preparar uma implantação futura aditiva, reversível e observável.
6. Tornar explícitas as métricas que ainda não possuem fonte canônica.

## 4. Não objetivos

Não fazem parte desta Sprint:

- substituir ou modificar a rota atual `/dashboard`;
- registrar uma nova rota React;
- conectar componentes a APIs;
- criar ou alterar endpoints;
- alterar contratos `21.x` do BI;
- criar migrations ou alterar migrations históricas;
- definir novas regras financeiras, de matrícula, retenção ou ranking;
- consultar saldo do Banco Inter ou qualquer ambiente externo;
- criar módulo de lanchonete;
- executar ações operacionais diretamente nos cards;
- implementar previsão estatística;
- ativar atualização em tempo real;
- executar Build, Frontend completo ou Browser E2E.

## 5. Compatibilidade com a versão 1.0

A evolução deverá seguir um modelo estritamente aditivo:

- `/dashboard` continua com o comportamento atual;
- nenhum componente atual é renomeado, removido ou reutilizado de forma incompatível;
- nenhuma resposta existente recebe campo obrigatório novo;
- endpoints `GET /api/admin/bi/*` mantêm seus contratos e versões atuais;
- eventuais capacidades ausentes são atendidas por endpoints novos e versionados;
- permissões continuam baseadas em `requireAuth` e `canManageSystem`;
- links de aprofundamento apontam para rotas já existentes, sem assumir mudanças nelas;
- ativação futura ocorre atrás de feature flag e rota administrativa nova;
- rollback da experiência V2 consiste em desativar a flag, sem tocar na V1.

Rota candidata para uma fase futura: `/admin/dashboard-executivo-v2`. O nome final deverá ser validado antes da implementação. A rota candidata não é criada nesta Sprint.

## 6. Princípios de confiança dos dados

1. O frontend não recalcula regras de domínio a partir de listas completas.
2. Agregados devem vir de services/repositories read-only do BI.
3. `0` significa valor medido igual a zero; ausência de fonte significa `available: false`.
4. Comparações sem base anterior não são apresentadas como `0%`.
5. Saldo operacional não é rotulado como saldo bancário disponível.
6. Turma ativa não é rotulada como aula realizada.
7. Status atual de aluno não é usado para inventar cancelamento, churn ou retenção histórica.
8. Receita por categoria só é exibida quando a classificação financeira for canônica.
9. Rankings devem declarar a métrica de ordenação e preservar um identificador estável.
10. Datas usam o timezone canônico `America/Sao_Paulo` e intervalos inclusivos definidos pelo BI.

## 7. Auditoria dos módulos existentes

### 7.1 Dashboard

Fontes e superfícies existentes:

- rota frontend `/dashboard`;
- `GET /api/dashboard/birthdays`;
- stores de alunos, turmas, professores, financeiro e aulas experimentais.

O dashboard atual calcula vários indicadores no cliente. Entre eles, retenção é aproximada por alunos ativos divididos pelo total, ocupação da arena usa denominadores fixos de slots, aulas do dia são derivadas de templates semanais de turma e novos alunos usam datas do cadastro legado. Esses cálculos são úteis para a experiência atual, mas não possuem semântica suficiente para se tornarem KPIs oficiais da V2.

Decisão: preservar o dashboard atual e não reutilizar suas fórmulas. O card de aniversários pode continuar consumindo o endpoint existente quando fizer parte da composição futura.

### 7.2 BI

Endpoints administrativos reutilizáveis:

- `GET /api/admin/bi/foundation`;
- `GET /api/admin/bi/executive`;
- `GET /api/admin/bi/financial`;
- `GET /api/admin/bi/students`;
- `GET /api/admin/bi/classes`;
- `GET /api/admin/bi/championships`;
- `GET /api/admin/bi/courts`;
- `GET /api/admin/bi/delinquency`;
- `GET /api/admin/bi/insights`;
- `GET /api/admin/bi/exports/:report/:format`.

Todos são administrativos, read-only e protegidos por autenticação e permissão de gestão. Os filtros compartilhados atuais são `period`, `startDate`, `endDate` e `unitId`. Os períodos suportados incluem hoje, últimos 7 ou 30 dias, mês atual/anterior, trimestre atual, ano atual e intervalo customizado.

Lacunas:

- não há filtro compartilhado por professor, categoria, modalidade, forma de pagamento ou status financeiro;
- `insights` não agrega professores, notificações, campeonatos ou lanchonete;
- múltiplas chamadas seriam necessárias para montar todas as faixas de receita simultaneamente;
- não existe um contrato agregador específico do Dashboard Executivo V2.

### 7.3 Financeiro

Fontes principais:

- `j12_financeiro_cobrancas` no BI;
- `GET /api/admin/bi/executive`;
- `GET /api/admin/bi/financial`;
- `GET /api/admin/bi/delinquency`;
- `GET /api/admin/financeiro/relatorios/financeiro`;
- `GET /api/admin/financeiro/relatorios/inadimplencia`;
- rotas legadas sob `/api/financeiro`.

KPIs reaproveitáveis:

- receita recebida, prevista, pendente e vencida;
- despesas pagas reconhecidas pelo BI financeiro;
- ticket médio;
- inadimplência, aging e recuperação;
- evolução mensal de receita;
- composição por categoria, modalidade, unidade e forma de pagamento.

Lacunas e riscos:

- o relatório financeiro chama `receitas - despesas` de `saldo`, mas esse número é resultado do período, não saldo disponível em conta;
- o BI usa cobranças classificadas como despesa, enquanto a operação legada também possui `j12_financeiro_despesas`; lucro não pode ser homologado até a fonte canônica de despesas ser reconciliada;
- a dimensão de professor do relatório liga cobrança e turma pelo nome da turma, o que pode multiplicar valores quando nomes não forem únicos;
- fluxo de caixa existente é mensal e precisa de definição executiva antes de ser usado em outros recortes;
- previsão financeira estatística não existe;
- nenhuma consulta ao Banco Inter deve ser usada para preencher saldo disponível.

### 7.4 Alunos

Fontes principais:

- `people`;
- `person_profiles`;
- `enrollments`;
- `enrollment_class_links`;
- `j12_turmas`;
- `GET /api/admin/bi/students`;
- `GET /api/alunos` para operação, não para agregação executiva.

KPIs reaproveitáveis:

- alunos ativos como snapshot;
- matrículas ativas como snapshot;
- novos alunos e novas matrículas por confirmação;
- evolução de entradas;
- distribuição por modalidade, unidade e faixa etária.

Lacunas:

- não existe timestamp canônico de cancelamento;
- não há histórico suficiente para cancelamentos, saídas, churn, retenção, crescimento líquido ou permanência média;
- `end_date` não deve ser tratado como evento de cancelamento;
- status do cadastro legado não substitui histórico de matrícula.

Essas métricas devem permanecer indisponíveis até que uma evolução de domínio aditiva seja aprovada em Sprint própria.

### 7.5 Professores

Fontes e endpoints existentes:

- `j12_professores`;
- `GET /api/professores`;
- `GET /api/professor/me/dashboard`;
- `GET /api/professor/me/agenda`;
- `GET /api/professor/me/turmas`;
- `GET /api/professor/me/presencas`;
- tabela agregada de turmas em `GET /api/admin/bi/classes`;
- dimensão de receita por professor no relatório financeiro.

O portal do professor é autoescopado e não representa um ranking administrativo. O BI de turmas expõe `professorName` por turma, mas não fornece um agregado por professor nem preserva `professorId` no DTO público. A dimensão financeira por professor tem risco de associação por nome de turma.

Lacunas:

- não existe ranking canônico de professores;
- não está definido se o ranking mede receita, aulas, ocupação, frequência, retenção ou avaliação;
- não há score executivo homologado;
- nomes não são identificadores estáveis.

Decisão: especificar `ProfessorRankingCard` em estado indisponível. Uma implementação futura deverá criar endpoint aditivo com `professorId`, métricas independentes e regra de ordenação explícita. Um score composto só poderá existir após aprovação formal da regra.

### 7.6 Agenda e aulas

Endpoints administrativos existentes:

- `GET /api/admin/agenda/students/:studentPersonId/:studentProfileId/summary`;
- `GET /api/admin/agenda/enrollments/:enrollmentId/summary`;
- `GET /api/admin/agenda/classes/:classId/schedules`;
- operações de validação, reagendamento e recorrência sob `/api/admin/agenda`.

O portal do professor materializa uma visão diária/semanal a partir de horários persistidos, recorrências e sobreposições de status. As APIs administrativas atuais são pontuais e não fornecem analytics globais por período.

Lacunas:

- `activeClasses` do BI mede turmas ativas, não ocorrências de aula;
- não há total administrativo canônico de aulas planejadas, concluídas e canceladas no período;
- recorrências, exceções, reagendamentos e overlays precisam ser deduplicados;
- contagem derivada apenas dos dias da semana superestima ou subestima a operação real.

Decisão: quantidade de aulas fica indisponível no contrato inicial do dashboard até existir um agregado read-only próprio de Agenda.

### 7.7 Quadras

Fontes principais:

- `j12_quadras`;
- `j12_quadra_reservas`;
- `GET /api/admin/bi/courts`;
- rotas operacionais sob `/api/admin/quadras`.

KPIs reaproveitáveis:

- horas de capacidade;
- horas ocupadas únicas;
- taxa de ocupação;
- cancelamentos;
- rankings por quadra, unidade, dia e horário.

O BI já une intervalos sobrepostos por quadra e recorta reservas ao período. Receita de locação e ticket médio permanecem indisponíveis porque não existe, na fonte auditada, um par comprovado de valor efetivamente recebido e timestamp de pagamento.

Decisão: usar o BI de quadras para ocupação. Não derivar receita de `final_value`, nem chamar um ranking por horário de heatmap até existir uma matriz real com denominador por célula.

### 7.8 Campeonatos

Fontes principais:

- `j12_campeonatos`;
- `j12_campeonato_inscricoes`;
- `j12_campeonato_inscricao_atletas`;
- `j12_campeonato_jogos`;
- `GET /api/admin/bi/championships`;
- rotas operacionais sob `/api/admin/campeonatos`;
- portal público sob `/api/public/campeonatos`.

KPIs reaproveitáveis:

- campeonatos ativos e realizados;
- inscrições confirmadas;
- equipes e participantes;
- partidas concluídas e pendentes;
- distribuição por categoria e ranking por competição.

Receita de inscrição permanece indisponível porque as tabelas auditadas não possuem taxa, cobrança e liquidação canônicas.

### 7.9 Lanchonete

Não foi localizado domínio, rota, tabela, store ou contrato canônico de lanchonete, cantina, vendas ou estoque. O texto genérico de venda avulsa no financeiro não prova origem de lanchonete.

Lacunas:

- não existe venda canônica;
- não existe item, quantidade, custo, margem ou pagamento canônico;
- não há receita separável de forma confiável;
- não há permissão nem contrato de leitura definidos.

Decisão: `snackBarRevenue` deve ser retornado ou modelado como indisponível com motivo `NO_CANONICAL_SNACK_BAR_SOURCE`. Não usar busca textual em descrição ou categoria financeira. O módulo deverá ser criado em Sprint própria antes de integrar o dashboard.

### 7.10 Notificações

Endpoints existentes, com aliases `/api/notifications` e `/api/notificacoes`:

- `GET /`;
- `GET /unread-count`;
- `GET /history`;
- `GET /preferences`;
- operações de leitura e preferências;
- operações administrativas de fila para eventos de Agenda.

Fontes principais:

- `agenda_notifications`;
- `agenda_notification_queue`;
- `agenda_notification_events`;
- `agenda_notification_preferences`;
- `agenda_notification_audit_logs`.

As leituras são autoescopadas por destinatário; um administrador pode consultar um destinatário explícito. O contador não representa o total da plataforma. O evento Socket.IO `nova_notificacao` é útil para invalidar cache da central do usuário, mas não é um KPI global.

Lacunas:

- não há agregado executivo de entregas, falhas, retries ou não lidas;
- não há integração de notificações com `GET /api/admin/bi/insights`;
- qualquer agregado futuro deve excluir PII e respeitar o escopo administrativo.

## 8. Cobertura dos KPIs desejados

| KPI | Estado planejado | Fonte preferencial | Observação |
| --- | --- | --- | --- |
| Receita do dia | disponível | `/api/admin/bi/financial?period=TODAY` | Receita recebida canônica |
| Receita do mês | disponível | `/api/admin/bi/financial?period=CURRENT_MONTH` | Receita recebida canônica |
| Receita anual | disponível | `/api/admin/bi/financial?period=CURRENT_YEAR` | Ano corrente, não últimos 12 meses |
| Lucro | indisponível | nenhuma homologada | Reconciliar despesas antes de calcular |
| Fluxo de caixa | parcial | relatório financeiro | Definir granularidade e corrigir riscos de fonte/join |
| Saldo disponível | indisponível | nenhuma | Não confundir com resultado do período ou saldo bancário |
| Inadimplência | disponível | `/api/admin/bi/delinquency` | Valor, taxa, aging e recuperação |
| Novos alunos | disponível | `/api/admin/bi/students` | Primeira confirmação canônica |
| Cancelamentos | indisponível | nenhuma | Falta timestamp/histórico canônico |
| Retenção | indisponível | nenhuma | Falta snapshot/histórico canônico |
| Ticket médio | disponível | `/api/admin/bi/financial` | Indisponível quando não há pagantes |
| Ocupação das quadras | disponível | `/api/admin/bi/courts` | Capacidade versus minutos únicos |
| Quantidade de aulas | indisponível | nenhuma agregada | Turma ativa não equivale a aula |
| Quantidade de campeonatos | disponível | `/api/admin/bi/championships` | Separar ativos e realizados |
| Receita da lanchonete | indisponível | nenhuma | Módulo inexistente |
| Ranking de modalidades | disponível após escolha semântica | students ou financial | Base de alunos e receita são rankings distintos |
| Ranking de professores | indisponível | nenhuma homologada | Exige endpoint e critério aditivos |

## 9. Hierarquia visual

### 9.1 Nível 1 — contexto e controle

Cabeçalho compacto contendo:

- título e identificação de ambiente;
- horário da última atualização;
- indicador de dados atuais, desatualizados ou parciais;
- filtros globais aplicáveis;
- ação de atualização manual;
- link para metodologia dos KPIs.

### 9.2 Nível 2 — KPIs executivos

Primeira dobra com no máximo seis indicadores prioritários:

1. receita recebida;
2. inadimplência;
3. alunos ativos;
4. novos alunos;
5. ocupação das quadras;
6. campeonatos ativos.

Cada card apresenta valor, unidade, comparação, período, disponibilidade e link de aprofundamento. Cards indisponíveis não ocupam o mesmo destaque visual de alertas críticos.

### 9.3 Nível 3 — tendências e composição

- evolução de receita e despesas;
- crescimento de alunos;
- composição de receita;
- aging da inadimplência;
- ocupação por unidade/quadra;
- modalidades por base e por receita.

### 9.4 Nível 4 — inteligência e ação

- alertas executivos priorizados;
- insights explicáveis;
- ranking de professores quando homologado;
- previsão financeira quando homologada;
- atalhos para módulos operacionais.

## 10. Mapa de widgets e cards

| Componente especificado | Responsabilidade | Estado inicial |
| --- | --- | --- |
| `ExecutiveDashboard` | composição da página, filtros e estados globais | somente especificado |
| `ExecutiveKPICard` | valor, unidade, comparação e disponibilidade | planejado |
| `RevenueCard` | receita por período e tendência | integrável com BI existente |
| `CashFlowCard` | entradas, saídas e resultado por intervalo | parcial |
| `StudentGrowthCard` | ativos, entradas e evolução | integrável com BI existente |
| `DelinquencyCard` | valor, taxa, aging e recuperação | integrável com BI existente |
| `OccupancyCard` | capacidade e ocupação de quadras | integrável com BI existente |
| `ProfessorRankingCard` | ranking por métrica explícita | indisponível |
| `FinancialForecastCard` | projeção e intervalo de confiança | indisponível |
| `ExecutiveAlertsCard` | alertas agregados e links de ação | parcial com BI insights |
| `ExecutiveInsightsCard` | explicações de variações e anomalias | parcial com BI insights |
| `QuickActionsCard` | links para rotas operacionais existentes | planejado |

Nenhum card deve executar mutação diretamente. “Ações rápidas” são navegação, não comandos financeiros ou operacionais.

## 11. Gráficos planejados

### Linha

- evolução de novos alunos;
- comparativo de períodos equivalentes;
- séries com pontos reais e lacunas visíveis.

### Barra

- ranking de modalidades;
- aging da inadimplência;
- campeonatos por categoria;
- ocupação por quadra ou unidade.

### Pizza ou rosca

- composição financeira por categoria ou forma de pagamento;
- limite recomendado de cinco segmentos, agrupando cauda como “Outros” somente com regra explícita.

### Área

- evolução da receita recebida;
- fluxo de caixa apenas após homologação das despesas.

### Gauge

- ocupação consolidada das quadras;
- sempre acompanhado pelo valor textual e pela capacidade usada no denominador.

### Heatmap

- ocupação por dia e faixa horária;
- somente após o backend fornecer matriz real por célula, disponibilidade e ocupação;
- enquanto isso, usar barras/ranking e não rotular agregação simples como heatmap.

### Indicadores comparativos

- valor atual, valor anterior, variação percentual e direção;
- base anterior zero ou inexistente deve aparecer como comparação indisponível.

## 12. Filtros

### 12.1 Filtros já suportados pelo BI

- período;
- data inicial e final;
- unidade.

### 12.2 Filtros desejados que exigem evolução aditiva

- professor;
- categoria;
- modalidade;
- forma de pagamento;
- status financeiro.

Regras:

- não simular filtro no cliente sobre payload já agregado;
- cada widget declara quais filtros aceita;
- filtro não aplicável fica desabilitado com explicação;
- mudança de filtro é atômica para a visão, evitando misturar períodos;
- unidade deve usar identificador canônico, não comparação oportunista por nome;
- professor deve usar `professorId` estável;
- limpar um filtro restaura o escopo administrativo padrão;
- filtros devem ser serializáveis na URL da futura rota para compartilhamento e restauração.

## 13. Estados de interface

Todos os widgets devem implementar os mesmos estados:

- `loading`: skeleton preservando o layout;
- `success`: valor medido e metadados visíveis;
- `empty`: consulta válida sem ocorrências;
- `unavailable`: fonte ou semântica inexistente;
- `partial`: parte do agregado indisponível;
- `stale`: dado mantido em cache após exceder a janela de atualização;
- `error`: falha com retentativa localizada;
- `forbidden`: falta de permissão sem vazamento de informação;
- `invalid-filter`: filtro rejeitado pelo contrato.

Um estado indisponível deve mostrar uma mensagem curta e um código estável, por exemplo:

- `NO_CANONICAL_CANCELLATION_TIMESTAMP`;
- `NO_HISTORICAL_ENROLLMENT_SNAPSHOTS`;
- `NO_CANONICAL_SNACK_BAR_SOURCE`;
- `NO_CANONICAL_PROFESSOR_RANKING`;
- `NO_CANONICAL_LESSON_OCCURRENCE_AGGREGATE`;
- `NO_AVAILABLE_BALANCE_SOURCE`;
- `NO_RECONCILED_PROFIT_SOURCE`.

Não substituir indisponibilidade por zero, traço sem explicação ou dado estimado.

## 14. Responsividade

### Celular

- uma coluna;
- filtros em drawer acessível;
- KPIs prioritários antes dos gráficos;
- gráficos com altura mínima e rolagem horizontal somente quando indispensável;
- tabelas convertidas em listas resumidas;
- ações com área de toque mínima de 44 por 44 pixels.

### Tablet

- grade de dois cards;
- painéis em uma ou duas colunas conforme largura;
- filtros principais visíveis e avançados em drawer.

### Desktop

- grade de até seis KPIs conforme espaço;
- largura máxima para evitar linhas excessivas;
- composição assimétrica para destacar tendências e alertas;
- detalhes sob demanda em drawer ou rota de origem.

O conteúdo não pode depender de hover e deve permanecer utilizável em zoom de 200%.

## 15. Acessibilidade

- estrutura semântica com um `h1` e títulos hierárquicos;
- navegação completa por teclado;
- foco visível e ordem lógica;
- gráficos com resumo textual e tabela acessível opcional;
- cor nunca é o único meio de indicar tendência ou severidade;
- ícones decorativos são ocultados de tecnologia assistiva;
- indicadores usam nomes e unidades pronunciáveis;
- contraste mínimo compatível com WCAG AA;
- animações respeitam `prefers-reduced-motion`;
- atualização automática não desloca foco nem anuncia repetidamente toda a página;
- erros e indisponibilidades são associados ao widget correspondente.

## 16. Atualização e tempo real

O estado canônico continua sendo a API. Eventos Socket.IO existentes, como atualização financeira e nova notificação, podem futuramente invalidar consultas específicas, mas não devem transportar nem substituir o cálculo oficial do KPI.

Estratégia planejada:

1. carregar snapshot consistente por filtros;
2. manter cache por chave de endpoint e filtro;
3. invalidar apenas domínios afetados por evento;
4. refazer a consulta read-only;
5. exibir horário da última confirmação pelo servidor;
6. limitar atualização em background quando a aba estiver oculta.

Quadras, campeonatos, Agenda e alunos ainda não possuem cobertura uniforme de eventos. Portanto, tempo real completo não é requisito para a primeira ativação.

## 17. Rollout aditivo

1. Implementar componentes em diretório novo, sem importá-los pela V1.
2. Adicionar cliente e tipos V2 sem alterar tipos públicos existentes.
3. Criar rota administrativa nova protegida por feature flag.
4. Integrar primeiro apenas KPIs homologados dos endpoints `21.x`.
5. Exibir lacunas como indisponíveis.
6. Adicionar endpoints novos somente quando contratos, fórmulas e testes forem aprovados.
7. Habilitar a rota para equipe interna.
8. Comparar os resultados com as telas de origem.
9. Liberar por unidade ou perfil administrativo.
10. Manter `/dashboard` como fallback durante todo o ciclo V2.

Nenhuma etapa exige exclusão ou redirecionamento da rota atual.

## 18. Plano de implementação em ondas

### Onda 0 — contrato e metodologia

- aprovar nomenclatura dos KPIs;
- decidir diferença entre receita, resultado, lucro e saldo;
- definir ranking de modalidades;
- aprovar códigos de indisponibilidade;
- confirmar escopo de admin e coordenador.

### Onda 1 — fundação visual isolada

- criar componentes React novos;
- criar estados de loading, erro, vazio e indisponível;
- aplicar responsividade e acessibilidade;
- usar fixtures tipadas somente em testes e stories, sem ativação em rota produtiva.

### Onda 2 — integração com BI existente

- integrar executive, financial, students, delinquency, courts e championships;
- reutilizar filtros de período e unidade;
- adicionar cache por consulta;
- validar paridade com as telas administrativas de BI.

### Onda 3 — agregador executivo aditivo

- avaliar endpoint V2 que componha services existentes sem copiar SQL;
- devolver disponibilidade por widget;
- evitar fan-out excessivo no navegador;
- preservar contratos `21.x`.

### Onda 4 — lacunas de baixo risco

- matriz de ocupação para heatmap;
- agregado global de notificações sem PII;
- agregado de ocorrências de aula;
- ranking de professores com métricas separadas.

### Onda 5 — lacunas que exigem decisão de domínio

- cancelamentos e retenção;
- lucro e fluxo de caixa reconciliado;
- saldo disponível;
- previsão financeira;
- lanchonete.

Essas capacidades podem exigir novas migrations aditivas em Sprints futuras. Migrations históricas permanecem imutáveis.

### Onda 6 — ativação controlada

- feature flag;
- validação interna;
- métricas de erro, latência e uso;
- liberação progressiva;
- rollback por desativação da flag.

## 19. Critérios de aceite da implementação futura

### Compatibilidade

- `/dashboard` e seus fluxos continuam inalterados;
- nenhuma API existente muda de rota, payload ou autorização;
- nenhuma migration histórica é editada;
- nenhuma funcionalidade V1 é removida.

### Dados

- cada KPI documenta fórmula, fonte, período, timezone e unidade;
- nenhum KPI indisponível é exibido como zero;
- nenhum agregado é recalculado a partir de listas completas no navegador;
- receita não sofre dupla contagem;
- saldo operacional não é rotulado como bancário;
- rankings possuem identificador e critério estáveis.

### Experiência

- primeira dobra prioriza no máximo seis KPIs;
- filtros não aplicáveis são explicados;
- todos os widgets suportam os estados padronizados;
- celular, tablet e desktop são homologados;
- navegação por teclado e contraste atendem WCAG AA;
- gráficos possuem alternativa textual.

### Performance

- carregamento é incremental por seção;
- consultas duplicadas com a mesma chave são deduplicadas;
- gráficos abaixo da primeira dobra podem usar lazy loading;
- eventos em tempo real invalidam consultas, sem recalcular regras;
- falha de um domínio não bloqueia toda a página.

### Segurança

- somente perfis autorizados acessam a rota;
- payload executivo não expõe PII, credenciais, Pix, txid ou dados bancários;
- filtros são validados no backend;
- links respeitam as permissões das rotas de destino.

## 20. Riscos e mitigação

| Risco | Impacto | Mitigação planejada |
| --- | --- | --- |
| Reutilizar fórmulas heurísticas do dashboard atual | KPI incorreto | Consumir somente agregados homologados |
| Chamar muitos endpoints simultaneamente | latência e carga | agregador V2 aditivo e cache por domínio |
| Misturar filtros com suportes diferentes | painel inconsistente | matriz de aplicabilidade e snapshot por filtro |
| Confundir turma com aula | supercontagem | agregado canônico de ocorrências |
| Inferir cancelamento e retenção | decisão executiva incorreta | estado indisponível até histórico canônico |
| Divergência entre fontes de despesa | lucro incorreto | reconciliação formal antes do KPI |
| Join financeiro por nome de turma | duplicação de receita por professor | vínculo estável por ID e testes de cardinalidade |
| Chamar resultado do período de saldo disponível | interpretação bancária indevida | nomenclatura e código de indisponibilidade |
| Fabricar receita de lanchonete | dado sem origem | manter indisponível e criar domínio próprio |
| Ranking de professor sem regra | impacto humano injusto | métricas transparentes, sem score implícito |
| Atualização em tempo real incompleta | dados com idades diferentes | timestamp por widget e refetch controlado |
| Vazamento de PII em alertas | risco de segurança | somente agregados e links autorizados |
| Heatmap sem capacidade por célula | visual enganoso | exigir matriz real ou usar gráfico de barras |
| Ativação prematura | regressão na V1 | rota nova, feature flag e fallback permanente |

## 21. Decisão final desta Sprint

A plataforma já possui uma base de BI suficiente para planejar e, em Sprint futura, iniciar uma primeira versão do Dashboard Executivo com receita recebida, ticket médio, inadimplência, alunos, ocupação de quadras e campeonatos.

Lucro, saldo disponível, cancelamentos, retenção, quantidade real de aulas, receita da lanchonete, previsão financeira e ranking de professores ainda não possuem contrato ou fonte canônica suficientes. Esses itens devem aparecer como indisponíveis até que suas dependências sejam resolvidas de forma aditiva.

Nesta Sprint V2.1, o resultado é exclusivamente documental: arquitetura funcional definida, componentes especificados e rollout planejado. Nenhum componente foi conectado ou ativado; nenhum código, endpoint, contrato, migration, rota ou funcionalidade existente foi alterado.
