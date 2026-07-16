# Dashboard Executivo V2.1 — Arquitetura de API

## 1. Objetivo e limites

Este documento define como o Dashboard Executivo V2.1 deve consumir o BI existente e quais extensões poderão ser propostas em uma etapa futura. Ele é exclusivamente arquitetural.

Nesta Sprint:

- nenhuma rota foi criada ou alterada;
- nenhum contrato, payload, regra de negócio ou middleware foi alterado;
- nenhuma migration foi criada ou modificada;
- nenhum acesso ao Banco Inter, Pix, VPS ou ambiente externo é necessário;
- os endpoints V1 permanecem a fonte prioritária e compatível.

Qualquer extensão futura deverá ser estritamente aditiva, versionada e protegida pelos mesmos controles administrativos do BI atual.

## 2. Montagem e segurança comuns

O router de BI usa a base `/admin/bi` e é montado pelo servidor em dois aliases equivalentes:

- `/admin/bi/*`;
- `/api/admin/bi/*`.

As dez rotas são `GET` e read-only. Antes de qualquer handler, o router aplica:

1. `requireAuth`, que exige uma sessão válida no header `Authorization: Bearer <token>`;
2. `ensureBiAdminAccess`, que permite `role=admin`, `role=coordenador` ou o legado `perfil=admin`.

Alunos, responsáveis e professores não podem consultar o BI administrativo. A V2.1 não deve relaxar essa autorização nem expor dados pessoais nos agregados.

Referências do código atual:

- `backend/src/domains/bi/presentation/routes/bi-admin.routes.js`;
- `backend/src/server.js`;
- `backend/auth.js`.

## 3. Filtros compartilhados

Os endpoints analíticos normalizam a query com o mesmo contrato:

| Campo | Regra atual |
| --- | --- |
| `period` | Opcional; o padrão é `CURRENT_MONTH`. |
| `startDate` | Data inclusiva no formato `YYYY-MM-DD`; obrigatória para `CUSTOM`. |
| `endDate` | Data inclusiva no formato `YYYY-MM-DD`; obrigatória para `CUSTOM`. |
| `unitId` | Opcional; string ou número normalizado para string, com no máximo 64 caracteres. |
| `dateFrom` | Alias interno aceito para `startDate`, embora não seja anunciado pelo DTO foundation. |
| `dateTo` | Alias interno aceito para `endDate`, embora não seja anunciado pelo DTO foundation. |

Períodos aceitos:

- `TODAY`;
- `LAST_7_DAYS`;
- `LAST_30_DAYS`;
- `CURRENT_MONTH`;
- `PREVIOUS_MONTH`;
- `CURRENT_QUARTER`;
- `CURRENT_YEAR`;
- `CUSTOM`.

O timezone canônico é `America/Sao_Paulo`. Intervalos são inclusivos. Quando existe comparação, o serviço calcula uma janela anterior com a mesma quantidade de dias, imediatamente anterior e sem sobreposição.

Os filtros V2 solicitados de professor, categoria, modalidade, forma de pagamento e status financeiro não fazem parte do contrato atual. Eles não devem ser enviados como se fossem suportados: queries desconhecidas são ignoradas pelos serviços atuais e poderiam produzir um painel visualmente filtrado com números não filtrados.

## 4. Inventário completo dos endpoints existentes

Todos os caminhos abaixo também existem com o prefixo `/api`.

### 4.1 `GET /admin/bi/foundation`

Fluxo:

`BiFoundationController` → `BiFoundationService` → `createBiFoundationDto`

Contrato `21.1`. Não consulta banco. Retorna:

- `capabilities`;
- `filters.applied` e `filters.supported`;
- `supportedPeriods`;
- `timezone`;
- metadados de repository;
- `readOnly: true`.

Não retorna KPIs. É útil para descoberta de capacidades, mas não deve ser a fonte dos cards.

### 4.2 `GET /admin/bi/executive`

Fluxo:

`BiExecutiveController` → `BiExecutiveService` → `MySqlBiExecutiveRepository` → `createBiExecutiveDto`

Contrato `21.2`. Retorna `filters`, `generatedAt`, `readOnly` e os KPIs:

- `activeStudents`;
- `averageTicket`;
- `cancellations`, atualmente indisponível;
- `delinquencyRate`;
- `expectedRevenue`;
- `newStudents`;
- `overdueRevenue`;
- `receivedRevenue`.

Fontes:

- `enrollments`;
- `enrollment_class_links`;
- `j12_turmas`;
- `j12_financeiro_cobrancas`;
- `j12_unidades`.

O repository executa duas consultas agregadas em paralelo, uma de matrículas e outra financeira.

