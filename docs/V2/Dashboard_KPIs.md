# Dashboard Executivo V2.1 — Catálogo de KPIs

## 1. Princípios do catálogo

Este catálogo formaliza os 17 KPIs listados para o Dashboard Executivo V2.1. Ele não cria regra de negócio nem transforma ausência de dado em zero.

Status usados:

- **Direto**: o KPI já é entregue por endpoint existente com semântica utilizável;
- **Componível**: o KPI pode ser calculado deterministicamente a partir de campos existentes, sem nova consulta ao banco;
- **Indisponível**: falta dado, histórico ou definição canônica; não deve ser estimado.

Regras obrigatórias:

- `available: false` e `value: null` devem continuar indisponíveis na interface;
- nenhum KPI indisponível pode ser estimado, interpolado ou preenchido com zero;
- saldo, caixa e receita não podem ser obtidos por acesso direto ao Banco Inter ou ao Pix;
- filtros aplicados devem acompanhar o valor exibido;
- todos os valores monetários usam BRL e datas usam `America/Sao_Paulo`;
- rankings precisam declarar a métrica ordenadora e o desempate.

## 2. Visão consolidada

| # | KPI | Status conservador | Fonte prioritária |
| --- | --- | --- | --- |
| 1 | Receita do dia | Direto | `GET /api/admin/bi/financial?period=TODAY` |
| 2 | Receita do mês | Direto | `GET /api/admin/bi/financial?period=CURRENT_MONTH` |
| 3 | Receita anual | Direto | `GET /api/admin/bi/financial?period=CURRENT_YEAR` |
| 4 | Lucro | Componível | `financial.kpis.receivedRevenue - financial.kpis.expenses` |
| 5 | Fluxo de caixa | Indisponível | Não há série completa de entradas e saídas. |
| 6 | Saldo disponível | Indisponível | Não há ledger/saldo canônico no BI. |
| 7 | Inadimplência | Direto | `GET /api/admin/bi/delinquency` |
| 8 | Novos alunos | Direto | `GET /api/admin/bi/students` |
| 9 | Cancelamentos | Indisponível | Sem timestamp/evento canônico de cancelamento. |
| 10 | Retenção | Indisponível | Sem snapshots/coortes históricas canônicas. |
| 11 | Ticket médio | Direto | `GET /api/admin/bi/financial` |
| 12 | Ocupação das quadras | Direto | `GET /api/admin/bi/courts` |
| 13 | Quantidade de aulas | Indisponível | Turmas ativas não equivalem a aulas/sessões. |
| 14 | Quantidade de campeonatos | Componível | `championships.rankings.championships.length` |
| 15 | Receita da lanchonete | Indisponível | Não existe fonte backend canônica localizada. |
| 16 | Ranking de modalidades | Componível | BI de alunos, financeiro ou turmas, conforme métrica aprovada. |
| 17 | Ranking de professores | Componível | Agregação de `classes.table`, com escopo limitado. |

Classificação conservadora: 7 diretos, 4 componíveis e 6 indisponíveis.

## 3. KPIs financeiros

### 3.1 Receita do dia

- **Status:** Direto.
- **Semântica:** soma dos recebimentos de receita, excluídas despesas, cuja data efetiva de pagamento pertence ao dia corrente em `America/Sao_Paulo`.
- **Fórmula:** `SUM(valor_final ou valor)` para cobranças ativas, pagas, não classificadas como despesa, com data efetiva no período.
- **Endpoint:** `/api/admin/bi/financial?period=TODAY`.
- **Campo:** `data.kpis.receivedRevenue.value`.
- **Fonte:** `j12_financeiro_cobrancas`.
- **Ressalva:** representa recebimento realizado, não faturamento por competência.
- **Critério de aceite:** reconciliar uma amostra do dia com cobranças pagas canônicas; timezone, exclusão de despesas e filtro de unidade devem estar comprovados.

### 3.2 Receita do mês

- **Status:** Direto.
- **Semântica:** mesma regra de receita realizada, do primeiro dia do mês corrente até a data de referência.
- **Endpoint:** `/api/admin/bi/financial?period=CURRENT_MONTH`.
- **Campo:** `data.kpis.receivedRevenue.value`.
- **Critério de aceite:** valor deve ser igual à soma diária do mesmo intervalo e respeitar unidade e data efetiva de pagamento.

### 3.3 Receita anual

