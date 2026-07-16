# Sprint 24.1 - Auditoria de performance do banco de dados

Data: 2026-07-15  
Branch: `sprint-23`  
HEAD: `37928bb4e28407e7a58c37eee70880b8be1157bc`  
Escopo: auditoria e plano; nenhuma otimizacao implementada

Atualizacao Sprint 24.2: os tres P0 foram implementados de forma aditiva. Atualizacao Sprint 24.3: os P1 autorizados foram implementados; P2 permanece apenas como proposta.

## Resumo executivo

Foram auditadas 159 ocorrencias `SELECT` de producao em 27 arquivos dos dominios BI, Financeiro, Campeonatos, Agenda e Quadras, incluindo o materializador `student-finance`. A revisao encontrou boa parametrizacao, paginacao nas listas administrativas principais, consultas BI com quantidade fixa de round trips e testes que impedem N+1 em areas criticas.

As maiores oportunidades estao em predicados nao sargable (`LOWER`, `COALESCE`, `CONVERT`, `CAST`), falta de indices compostos alinhados a filtro mais ordenacao, 42 ocorrencias de `SELECT *`, paginacao profunda por `OFFSET`, agregacoes repetidas sobre cobrancas e escritas item a item em Agenda/Campeonatos. Foram propostas 12 otimizacoes, sem alterar contratos ou regras de negocio.

Nenhum `EXPLAIN` foi usado como evidencia: nao existe dataset local persistente e representativo, e o schema local completo permanece bloqueado pela aplicacao da migration da bridge. Um plano sobre tabelas vazias seria enganoso. O banco remoto nao foi acessado.

## Checkpoint Git

| Item               | Resultado                                  |
| ------------------ | ------------------------------------------ |
| Branch             | `sprint-23`                                |
| HEAD               | `37928bb4e28407e7a58c37eee70880b8be1157bc` |
| Origin             | alinhado, divergencia `0 0`                |
| Working tree       | preservado                                 |
| Staging            | vazio                                      |
| `git diff --check` | PASS                                       |

## Inventario auditado

| Dominio           | SELECTs | Arquivos de producao | SELECT star |
| ----------------- | ------: | -------------------: | ----------: |
| BI                |      37 |                    7 |           0 |
| Financeiro        |      45 |                    7 |          21 |
| Campeonatos       |      39 |                   10 |           8 |
| Agenda            |      11 |                    1 |           0 |
| Quadras           |      17 |                    1 |           7 |
| `student-finance` |      10 |                    1 |           6 |
| **Total**         | **159** |               **27** |      **42** |

Metricas adicionais do inventario bruto: 118 ocorrencias de `JOIN`, 74 de `ORDER BY` e 24 de `GROUP BY` no conjunto pesquisado antes da exclusao de testes. Essas contagens servem para localizar hotspots, nao para estimar custo isoladamente.

## Consultas criticas encontradas

### BI financeiro e inadimplencia

- `mysql-bi-financial.repository.js` aplica `LOWER`, `COALESCE`, `CONVERT`, `CAST` e `COLLATE` sobre status, tipo, datas e unidade. Isso reduz a capacidade do otimizador de usar os indices simples existentes.
- O breakdown financeiro executa agrupamentos separados por categoria, modalidade, unidade e forma de pagamento sobre o mesmo conjunto filtrado.
- `mysql-bi-delinquency.repository.js` executa quatro agregacoes paralelas e calcula aging com expressoes; e uma quantidade fixa, nao N+1, mas cada consulta pode varrer a carteira.
- BI de alunos, turmas, quadras e campeonatos usa consultas fixas e paralelas. Os testes confirmam ausencia de N+1, mas filtros com `CAST(id AS CHAR)` e `OR` podem forcar scans.

### Financeiro operacional e relatorios

- `mysql-financial-report.repository.js` dispara conjuntos de 2 a 5 consultas paralelas por relatorio, repetindo o mesmo `FROM`/`WHERE` em resumo, itens, count e evolucao.
- Listas de cobrancas, inadimplencia e Pix usam `LIMIT/OFFSET`; offsets altos degradam linearmente.
- Automacao ordena mensalidades por `(data_vencimento, id)` e pagamentos por datas derivadas com `COALESCE`.
- `financial_payments` possui indices simples por status e relacionamentos, mas nao um indice composto para status mais `created_at`, `due_date` ou `paid_at`.
- Repositories financeiros e `student-finance` usam `SELECT *` mesmo quando os consumidores leem subconjuntos conhecidos.

### Campeonatos