### 4.3 `GET /admin/bi/financial`

Fluxo:

`BiFinancialController` → `BiFinancialService` → `MySqlBiFinancialRepository` → `createBiFinancialDto`

Contrato `21.3`. Retorna os KPIs:

- `averageTicket`;
- `expenses`;
- `expectedRevenue`;
- `overdueRevenue`;
- `pendingRevenue`;
- `receivedRevenue`.

Também retorna:

- `evolution`, série mensal de receita recebida;
- `breakdowns.categories`;
- `breakdowns.modalities`;
- `breakdowns.paymentMethods`;
- `breakdowns.units`;
- comparação com o período anterior;
- tendência por média móvel, comparações mensal e anual quando há dados;
- meta indisponível por ausência de persistência canônica.

Fontes: `j12_financeiro_cobrancas` e `j12_unidades`. O repository usa três consultas agregadas paralelas: KPIs, evolução e decomposições.

### 4.4 `GET /admin/bi/students`

Fluxo:

`BiStudentsController` → `BiStudentsService` → `MySqlBiStudentsRepository` → `createBiStudentsDto`

Contrato `21.4`. Retorna os KPIs disponíveis:

- `activeEnrollments`;
- `activeStudents`;
- `newEnrollments`;
- `newStudents`.

Retorna explicitamente como indisponíveis:

- `averageTenureDays`;
- `cancellations`;
- `churnRate`;
- `netGrowth`;
- `retentionRate`;
- `transfers`.

Também oferece evolução mensal de novos alunos/matrículas e distribuições por faixa etária, modalidade e unidade.

Fontes:

- `enrollments`;
- `person_profiles`;
- `people`;
- `enrollment_class_links`;
- `j12_turmas`.

### 4.5 `GET /admin/bi/classes`

Fluxo:

`BiClassesController` → `BiClassesService` → `MySqlBiClassesRepository` → `createBiClassesDto`

Contrato `21.5`. Retorna:

- `activeClasses`;
- `availableSpots`;
- `enrolledStudents`;
- `fullClasses`;
- `occupancyRate`;
- `totalCapacity`;
- `underutilizedClasses`;
- dimensões por dia da semana, modalidade, horário e unidade;
- tabela por turma com capacidade, ocupação e professor.

A dimensão de categoria é explicitamente indisponível.

Fontes:

- `j12_turmas`;
- `j12_professores`;
- `enrollment_class_links`;
- `enrollments`.

### 4.6 `GET /admin/bi/championships`

Fluxo:

`BiChampionshipsController` → `BiChampionshipsService` → `MySqlBiChampionshipsRepository` → `createBiChampionshipsDto`

Contrato `21.8`. Retorna:

- `activeChampionships`;
- `averageTeams`;
- `completedChampionships`;
- `finishedMatches`;
- `participants`;
- `pendingMatches`;
- `registrations`;
- `teams`;
- rankings por categoria, campeonato, evolução de inscrições e status.

`registrationRevenue` é explicitamente indisponível.

Fontes:

- `j12_campeonatos`;
- `j12_campeonato_inscricoes`;
- `j12_campeonato_inscricao_atletas`;
- `j12_campeonato_jogos`.

### 4.7 `GET /admin/bi/courts`

Fluxo:

`BiCourtsController` → `BiCourtsService` → `MySqlBiCourtsRepository` → `createBiCourtsDto`

Contrato `21.7`. Retorna:

- `availableHours`;
- `cancellations` de reservas;
- `occupancyRate`;
- `reservedHours`;
- rankings por quadra, dia, horário e unidade.

`rentalRevenue` e `ticketAverage` são explicitamente indisponíveis porque não existe valor e timestamp de pagamento canônicos para a análise.

Fontes: `j12_quadras` e `j12_quadra_reservas`.

### 4.8 `GET /admin/bi/delinquency`

Fluxo:

`BiDelinquencyController` → `BiDelinquencyService` → `MySqlBiDelinquencyRepository` → `createBiDelinquencyDto`

Contrato `21.6`. Retorna:

- `delinquencyRate`;
- `overdueObligations`;
- `overdueValue`;
- `recoveredObligations`;
- `recoveredValue`;
- `recoveryRate`;
- `uniqueDebtors`;
- aging da dívida;
- evolução;
- composição por status.

Fontes: `j12_financeiro_cobrancas` e `j12_unidades`.

### 4.9 `GET /admin/bi/insights`

Fluxo:

`BiInsightsController` → `BiInsightsService` → `BiInsightEngine`

Contrato `21.11`. Agrega em paralelo os serviços de financeiro, inadimplência, turmas, alunos e quadras. Retorna `insights`, `thresholds`, `generatedAt` e `readOnly`.

