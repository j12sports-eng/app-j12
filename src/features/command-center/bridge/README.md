# Dashboard Bridge

## Objetivo

O `DashboardBridge` estabelece o contrato oficial entre o Dashboard legado e o Centro de Comando. Ele permite que o runtime atual entregue contratos BI, filtros, período, contextos, callbacks, estados e slots visuais por uma única fronteira tipada.

## Fluxo

```text
Dashboard atual
  -> DashboardBridge
  -> ExecutiveDashboardContainer
  -> CommandCenterService
  -> Adapters
  -> ViewModel
  -> CommandCenterPage
```

## Responsabilidades

- Receber todos os dados por props.
- Encaminhar as props ao `ExecutiveDashboardContainer` sem lógica de negócio.
- Expor somente o componente e seus contratos públicos por `bridge/index.ts`.
- Manter os contratos do Bridge independentes da implementação do Dashboard legado.

`filterControls` é o slot visual encaminhado ao prop `filters` do container. `dashboardFilters` representa os valores de filtro do contrato público, evitando misturar estado de domínio com apresentação.

## Limitações

- Não busca, calcula, transforma, persiste ou valida dados.
- Não conhece rotas, APIs, banco de dados, autenticação, stores ou React Query.
- Não integra nem substitui o Dashboard atual nesta Sprint.
- Contextos, callbacks e estado de runtime permanecem passivos até que seus consumidores sejam conectados.

## Ponto futuro de integração

Na Sprint 26.5B, o Dashboard atual deverá montar `DashboardBridgeProps` com dados que já possui e renderizar o `DashboardBridge` no ponto de integração aprovado. O Bridge continuará sem acessar infraestrutura; a composição no Dashboard será responsável apenas por fornecer as props definidas aqui.
