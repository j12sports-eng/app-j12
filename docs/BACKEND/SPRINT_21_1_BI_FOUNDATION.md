# Sprint 21.1 - Fundacao arquitetural de BI e Relatorios

## Objetivo

A Sprint 21.1 cria somente a fundacao tecnica do dominio de BI. Ela define periodos, filtros, contrato descritivo, application service, controller, router administrativo e consumo frontend minimo. Nenhuma metrica executiva, dashboard, relatorio de produto ou consulta agregada foi implementada.

## Estado retomado

A execucao foi retomada na branch `sprint-21`, commit base `15d2bd4`, com `backend/src/server.js` modificado e `backend/src/domains/bi/` parcialmente criado. O trabalho valido foi preservado e corrigido incrementalmente.

Problemas encontrados no estado parcial:

- import incorreto de `DEFAULT_TIMEZONE`, que nao e exportado diretamente pelo modulo compartilhado;
- validacao de datas que aceitava dias inexistentes no calendario;
- filtros de granularidade, categoria, modalidade, ordenacao e paginacao sem capacidade real correspondente;
- contrato `read/count` sem repository concreto ou fonte agregada comprovada;
- controller convertendo erro inesperado em resposta local em vez de encaminhar ao middleware global.

## Arquitetura final

```text
Frontend minimo
  types + query keys + API + React Query hook
                     |
                     v
GET /api/admin/bi/foundation
                     |
requireAuth + canManageSystem
                     |
BiFoundationController
                     |
BiFoundationService
                     |
normalizeBiQuery + resolveBiPeriod + DTO
```

O dominio possui `application` e `presentation`, que sao as camadas realmente necessarias nesta fase. Uma camada `infrastructure` nao foi criada porque nao existe repository agregado de BI implementavel sem antecipar metricas ou acoplar tabelas de outros dominios.

## Composition root

`backend/src/server.js` importa `createBiAdminRouter`, instancia o router sem dependencias de banco e monta:

- `/admin/bi`;
- `/api/admin/bi`.

A montagem segue o helper `mount` ja utilizado pelos demais dominios. O prefixo `/api` nao e duplicado dentro do router.

## Seguranca

O router aplica, nesta ordem:

1. `requireAuth`;
2. `canManageSystem`, por meio de `ensureBiAdminAccess`.

Nao existe endpoint publico. Usuarios autenticados sem permissao administrativa recebem HTTP 403. Erros controlados de filtro retornam HTTP 400; erros inesperados sao encaminhados ao middleware global.

## Tempo, periodos e filtros

Timezone canonico: `America/Sao_Paulo`, lido de `SharedConstants.DEFAULT_TIMEZONE`.

Periodos suportados:

- `TODAY`;
- `LAST_7_DAYS`;
- `LAST_30_DAYS`;
- `CURRENT_MONTH`;
- `PREVIOUS_MONTH`;
- `CURRENT_QUARTER`;
- `CURRENT_YEAR`;
- `CUSTOM`.

Filtros da fundacao:

- `period`;
- `startDate`;
- `endDate`;
- `unitId`.

Datas usam `YYYY-MM-DD`, limites inclusivos e validacao calendaria. `CUSTOM` exige as duas datas e rejeita intervalo invertido. `unitId` aceita identificador textual nao vazio de ate 64 caracteres.

## Fontes canonicas e limites

As fontes canonicas de Matriculas, Turmas, Financeiro, Quadras e Campeonatos foram auditadas, mas nao sao consultadas nesta Sprint. O contrato informa explicitamente:

- fundacao disponivel;
- metricas indisponiveis;
- relatorios indisponiveis;
- repository agregado indisponivel por ausencia de contrato canonico.

Isso impede que placeholders ou numeros hardcoded sejam confundidos com dados reais.

## Frontend minimo

Foram criados:

- tipos do contrato 21.1;
- query keys estaveis;
- chamada usando o cliente `api` compartilhado;
- hook `useBiFoundation` usando TanStack Query.

Nao foram criados rota, pagina, menu, dashboard, KPI, grafico ou segundo cliente HTTP.

## Reservado para proximas Sprints

- contratos agregados por fonte canonica;
- repositories/adapters de leitura;
- metricas executivas;
- dashboards e visualizacoes;
- exportacao de relatorios;
- rota de produto e navegacao.

Nenhuma funcionalidade da Sprint 21.2 foi antecipada.