O motor atual pode gerar alertas sobre:

- queda de receita;
- inadimplência acima dos limites;
- turma com ocupação crítica;
- turma subutilizada;
- desaceleração de novos alunos;
- baixa ocupação das quadras.

Os textos são diagnósticos indicativos, não atribuem causa e não executam automações.

### 4.10 `GET /admin/bi/exports/:report/:format`

Fluxo:

`BiExportController` → `BiExportService` → serviço do relatório → exporter

Relatórios aceitos:

- `championships`;
- `classes`;
- `courts`;
- `delinquency`;
- `executive`;
- `financial`;
- `students`.

Formatos aceitos:

- `csv`;
- `pdf`;
- `xlsx`.

O serviço aplica limite padrão de 5.000 linhas e timeout padrão de 15 segundos. A resposta é binária e usa os headers:

- `Content-Type`;
- `Content-Disposition`;
- `Content-Length`;
- `X-BI-Export-Rows`.

Não é endpoint de alimentação direta de widgets.

## 5. Envelope e representação de disponibilidade

Os nove endpoints JSON bem-sucedidos usam:

```json
{
  "success": true,
  "data": {}
}
```

Os DTOs analíticos representam cada métrica, em geral, com:

```json
{
  "available": true,
  "value": 0,
  "unit": "count",
  "reason": null
}
```

Quando o dado não é confiável, o contrato usa `available: false`, `value: null` e um `reason` estável. A V2.1 deve preservar essa semântica. Zero é um valor válido e não pode substituir indisponibilidade.

O endpoint de exportação não usa envelope JSON quando bem-sucedido.

## 6. Erros atuais

| Situação | Status | Contrato observado |
| --- | --- | --- |
| Bearer ausente ou inválido | `401` | Mensagem de token inválido. |
| Perfil sem acesso ao BI | `403` | `{ success: false, error }`. |
| Período ou filtro inválido | `400` | `BI_PERIOD_INVALID` ou `BI_FILTER_INVALID`, com detalhes do campo. |
| Relatório ou formato inválido | `400` | Código específico de exportação. |
| Exportação acima do limite | `413` | `BI_EXPORT_LIMIT_EXCEEDED`. |
| Timeout de exportação | `504` | `BI_EXPORT_TIMEOUT`. |
| Erro não controlado | `5xx` | Encaminhado ao middleware global e correlacionado ao request. |

O frontend deve diferenciar autorização, validação, indisponibilidade de uma métrica e falha técnica. Uma falha de widget não deve derrubar o painel inteiro.

## 7. Divergências e riscos confirmados

### 7.1 Filtros aceitos, mas não aplicados uniformemente

- O repository de turmas usa `unitId`, mas não usa `startDate` nem `endDate`. Seus KPIs são snapshot corrente, mesmo quando a resposta repete o período solicitado.
- O repository de campeonatos usa o período, mas não aplica `unitId`.
- O repository de quadras compara `unitId` com o texto de `unidade` ou com o `id` da própria quadra. Isso não equivale a um identificador canônico de unidade.

O Dashboard V2.1 não deve apresentar esses filtros como integralmente aplicados sem sinalizar a limitação.

### 7.2 Duas definições de inadimplência

O dashboard executivo deriva inadimplência como receita vencida dividida pela receita esperada do período. O endpoint dedicado calcula carteira vencida dividida pela carteira elegível na data final.

O novo painel deve adotar o endpoint dedicado como definição principal, exibir a data de referência e não combinar numerador de uma definição com denominador da outra.

### 7.3 Metadado foundation defasado

O DTO `21.1` declara `reports: false`, embora a exportação exista desde contratos posteriores. A V2.1 não deve inferir disponibilidade de exportação somente desse booleano.

### 7.4 Risco estático na consulta executive

A auditoria estática identificou uma vírgula final antes de `FROM` na projeção `ENROLLMENT_EXECUTIVE_SQL`. Isso pode causar erro de sintaxe no banco real. A consulta deve ser validada em uma correção separada, com teste de integração MySQL, antes de o novo painel depender desse endpoint. Este planejamento não altera o SQL.

### 7.5 Semânticas que não podem ser inferidas

- `newStudents` do endpoint `/students` identifica a primeira matrícula confirmada conhecida e é a fonte preferencial. O snapshot executivo não aplica a mesma verificação de primeira matrícula.
- `activeClasses` representa turmas ativas, não aulas realizadas no período.
- lucro calculado a partir de recebimentos e despesas pagas é resultado líquido de caixa, não lucro contábil.
- não há saldo bancário canônico, receita da lanchonete, histórico de cancelamentos ou snapshots de retenção no BI.