- Listas principais estao paginadas, mas varias usam ordenacao dinamica seguida de desempate, exigindo indices por campeonato/status/coluna de ordenacao.
- Rodadas, jogos, grupos, inscricoes e atletas fazem JOIN por IDs de escopo e ordenam por `created_at`, `round_number`, `display_order` ou nome.
- Persistencias de standings, statistics, bracket e grupos usam loops transacionais. Nao e N+1 de leitura, mas aumenta round trips de escrita.
- Algumas leituras detalhadas usam `SELECT *`; projeções explicitas reduziriam transferencia e acoplamento ao schema.

### Agenda

- Consultas por aluno/enrollment juntam `enrollments`, `enrollment_class_links` e `j12_turmas`, filtrando links ativos e ordenando por turma e `linked_at`.
- Conflitos filtram classe/dia/intervalo; indices precisam iniciar pelo identificador de escopo e incluir data/horario/status.
- Criacao inicial persiste agenda items em loop dentro da transacao. O comportamento e correto, mas o custo cresce com recorrencias longas.
- Leituras de ocorrencias e bloqueios possuem ordenacao deterministica apropriada, porem precisam de indices compostos equivalentes.

### Quadras

- Reservas filtram quadra/status/janela temporal e ordenam por `start_at`; o indice composto de sobreposicao e prioritario.
- Bloqueios e lista de espera repetem o padrao por quadra, status e data.
- A tela operacional combina reservas, quadras e locatarios em tres consultas paralelas, evitando N+1.
- Existem listas sem paginacao para cadastros de apoio e sete `SELECT *`; aceitavel apenas enquanto a cardinalidade permanecer baixa.

## Oportunidades e plano de implementacao

| Prioridade | Proposta segura                                                                                                          | Alvo                   | Impacto esperado                           | Validacao obrigatoria                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------- | ------------------------------------------ | ---------------------------------------- |
| P0         | Criar indice composto de reservas `(quadra_id, status, start_at, end_at)`                                                | Quadras                | reduzir scans de disponibilidade/conflito  | EXPLAIN ANALYZE com janelas sobrepostas  |
| P0         | Criar indices compostos de cobrancas para `(ativo, status, vencimento)` e `(ativo, status, data_pagamento)`              | Financeiro/BI          | acelerar carteira, aging e liquidacao      | comparar rows examined e latencia p95    |
| P0         | Tornar filtros normalizados sargable, com colunas normalizadas/geradas e indices, preservando os valores expostos        | BI financeiro          | eliminar funcoes sobre colunas indexadas   | testes de equivalencia e EXPLAIN         |
| P1         | Adicionar `(status, data_vencimento, id)` em mensalidades                                                                | Automacao financeira   | busca e ordenacao de pendencias por indice | plano sem filesort relevante             |
| P1         | Adicionar indices de `financial_payments` por `(status, created_at, id)` e avaliar `(status, due_date)`                  | Pix/relatorios         | listas e sincronizacao mais seletivas      | medir escrita e leitura antes/depois     |
| P1         | Criar indices de Agenda por `(class_id, day_of_week, start_time)`, ocorrencia e bloqueio                                 | Agenda                 | reduzir scans de conflito e ordenacao      | fixtures com alta recorrencia            |
| P1         | Alinhar indices de Campeonatos a `(championship_id, status, created_at)` e chaves de ordenacao de rounds/matches/groups  | Campeonatos            | reduzir filesort e leituras por campeonato | EXPLAIN por endpoint paginado            |
| P1         | Substituir `SELECT *` por projecoes explicitas nos 42 pontos, em lotes por dominio                                       | Todos                  | menos I/O, memoria e acoplamento           | testes de DTO/mapper e contratos         |
| P1         | Reutilizar conjunto filtrado nas agregacoes financeiras, via CTE/materializacao local da consulta ou consolidacao segura | BI/relatorios          | reduzir scans repetidos                    | equivalencia exata de totais             |
| P2         | Oferecer cursor/keyset compativel para listas hoje baseadas em OFFSET profundo                                           | Financeiro/Campeonatos | latencia estavel em paginas altas          | manter contrato antigo durante transicao |
| P2         | Fazer inserts/upserts em lote para agenda items e estruturas de campeonato                                               | Agenda/Campeonatos     | reduzir round trips de escrita             | rollback, concorrencia e idempotencia    |
| P2         | Aplicar limites/paginacao a listas auxiliares de Quadras e Agenda com cardinalidade crescente                            | Quadras/Agenda         | limitar memoria e resposta                 | defaults retrocompativeis                |

Quantidade de otimizacoes propostas: **12** (3 P0, 6 P1 e 3 P2).

