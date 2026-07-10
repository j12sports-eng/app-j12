# Sprint 21.2 - Dashboard Executivo de BI

O dashboard administrativo adiciona `GET /api/admin/bi/executive`, protegido por `requireAuth` e `canManageSystem`, sem substituir o dashboard legado. A aplicação resolve os filtros `period`, `startDate`, `endDate` e `unitId` no timezone `America/Sao_Paulo`; o repository é read-only e executa duas consultas agregadas paralelas, uma para matrículas e outra para cobranças.

## Métricas e fontes

- Alunos ativos: alunos distintos com matrícula em `EnrollmentStatus.ACTIVE`. É um snapshot atual; comparação histórica fica indisponível.
- Novos alunos: matrículas distintas com `confirmed_at` dentro do intervalo inclusivo. A confirmação DRAFT→ACTIVE preserva esse timestamp mesmo se o estado mudar depois.
- Cancelamentos: indisponível. `enrollments.end_date` não é comprovadamente a data do evento e não existe `cancelled_at` canônico no agregado.
- Receita recebida: soma de `COALESCE(valor_final, valor)` das receitas ativas com status canônico `InterPaymentStatus.PAID`, pela data `COALESCE(data_pagamento, pago_em)`.
- Receita prevista: soma das receitas ativas, não classificadas como `despesa`/`expense` e não canceladas, por `vencimento`.
- Receita vencida: mesmo universo de receitas, restrito ao status canônico `atrasado`, por `vencimento`.
- Inadimplência: `receita vencida / receita prevista * 100`, arredondada a duas casas. Fica indisponível quando a prevista é zero.
- Ticket médio: `receita recebida / COUNT(DISTINCT aluno_id pagante)`, arredondado a duas casas. Cobranças sem aluno entram na receita mas não no denominador; múltiplos pagamentos do aluno contam uma vez. Fica indisponível sem pagantes.

A comparação usa a janela imediatamente anterior, inclusiva, de igual quantidade de dias e sem sobreposição. A variação é `(atual - anterior) / abs(anterior) * 100`, com duas casas. Base anterior zero é explicitamente indisponível, nunca `0%`. Valores ausentes ou divisões inválidas nunca produzem `NaN`/`Infinity`.

O frontend fica em `/admin/bi`, usa `AppShell`, TanStack Query/Router e o cliente `@/lib/api`. Trata loading, erro, filtro customizado inválido, KPI indisponível e comparação indisponível. Não há gráfico porque a Sprint entrega snapshots agregados, não série temporal. Exportação, séries temporais e novos filtros permanecem fora da Sprint 21.2.