- **Status:** Direto.
- **Semântica:** mesma regra de receita realizada, de 1º de janeiro até a data de referência.
- **Endpoint:** `/api/admin/bi/financial?period=CURRENT_YEAR`.
- **Campo:** `data.kpis.receivedRevenue.value`.
- **Critério de aceite:** valor deve fechar com a evolução mensal do ano, consideradas as mesmas regras e eventuais meses sem movimento.

### 3.4 Lucro

- **Status:** Componível.
- **Nome seguro para a primeira entrega:** `resultado líquido de caixa`.
- **Fórmula proposta:** `receivedRevenue.value - expenses.value`, usando a mesma resposta e o mesmo período.
- **Endpoint:** `/api/admin/bi/financial`.
- **Fonte:** cobranças de receita pagas menos cobranças de despesa pagas.
- **Ressalva crítica:** esse cálculo não é lucro contábil. Não contempla competência, provisões, depreciação, tributos, estoque, custo de mercadoria vendida ou conciliação contábil.
- **Dado necessário para “lucro” formal:** plano de contas, regime de competência, custos, impostos, ajustes e regra aprovada pelo domínio financeiro.
- **Critério de aceite:** a interface deve usar o nome seguro até aprovação contábil; ambos os operandos devem estar disponíveis e ter exatamente os mesmos filtros.

### 3.5 Fluxo de caixa

- **Status:** Indisponível.
- **Estado atual:** o BI financeiro fornece evolução mensal somente da receita recebida. Despesas existem apenas como total do período, sem série temporal completa.
- **Semântica necessária:** entradas, saídas e variação líquida por intervalo; projeções devem ser separadas de realizados.
- **Dados necessários:** data efetiva, categoria e valor de cada entrada/saída; saldo inicial interno; recorrências e vencimentos se houver previsão; estornos e ajustes canônicos.
- **API futura:** seção aditiva e versionada de cash flow, após aprovação funcional e de performance.
- **Critério de aceite:** a soma dos pontos realizados deve reconciliar com os totais do período; previsto e realizado jamais podem ser misturados.
- **Proibição:** não estimar saídas distribuindo o total agregado entre os meses.

### 3.6 Saldo disponível

- **Status:** Indisponível.
- **Estado atual:** não existe saldo bancário, ledger de caixa ou conta interna canônica no BI.
- **Semântica necessária:** definir se o saldo é bancário conciliado, caixa interno, saldo contábil ou disponibilidade após compromissos.
- **Dados necessários:** ledger interno auditável, contas, saldo inicial, lançamentos, estornos, conciliação e timestamp de atualização.
- **Critério de aceite:** valor deve identificar fonte, conta, horário da última conciliação e regra de disponibilidade.
- **Proibição:** não calcular saldo como receita menos despesa histórica e não acessar Banco Inter ou Pix para preencher o card.

### 3.7 Inadimplência

- **Status:** Direto.
- **Fonte prioritária:** `/api/admin/bi/delinquency`.
- **Fórmula canônica proposta para a V2.1:** `overdueValue / eligibleValue * 100`, avaliada na data final do período.
- **Campo:** `data.kpis.delinquencyRate.value`.
- **Apoio:** `overdueObligations`, `overdueValue`, `uniqueDebtors`, aging, recuperação e status.
- **Ressalva crítica:** `/executive` calcula uma razão diferente, `overdueRevenue / expectedRevenue` do período. As duas definições não podem ser combinadas nem comparadas como se fossem idênticas.
- **Critério de aceite:** card, gráfico e alerta devem usar a mesma definição dedicada; a data de referência e a carteira elegível devem estar documentadas.

### 3.8 Ticket médio

- **Status:** Direto.
- **Fórmula atual:** `receivedRevenue / payingStudents`, onde `payingStudents` é a quantidade distinta de alunos com recebimento no período.
- **Endpoint:** `/api/admin/bi/financial`.
- **Campo:** `data.kpis.averageTicket.value`.
- **Indisponibilidade válida:** `NO_PAYING_STUDENTS` quando o denominador é zero.
- **Ressalva:** mede valor recebido por aluno pagante, não preço médio por cobrança ou contrato.
- **Critério de aceite:** denominador, período e unidade devem ser os mesmos da receita; zero pagantes deve resultar em indisponibilidade, não divisão por zero.

## 4. KPIs de alunos

### 4.1 Novos alunos

- **Status:** Direto.
- **Semântica preferencial:** pessoas cuja primeira matrícula confirmada conhecida ocorreu dentro do período.
- **Endpoint:** `/api/admin/bi/students`.
- **Campo:** `data.kpis.newStudents.value`.
- **Apoio:** comparação com período anterior e `evolution[].newStudents`.
- **Fonte:** `enrollments` e `person_profiles`.
- **Ressalva:** o endpoint `/students` verifica ausência de matrícula confirmada anterior e deve ser preferido. O snapshot `/executive` não aplica exatamente a mesma regra.
- **Critério de aceite:** uma pessoa com segunda matrícula não pode voltar a ser contada como novo aluno; duplicidade de perfis deve ser tratada pela identidade canônica.