## Otimizacoes P0 implementadas na Sprint 24.2

| P0                         | Implementacao                                                                                                                                                                                                   | Consultas afetadas                                                         | Impacto esperado                                                         | Risco residual                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Disponibilidade de quadras | indice `idx_j12_quadra_reservas_availability (quadra_id, status, start_at, end_at)`                                                                                                                             | conflitos e disponibilidade de reservas                                    | reduzir o conjunto examinado por quadra/status antes da janela temporal  | sobreposicao usa duas desigualdades; validar seletividade com dados representativos        |
| Carteira e liquidacao      | indices `idx_j12_cobrancas_active_status_due (ativo, status, vencimento)` e `idx_j12_cobrancas_active_status_paid (ativo, status, data_pagamento)`                                                              | cobrancas ativas por status/vencimento e data de pagamento                 | reduzir full scans nas consultas operacionais e de BI                    | write amplification e seletividade de `ativo/status`                                       |
| BI financeiro sargable     | colunas geradas `status_normalized`, `type_normalized`, `payment_effective_date`; indices `idx_j12_cobrancas_bi_due` e `idx_j12_cobrancas_bi_paid`; repository financeiro passa a filtrar pelas colunas geradas | 3 consultas agregadas do dashboard financeiro (KPI, evolucao e breakdowns) | retirar `LOWER`/`COALESCE` das colunas filtradas e habilitar range scans | `CONVERT`/`COLLATE` do filtro opcional de unidade permanece para preservar compatibilidade |

Migration nova: `20260715210000_add_p0_database_performance_indexes.js`. Total: **3 colunas geradas e 5 indices novos**. A migration e idempotente, valida a forma de indices preexistentes, carrega a configuracao de banco somente durante execucao e recusa rollback destrutivo automatico.

Nenhuma regra de negocio, API, payload, contrato publico ou migration historica foi alterada. As 3 consultas exportadas pelo repository financeiro preservam parametros, agregacoes, dimensoes e quantidade fixa de round trips.

## Otimizacoes P1 implementadas na Sprint 24.3

| P1                     | Implementacao                                                                                                                                                                                                                                       | Consultas afetadas                               | Reducao esperada                                                                                          | Impacto esperado                                                                         | Risco residual                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Mensalidades           | indice `idx_j12_mensalidades_status_due_id (status, data_vencimento, id)`                                                                                                                                                                           | automacao de mensalidades pendentes              | elimina filesort/scan amplo quando o plano selecionar o indice                                            | busca e ordenacao cobertas                                                               | custo adicional de escrita                                                                                    |
| Pagamentos financeiros | indices por `(status, created_at, id)`, `(status, due_date, id)` e `(status, paid_at, id)`                                                                                                                                                          | filas, relatorios e sincronizacao local          | reduz rows examined por status e janela                                                                   | latencia mais estavel em carteiras grandes                                               | seletividade depende da distribuicao de status                                                                |
| Agenda                 | indices de item `(class_id, day_of_week, start_time)`, serie `(class_id, status, start_date, start_time)`, ocorrencia `(series_id, occurrence_date, occurrence_start_time, id)` e bloqueio opcional `(active, block_date, day_of_week, start_time)` | conflitos, recorrencias, ocorrencias e bloqueios | reduz candidatos antes da verificacao de sobreposicao                                                     | menos scans e filesort                                                                   | `LOWER(day_of_week)` e `OR` legado ainda podem limitar uso integral                                           |
| Campeonatos            | indices de inscricoes/jogos por `(championship_id, status, created_at)` e chaves de ordenacao de rodadas/grupos                                                                                                                                     | listas paginadas, rounds, matches e groups       | reduz scans e ordenacoes por campeonato                                                                   | filtros e desempates alinhados                                                           | tabelas runtime sao opcionais; a migration adota existentes e o schema runtime cobre criacoes futuras         |
| Projecoes explicitas   | 35 ocorrencias `SELECT *` substituidas nos repositories permitidos de Financeiro, Campeonatos e Quadras                                                                                                                                             | 35 leituras                                      | menos colunas transferidas e menor acoplamento ao schema                                                  | menor I/O e memoria sem mudar DTOs                                                       | 7 ocorrencias do repository Banco Inter foram preservadas pela proibicao explicita de alterar essa integracao |
| Agregacao financeira   | breakdown financeiro usa um CTE `filtered_charges` compartilhado pelas quatro dimensoes                                                                                                                                                             | uma consulta com quatro agregacoes               | de quatro leituras logicas da tabela-base para um conjunto filtrado reutilizado; round trips permanecem 3 | reduz scans repetidos preservando categorias, modalidades, unidades e meios de pagamento | materializacao/inlining depende do plano MySQL e deve ser confirmada com `EXPLAIN ANALYZE` representativo     |

