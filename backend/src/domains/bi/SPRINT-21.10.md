# Sprint 21.10 - Comparativos, tendencias e metas

Base: `1c455cc`. A Sprint amplia de forma aditiva o BI Financeiro, que possui a serie temporal canonica de receita recebida. Nao cria uma segunda fonte de KPI e nao altera as consultas financeiras existentes.

## Comparativos e tendencias

- periodo atual contra a janela anterior ja resolvida pelo BI;
- ultimo mes disponivel contra o mes imediatamente anterior;
- ultimo mes contra o mesmo mes do ano anterior, somente quando ambos existem;
- diferenca absoluta e percentual com denominador anterior em modulo;
- base anterior zero preserva a diferenca absoluta, mas marca percentual como indisponivel;
- media movel simples de tres pontos e direcao `growth`, `decline`, `stable` ou `unavailable`;
- dados incompletos e periodos ausentes nunca produzem `NaN` ou `Infinity`.

Todos os calculos sao determinísticos e explicaveis. A interface declara expressamente que nao sao previsao nem IA.

## Metas

A auditoria nao encontrou tabela, repository, contrato ou configuracao canonica de metas no BI. As metas ad hoc do dashboard legado nao foram reutilizadas. Por isso, o contrato retorna meta indisponivel com `NO_CANONICAL_GOAL_PERSISTENCE`, sem inventar valor, realizado, percentual, diferenca ou status e sem criar migration prematura.

A Sprint 21.11 nao foi iniciada.