### 4.2 Cancelamentos

- **Status:** Indisponível.
- **Motivo atual do contrato:** `NO_CANONICAL_CANCELLATION_TIMESTAMP`.
- **Semântica necessária:** evento de cancelamento efetivado no período, separado de exclusão, expiração, transferência e simples mudança de status.
- **Dados necessários:** timestamp, motivo, ator, matrícula afetada, status anterior e reversão quando aplicável.
- **Critério de aceite:** uma transição deve ser contada uma única vez no período correto e permanecer auditável.
- **Proibição:** não usar a quantidade atual de matrículas canceladas como série histórica.

### 4.3 Retenção

- **Status:** Indisponível.
- **Motivo atual do contrato:** `NO_HISTORICAL_ENROLLMENT_SNAPSHOTS`.
- **Semântica proposta:** percentual de uma coorte ativa no início da janela que permanece ativa no fim, com política explícita para pausa, transferência e múltiplas matrículas.
- **Dados necessários:** snapshots históricos ou eventos completos de lifecycle, coorte, datas efetivas e regra de reativação.
- **Critério de aceite:** reproduzir coortes fechadas, sem viés de usar somente o estado corrente; numerador e denominador devem ser auditáveis.
- **Proibição:** não inferir retenção a partir de novos alunos menos cancelamentos incompletos.

## 5. KPIs operacionais

### 5.1 Ocupação das quadras

- **Status:** Direto.
- **Fórmula atual:** `minutos reservados ativos, com intervalos sobrepostos mesclados / minutos disponíveis * 100`.
- **Endpoint:** `/api/admin/bi/courts`.
- **Campo:** `data.kpis.occupancyRate.value`.
- **Apoio:** horas disponíveis, horas reservadas e ranking por quadra/dia/horário/unidade.
- **Fontes:** `j12_quadras` e `j12_quadra_reservas`.
- **Ressalva:** o filtro `unitId` atual compara texto de unidade ou id da quadra e precisa ser homologado antes de um filtro multiunidade confiável.
- **Critério de aceite:** reservas canceladas não ocupam capacidade; sobreposições não duplicam minutos; funcionamento e timezone devem ser validados.

### 5.2 Quantidade de aulas

- **Status:** Indisponível para a semântica solicitada.
- **Estado atual:** `/api/admin/bi/classes` oferece `activeClasses`, que conta turmas ativas no snapshot corrente e ignora as datas do filtro.
- **Ressalva crítica:** aula/sessão realizada ou agendada não é sinônimo de turma cadastrada.
- **Semântica necessária:** escolher entre sessões previstas, realizadas, canceladas ou com presença registrada no período.
- **Dados necessários:** agenda/sessão canônica, data e horário, status, turma, professor, unidade e política de reposição/cancelamento.
- **Critério de aceite:** cada sessão deve ter identidade única; o período precisa ser realmente aplicado; sessões recorrentes não podem ser contadas apenas pela turma-mãe.
- **Alternativa:** se o produto quiser “turmas ativas”, renomear explicitamente o card e usar `classes.kpis.activeClasses`, sem chamá-lo de aulas.

### 5.3 Quantidade de campeonatos

- **Status:** Componível.
- **Fórmula proposta:** quantidade de itens em `data.rankings.championships` para campeonatos não removidos que se sobrepõem ao período.
- **Endpoint:** `/api/admin/bi/championships`.
- **Apoio direto:** `activeChampionships` conta `PUBLISHED`; `completedChampionships` conta `ARCHIVED`.
- **Ressalva:** “total”, “ativo” e “concluído” são três semânticas diferentes. O repository atual não aplica `unitId`.
- **Critério de aceite:** o título do card deve declarar a semântica; a regra de sobreposição de datas e os status incluídos devem ser estáveis.

### 5.4 Receita da lanchonete

- **Status:** Indisponível.
- **Estado atual:** não foi localizada fonte backend canônica de vendas, pedidos ou pagamentos da lanchonete no domínio BI.
- **Dados necessários:** pedido, itens, quantidade, preço, desconto, cancelamento, forma de pagamento, data efetiva, unidade, custo e integração financeira auditável.
- **API futura:** somente após existir domínio e fonte canônicos; não reutilizar genericamente cobranças de alunos sem categoria comprovada.
- **Critério de aceite:** total deve reconciliar com vendas concluídas líquidas de cancelamentos/estornos e usar o mesmo timezone e unidade do painel.

