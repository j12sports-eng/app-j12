# Sprint 27.10 — Preview de Campeonatos no Centro de Comando

## Objetivo e estado inicial

A Sprint integra o Centro de Comando ao BI de Campeonatos existente sem alterar backend,
schema ou regras esportivas. A branch `sprint-23` iniciou limpa e sincronizada no commit
`9124c8c`; typecheck, lint, build client/SSR e 39 testes de baseline passaram.

## Auditoria e fonte selecionada

A fonte canônica é `GET /admin/bi/championships`, contrato `21.8`, `readOnly: true`.
O router exige `requireAuth` e `canManageSystem`. A API frontend envia `period`,
`startDate` e `endDate`. Não há filtro efetivo por unidade, organização ou tenant nas
queries; a visão é global e restrita à permissão de gestão sistêmica.

O repository executa quatro SELECTs parametrizados em paralelo sobre campeonatos,
inscrições, participantes e jogos. Não há escrita ou N+1. Soft deletes e status removido
são excluídos, e os SELECTs não consultam dados pessoais de atletas ou responsáveis.

## Contrato usado pelo preview

KPIs disponíveis: campeonatos ativos e encerrados, média de equipes, equipes únicas,
inscrições confirmadas, participantes, partidas concluídas e partidas pendentes. Receita
de inscrições permanece indisponível com `NO_CANONICAL_REGISTRATION_REVENUE` e não é
renderizada como zero.

O preview preserva somente distribuições agregadas por categoria/status e evolução
diária de inscrições. O ranking por campeonato, com ID e nome, é descartado integralmente,
assim como campos inesperados, tabelas, súmulas, equipes, atletas e responsáveis.

## Fluxo e interface

`ChampionshipsCommandCenterPreview` → `useChampionshipsBI` →
`championshipsPreviewProvider` → `getBiChampionships` →
`GET /admin/bi/championships` → `normalizeChampionshipsPreviewSource` →
`createChampionshipsProvider` → `adaptChampionshipsContract`.

São reutilizados shell, fields, reload, state panel, query options, hook, provider,
adapter, contrato, registry e feature flag. A rota usa `ProtectedRoute`, papéis `admin` e
`coordenador` e `AppShell`. Loading, refresh, empty, erro inicial, erro de refresh e
success são tratados sem valores fictícios.

## Segurança, performance e riscos

Há uma única chamada GET, query key estável e stale time de cinco minutos. Não existe
fallback operacional, mutação, cálculo de classificação/resultado, N+1, dependência nova
ou agregação esportiva no frontend.

Riscos residuais: ausência de isolamento por unidade/tenant; três das quatro queries
carregam linhas do período antes de agregar no DTO; ranking granular é transferido pela
API embora descartado no normalizador; o contrato 21.8 não fornece metadata ou warnings.

## Testes e próximo passo

Os testes cobrem contrato válido/incompatível, vazio/parcial, indisponibilidade, números
e datas inválidos, arrays, descarte de ranking/PII, endpoint GET único, estados, registry
e rota. Também são executados testes reais do BI, regressões dos previews, typecheck,
lint, build client/SSR e verificações Git.

Próximo passo recomendado: em sprint backend separada, avaliar agregação SQL e escopo por
unidade/tenant antes de expor recortes organizacionais no Centro de Comando.