## 8. Estratégia de composição V2.1 com APIs existentes

### 8.1 Primeira entrega

O frontend deve compor o painel por grupos independentes e executar chamadas paralelas:

| Grupo | Endpoint prioritário |
| --- | --- |
| Receita, despesas, ticket e decomposições | `/api/admin/bi/financial` |
| Inadimplência e aging | `/api/admin/bi/delinquency` |
| Alunos e crescimento | `/api/admin/bi/students` |
| Ocupação de turmas e base para professores | `/api/admin/bi/classes` |
| Ocupação de quadras | `/api/admin/bi/courts` |
| Campeonatos | `/api/admin/bi/championships` |
| Alertas executivos | `/api/admin/bi/insights` |

Receitas do dia, mês e ano exigem três consultas com `period=TODAY`, `CURRENT_MONTH` e `CURRENT_YEAR`. As respostas devem manter chaves de cache distintas.

`/executive` pode ser usado como resumo de compatibilidade, mas não deve substituir os endpoints especializados quando suas definições forem mais precisas.

### 8.2 Tolerância a falhas

- Cada widget deve ter loading, erro, indisponibilidade e sucesso próprios.
- A composição deve aceitar sucesso parcial.
- Um card indisponível deve mostrar o motivo funcional, nunca `R$ 0,00` inventado.
- Uma nova tentativa deve afetar somente a query que falhou.
- O `generatedAt` de cada fonte deve permanecer visível nos detalhes de atualização.

## 9. Proposta futura estritamente aditiva e versionada

Se a quantidade de round-trips ou a necessidade de filtros adicionais justificar um agregador, a proposta é adicionar, em Sprint própria:

```text
GET /api/v2/admin/bi/executive-dashboard
```

Essa rota não substituiria nem alteraria `/api/admin/bi/*`. O contrato proposto teria:

- `contractVersion: "2.1"`;
- filtros normalizados e uma lista explícita de filtros efetivamente aplicados;
- seções independentes com `available`, `reason`, `data` e `generatedAt`;
- composição via serviços existentes, sem duplicar regras;
- `Promise.allSettled` ou mecanismo equivalente para sucesso parcial;
- nenhuma PII individual;
- metadados de cache e freshness;
- campos novos apenas para dados com fonte canônica e definição aprovada.

Filtros candidatos, após validar fontes e índices:

- `period`, `startDate`, `endDate` e `unitId`;
- `professorId`;
- `categoryId`;
- `modalityId`;
- `paymentMethod`;
- `financialStatus`.

Nenhum desses filtros adicionais deve ser anexado silenciosamente aos contratos V1. Antes da implementação, cada repository precisará comprovar que aplica o filtro ou retornar indisponibilidade explícita.

## 10. Cache e atualização

### 10.1 Estado atual

As rotas de BI não definem cache HTTP, cache de aplicação ou ETag. Também não publicam um canal realtime próprio. Existe evento financeiro legado de atualização do dashboard, mas o BI atual não o usa como contrato de invalidação.

### 10.2 Plano frontend

- Usar uma chave de query formada por endpoint, período e todos os filtros normalizados.
- Aplicar `staleTime` curto e coerente com a criticidade do widget.
- Preservar a última resposta válida durante refetch, exibindo estado de atualização.
- Invalidar apenas queries financeiras após eventos financeiros já autorizados.
- Não abrir polling agressivo para métricas históricas.
- Nunca compartilhar cache administrativo com portais de aluno ou responsável.

### 10.3 Plano backend futuro

Um cache backend somente poderá ser adicionado de forma transparente, com:

- chave incluindo papel, unidade, período e filtros;
- TTL curto e configurável;
- invalidação por eventos internos já confirmados;
- proteção contra stampede;
- métricas de hit, miss, latência e erro;
- bypass seguro para diagnóstico;
- proibição de cachear saldo ou dados financeiros não canônicos.

Realtime deve servir para invalidar/refazer consultas, não para empurrar totais sem versionamento ou substituir a fonte HTTP.

## 11. Critérios para evolução da API

Uma implementação futura só poderá avançar quando:

- os endpoints existentes forem testados contra MySQL representativo;
- as divergências de filtros estiverem resolvidas ou explicitamente sinalizadas;
- cada KPI possuir definição, fonte, owner e timezone;
- indisponibilidade continuar representada por `null` e `reason`;
- filtros adicionais tiverem cobertura de autorização, parametrização e índices;
- contratos V1 permanecerem inalterados;
- nenhum cálculo exigir acesso direto ao Banco Inter ou Pix;
- desempenho, ausência de N+1 e sucesso parcial estiverem cobertos por testes;
- Browser E2E existente permanecer intacto.

