# Config

## Finalidade

Centralizar a composição declarativa do Centro de Comando.

## Responsabilidades

- Definir áreas, colunas, ordem e largura dos blocos.
- Registrar as seções oficiais.
- Associar KPIs a métricas produzidas pelo `CommandCenterService`.
- Catalogar os widgets reutilizáveis e suas seções.

## Dependências

Somente tipos, constantes e ícones da própria feature. Os registros não acessam
APIs, hooks, stores, rotas ou banco de dados.

## Regras de uso

Configurações sem fonte canônica devem usar `metricKey: null`. A camada de
composição deve apresentar indisponibilidade e nunca fabricar valores.
