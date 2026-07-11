# Sprint 21.11 - Alertas e insights administrativos

Base: `c51772c`. Endpoint protegido: `GET /api/admin/bi/insights`. Painel: `/admin/bi/insights`.

A engine e deterministica, read-only e usa os mesmos services consolidados de financeiro, inadimplencia, turmas, alunos e quadras. Nao usa LLM, servico externo, tabela ou migration. Falhas de automacao nao geram regra porque ainda nao existe metrica consolidada desse tema no BI.

Thresholds padrao: inadimplencia 10%/20%, queda de receita -10%/-25%, turma critica em 95%, turma subutilizada abaixo de 50% e quadras com baixa ocupacao abaixo de 30%. Todos podem ser injetados na composicao para configuracao controlada.

Cada insight inclui identificador, tipo, severidade, titulo, descricao, valor atual, referencia anterior, variacao, periodo, service de origem, timestamp e acao recomendada. Regras evitam causalidade e nao emitem alerta quando dados obrigatorios estao ausentes. A Sprint 21.12 nao foi iniciada.
