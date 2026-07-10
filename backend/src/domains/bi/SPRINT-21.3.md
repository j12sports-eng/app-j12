# Sprint 21.3 - BI Financeiro

Visão analítica read-only disponível em `GET /api/admin/bi/financial`, protegida por `requireAuth` e `canManageSystem`. Usa os filtros compartilhados `period`, `startDate`, `endDate` e `unitId`, com timezone `America/Sao_Paulo` e comparação pela janela anterior inclusiva, de igual duração e sem sobreposição.

## Fonte e prevenção de dupla contagem

`j12_financeiro_cobrancas` é a única fonte monetária. `j12_mensalidades` espelha a cobrança por `cobranca_id`; `j12_pagamentos` registra sua liquidação; `financial_payments` guarda a integração Pix/Banco Inter; `enrollment_financial_obligations` representa a obrigação originada na matrícula. Essas tabelas não são somadas nem usadas para aumentar valores. O meio de pagamento vem de `cobranca.forma_pagamento`, reconciliado pelo fluxo financeiro. Nenhum payload, txid, e2eid, QR Code, token, certificado ou credencial é consultado ou exposto.

## Fórmulas

- Receita recebida: soma de `COALESCE(valor_final, valor)` das cobranças ativas, pagas, não classificadas como `despesa`/`expense`, pela data `COALESCE(data_pagamento, pago_em)`.
- Receita prevista: cobranças ativas, não canceladas e não despesas, por `vencimento`.
- Receita pendente: cobranças ativas `pendente`, não despesas, por `vencimento`.
- Receita vencida: cobranças ativas `atrasado`, não despesas, por `vencimento`.
- Despesas pagas: cobranças ativas pagas cujo `tipo` é `despesa` ou `expense`, pela data de pagamento.
- Ticket médio: receita recebida dividida por `COUNT(DISTINCT aluno_id)` pagantes. Sem pagantes, fica indisponível.
- Evolução mensal: receita recebida agrupada pelo mês real da data de pagamento.
- Categoria, modalidade, unidade e meio de pagamento: receita recebida agrupada pelos campos materializados na cobrança; ausências aparecem como `nao_informado`.
- Comparação: `(atual - anterior) / abs(anterior) * 100`, duas casas. Base anterior zero fica explicitamente indisponível.

O repository executa três consultas agregadas paralelas, parametrizadas e sem N+1: KPIs atual/anterior, evolução mensal e composições. O frontend administrativo fica em `/admin/bi/financeiro`, usa o cliente compartilhado, TanStack Query/Router, `AppShell`, o chart compartilhado e Recharts. Não há exportação, previsão estatística, fluxo de caixa futuro nem funcionalidade da Sprint 21.4.
