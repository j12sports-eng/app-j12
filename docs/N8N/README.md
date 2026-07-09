# n8n - Automação Financeira J12

## Objetivo

Workflows e documentação operacional das automações financeiras J12 entregues nas Sprints 20.3 e 20.4.

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
- [Validação final 20.3](SPRINT_20_3_VALIDACAO_FINAL.md)

## Segurança e escopo

Credenciais devem existir apenas no cofre do n8n. Segredos e URLs fixas não devem ser gravados nos JSONs; endpoints usam variáveis de ambiente.

As Sprints 20.3/20.4 alteram somente `docs/N8N/`, sem backend, frontend, banco, migrations ou API.
