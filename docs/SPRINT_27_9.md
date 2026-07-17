# Sprint 27.9 — Preview de Quadras no Centro de Comando

## Objetivo e estado inicial

A Sprint integra o Centro de Comando ao BI de Quadras existente sem alterar backend,
schema ou regras operacionais. A branch `sprint-23` iniciou limpa e sincronizada no
commit `c6528f8`; typecheck, lint, build client/SSR e 35 testes de baseline passaram.

## Auditoria e fonte selecionada

A fonte canônica é `GET /admin/bi/courts`, contrato `21.7`, `readOnly: true`.
O router exige `requireAuth` e `canManageSystem`. Os filtros são `period`, `startDate`,
`endDate` e `unitId`; não há tenant ou organização no contrato, e a permissão é sistêmica.

O repository consulta `j12_quadras` e `j12_quadra_reservas` com duas queries
parametrizadas em paralelo. Não existe escrita ou N+1. A agregação de disponibilidade,
ocupação, cancelamentos e sobreposições ocorre no backend.

## Contrato usado pelo preview

KPIs canônicos disponíveis: horas disponíveis, horas reservadas, taxa de ocupação e
cancelamentos. Receita de locação e ticket médio permanecem indisponíveis com o motivo
`NO_CANONICAL_PAYMENT_AMOUNT_AND_TIMESTAMP` e não são renderizados como zero.

O contrato possui rankings por quadra, dia, horário e unidade, mas não possui evolução
temporal, metadata ou warnings. O normalizador descarta todos os rankings, nomes e IDs de
quadra, unidades, dias, horários e quaisquer campos inesperados. Nenhuma linha de quadra
ou reserva atravessa o contrato do Centro de Comando.

## Fluxo vertical e interface

`CourtsCommandCenterPreview` → `useCourtsBI` → `courtsPreviewProvider` → `getBiCourts`
→ `GET /admin/bi/courts` → `normalizeCourtsPreviewSource` → `createCourtsProvider` →
`adaptCourtsContract`.

O preview reutiliza `PreviewShell`, `PreviewField`, `PreviewReloadButton`,
`PreviewStatePanel`, query options, provider, adapter, hook, registry e feature flag.
Trata loading, refresh, empty, erro inicial, erro de refresh e success. A rota protegida
preserva os papéis `admin` e `coordenador` e usa `AppShell`.

## Segurança e performance

Há uma única chamada GET por carga, query key estável e stale time de cinco minutos.
Não há fallback operacional, listagem no navegador, N+1, cálculo financeiro, mutação,
dependência nova ou consulta por render. O normalizador valida versão, read-only,
números finitos/não negativos, porcentagem entre 0 e 100, datas e timezone.

Riscos residuais: o backend carrega as linhas necessárias das duas fontes antes de
agregar; bloqueios e feriados não reduzem disponibilidade no contrato 21.7; o filtro
legado aceita unidade ou ID de quadra; rankings operacionais agregados são transferidos
pela API, embora descartados antes do contrato do preview.

## Validação e próximo passo

Os testes cobrem payload válido, vazio/parcial, indisponibilidade, números e datas
inválidos, descarte de rankings/PII, endpoint GET único, estados, registry e rota. Também
são executadas as regressões dos previews, testes reais do BI de Quadras, typecheck,
lint, build client/SSR e verificações Git.

Próximo passo recomendado: medir o volume das duas queries no ambiente real e, em sprint
backend separada, avaliar uma resposta 21.7 futura sem rankings quando o consumidor
precisar apenas de KPIs globais.
