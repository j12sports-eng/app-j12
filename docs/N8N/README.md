# n8n - Automação Financeira J12

## Objetivo

Workflows e documentação operacional das automações financeiras J12 entregues nas Sprints 20.3, 20.4 e 20.5.

## Workflows

- `financeiro-lembretes.json`: fluxo executável, preparado para importação e teste controlado em homologação.
- `financeiro-baixa-pagamento.json`: envelope sem nós; manter inativo.
- `financeiro-cobranca-diaria.json`: envelope sem nós; manter inativo.
- `financeiro-cobranca-vencimento.json`: envelope sem nós; manter inativo.
- `financeiro-reprocessar-falhas.json`: envelope sem nós; manter inativo.

Nenhum workflow está autorizado para produção. JSON válido não equivale a validação funcional.

## Guias

- [Importação](WORKFLOW_IMPORT.md)
- [Variáveis e credenciais](WORKFLOW_VARIABLES.md)
- [Validação operacional 20.4](SPRINT_20_4_VALIDACAO_OPERACIONAL.md)
- [Plano de testes](WORKFLOW_TEST_PLAN.md)
- [Plano de rollback](WORKFLOW_ROLLBACK.md)
- [Deploy em homologação](HML_DEPLOYMENT.md)
- [Checklist de homologação e rollback](HML_CHECKLIST.md)
- [Dependências e ordem oficial](WORKFLOW_DEPENDENCIES.md)
- [Modelo seguro de credenciais](CREDENTIALS_TEMPLATE.md)
- [Guia de Dry Run](DRY_RUN_GUIDE.md)
- [Checklist de Dry Run](DRY_RUN_CHECKLIST.md)
- [Resultados esperados do Dry Run](DRY_RUN_EXPECTED_RESULTS.md)
- [Resposta a incidentes](INCIDENT_RESPONSE.md)
- [Validação final 20.3](SPRINT_20_3_VALIDACAO_FINAL.md)

## Dry Run

A Sprint 20.6 prepara a simulação sem efeitos reais. Todos os workflows permanecem inativos. `financeiro-lembretes` só pode ser executado manualmente em cópia isolada, com API e mensageria substituídas por stubs incapazes de atingir integrações reais. Os outros quatro workflows não possuem nós e permanecem bloqueados para teste funcional.

Dry Run aprovado não autoriza ativação agendada, integração real ou produção.

## Observabilidade

A Sprint 20.7 define a observabilidade operacional sem provisionar infraestrutura ou ativar workflows:

- [Arquitetura, métricas, KPIs e rotina de monitoramento](MONITORING_GUIDE.md)
- [Política e severidade dos alertas](ALERT_POLICY.md)
- [Formato de logs e IDs de correlação](LOGGING_GUIDE.md)
- [Classificação operacional de erros](ERROR_CLASSIFICATION.md)
- [Especificação do dashboard operacional](OPERATION_DASHBOARD.md)

Os thresholds são baselines para calibração em HML. A documentação não representa coletor, alertas ou dashboard já implantados.

## Segurança e escopo

Credenciais devem existir apenas no cofre do n8n. Segredos e URLs fixas não devem ser gravados nos JSONs; endpoints usam variáveis de ambiente.

As Sprints 20.3/20.4/20.5/20.6/20.7 alteram somente `docs/N8N/`, sem backend, frontend, banco, migrations ou API.