## 6. Rankings

### 6.1 Ranking de modalidades

- **Status:** Componível.
- **Fontes existentes possíveis:**
  - `/students`: alunos ativos por modalidade;
  - `/financial`: receita recebida por modalidade;
  - `/classes`: turmas, capacidade e ocupação por modalidade.
- **Decisão obrigatória:** escolher uma métrica principal. “Melhor modalidade” sem métrica é ambíguo.
- **Fórmulas candidatas:**
  - adesão: `activeStudents por modalidade`;
  - receita: `SUM(receivedRevenue) por modalidade`;
  - ocupação ponderada: `SUM(occupancy) / SUM(validCapacity) * 100`.
- **Ressalva:** as fontes podem ter cobertura e granularidade diferentes. Não combinar receita de uma janela com snapshot corrente de ocupação em uma pontuação opaca.
- **Critério de aceite:** métrica, período, unidade, direção da ordenação e desempate devem estar visíveis; “não informado” deve permanecer identificável.

### 6.2 Ranking de professores

- **Status:** Componível com escopo limitado.
- **Fonte atual:** `data.table` de `/api/admin/bi/classes`, que contém `professorName`, `occupancy`, `capacity`, status e unidade por turma.
- **Fórmula inicial possível:** agrupar turmas ativas por professor e ordenar por ocupação ponderada, `SUM(occupancy) / SUM(validCapacity) * 100`, exibindo também número de turmas e vagas ocupadas.
- **Ressalvas:**
  - o endpoint é snapshot e não aplica período;
  - não mede aulas realizadas, presença, receita, avaliação ou qualidade docente;
  - nomes não devem substituir um identificador canônico de professor em implementação futura;
  - turmas sem capacidade válida devem ficar fora do denominador.
- **Dados necessários para ranking temporal:** professorId, sessões/aulas do período, status e presença; receita exigiria regra financeira separada e aprovada.
- **Critério de aceite:** declarar a métrica como ocupação de turmas, usar identificador estável, tratar empates e não apresentar o resultado como avaliação de desempenho humano.

## 7. Comparações e gráficos

Comparações só são válidas quando:

- atual e anterior têm a mesma duração;
- usam os mesmos filtros e definição;
- o valor anterior está disponível;
- denominador zero é tratado como comparação indisponível;
- séries ausentes não são preenchidas com valores estimados.

Gráficos devem carregar a mesma semântica do card. Por exemplo, a linha de receita deve usar recebimentos realizados; o gauge de inadimplência deve usar a carteira dedicada; heatmap de quadras deve usar horas disponíveis reais.

## 8. Dados adicionais necessários

| Lacuna | Capacidade necessária antes de expor o KPI |
| --- | --- |
| Fluxo de caixa | Série canônica de entradas e saídas, saldo inicial e separação realizado/projetado. |
| Saldo disponível | Ledger interno e conciliação auditável, sem consulta direta ao provedor no dashboard. |
| Cancelamentos | Eventos/timestamps de lifecycle com motivo e reversão. |
| Retenção | Snapshots ou event sourcing suficiente para coortes históricas. |
| Quantidade de aulas | Sessões canônicas por data, status, turma, professor e unidade. |
| Receita da lanchonete | Domínio de pedidos/vendas/pagamentos integrado e auditável. |
| Ranking temporal de professores | Sessões, presença e professorId estável no período. |

Adicionar um endpoint sem essas fontes não torna o KPI disponível.

## 9. Critérios de aceite globais

- Cada card exibe nome, valor, unidade, período, filtros e horário de atualização.
- Valores disponíveis fecham com as fontes canônicas por amostragem e por total.
- Valores indisponíveis continuam `null` e exibem motivo compreensível.
- Receita diária, mensal e anual usa a mesma regra de recebimento.
- Inadimplência usa uma única definição em card, gráfico e insight.
- Resultado líquido de caixa não é rotulado como lucro contábil sem aprovação.
- Turmas ativas nunca são rotuladas como quantidade de aulas.
- Rankings declaram métrica, escopo, ordenação e desempate.
- Unidade e período são efetivamente aplicados, não apenas repetidos no payload.
- Nenhuma consulta nova gera N+1 ou expõe PII.
- Contratos e endpoints V1 permanecem inalterados.
- Nenhum KPI depende de acesso ao Banco Inter ou Pix.
- Browser E2E existente permanece intacto.