A migration nova `20260715223000_add_p1_database_performance_indexes.js` adiciona **12 indices**: 7 obrigatorios e 5 opcionais para tabelas runtime. Ela e idempotente, valida ordem de colunas, carrega configuracao de banco apenas em execucao e recusa rollback destrutivo automatico.

Nao foi eliminado N+1 porque a auditoria e os testes confirmam que os dashboards ja usam quantidades fixas de consultas. Nenhuma paginacao foi criada: cursor/keyset e limites adicionais permanecem classificados como P2 e foram explicitamente excluidos da Sprint 24.3. Nenhuma API, payload, regra de negocio, autenticacao, autorizacao, Browser E2E, Banco Inter, Pix, CI/CD ou migration historica foi alterada.

## Avaliacao de N+1, duplicacao e paginacao

- BI usa quantidades fixas de queries paralelas, comprovadas por testes; nao foi encontrado N+1 de leitura.
- Quadras carrega reservas, quadras e locatarios em paralelo e faz o merge em memoria; nao foi encontrado N+1.
- Loops de Agenda e Campeonatos concentram escritas unitarias. Foram classificados como oportunidade de batch, nao como defeito funcional.
- Financeiro repete filtros em consultas de resumo/count/itens. E duplicacao de scan, nao duplicacao de regra.
- As listas administrativas principais tem limite. O risco esta em OFFSET profundo e em listas auxiliares sem limite explicito.
- `ORDER BY` deterministicos com desempate por ID devem ser preservados; a proposta e indexa-los, nao remove-los indiscriminadamente.

## EXPLAIN e baseline de medicao

Uma futura etapa de implementacao deve usar um MySQL local descartavel com schema completo e dados sinteticos representativos. Para cada P0/P1:

1. registrar `EXPLAIN ANALYZE`, rows examined, rows returned, temporary table e filesort;
2. executar amostras fria e quente com cardinalidades pequenas, medias e altas;
3. comparar p50/p95 e custo de escrita antes/depois;
4. comprovar equivalencia de payload e ordenacao;
5. validar tamanho e seletividade dos indices;
6. remover proposta cujo ganho nao compense write amplification.

Sem essa baseline, os impactos descritos sao expectativas tecnicas, nao percentuais de ganho garantidos.

## Riscos

- Indices adicionais aumentam armazenamento, tempo de migration e custo de INSERT/UPDATE.
- Indices de baixa seletividade, como status isolado, podem ser ignorados; por isso as propostas combinam status com data/escopo.
- Colunas geradas/normalizadas exigem prova de collation e compatibilidade com MySQL 8.4.
- Keyset pagination pode alterar navegacao se substituida de forma abrupta; deve ser opcional e retrocompativel.
- Batch writes podem mudar a granularidade de erros; devem preservar transacao, idempotencia e rollback integral.
- CTEs podem ser inline ou materializadas conforme o plano; somente EXPLAIN com dados decide a forma adequada.
- A migration da bridge da Sprint 23 ainda bloqueia a montagem completa do schema local e precisa ser resolvida antes de benchmarks integrados.

## Gates executados

| Gate               | Resultado                         |
| ------------------ | --------------------------------- |
| Secret Scan        | PASS - 1.651 arquivos, 0 findings |
| Contracts          | PASS - 12/12                      |
| Migrations         | PASS - 41/41                      |
| Runner             | PASS - 17/17                      |
| Topology/Integrity | PASS - 3/3                        |
| Security           | PASS - 34/34                      |
| Backend            | PASS - 686/686                    |
| Frontend           | PASS - 78/78                      |
| Build Client       | PASS - 3.737 modulos              |
| Build SSR          | PASS - 449 modulos                |
| `node --check`     | PASS no JavaScript do checkpoint  |

## Conclusao

A auditoria documental da Sprint 24.1 esta concluida. O sistema ja evita N+1 nos dashboards principais e pagina as listas de maior exposicao, mas tem ganho potencial relevante em sargabilidade, indices compostos, reducao de `SELECT *`, scans agregados repetidos e batch writes.

Nenhuma proposta deve ser aplicada sem uma migration nova, testes de integridade e baseline `EXPLAIN ANALYZE` em MySQL local representativo. Prioridade de implementacao futura: reservas de Quadras, cobrancas/BI financeiro e normalizacao sargable. Nenhuma alteracao funcional foi realizada nesta sprint de auditoria.
