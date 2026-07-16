# Containers

## Finalidade

Preparar os dados consumidos pelas pages sem realizar chamadas externas.

## Responsabilidades

- Receber contratos BI previamente carregados.
- Executar o `CommandCenterService` e seus adapters.
- Associar métricas ao cadastro declarativo de KPIs.
- Formatar o view model entregue à `CommandCenterPage`.

## Dependências

Service, adapters, configurações, utils e tipos da feature.

## Regras de uso

Containers não podem chamar HTTP, acessar stores, importar rotas ou usar hooks
do Dashboard atual. Os contratos devem ser fornecidos pelo futuro ponto de
integração.
