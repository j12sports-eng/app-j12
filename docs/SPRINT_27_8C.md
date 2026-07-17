# Sprint 27.8C — Integração do Preview de Agenda

## Objetivo e dependência

A Sprint integra o Centro de Comando à fonte agregada criada e commitada na Sprint
27.8B. O frontend consome exclusivamente `GET /admin/bi/agenda`, contrato `21.12`,
`readOnly: true`.

Nenhum backend, endpoint, schema, migration ou contrato público existente foi alterado.

## Fonte, filtros e indicadores

Filtros suportados: `period`, `startDate`, `endDate` e `unitId`. O preview usa
`CURRENT_MONTH`, timezone `America/Sao_Paulo`, e preserva autenticação do cliente HTTP.

Indicadores exibidos:

- séries recorrentes no período;
- séries recorrentes ativas;
- séries canceladas;
- ocorrências canceladas;
- ocorrências modificadas;
- taxa de cancelamento.

Total de compromissos, concluídos, futuros, reposições, conflitos e duração total
permanecem indisponíveis e não são renderizados como zero.

## Fluxo vertical

`AgendaCommandCenterPreview` → `useAgendaBI` → `agendaPreviewProvider` →
`getBiAgenda` → `GET /admin/bi/agenda` → normalizador → `createAgendaProvider` →
`adaptAgendaContract` → contrato compartilhado.

O provider realiza uma chamada. O backend executa duas consultas agregadas fixas; não
existe enumeração, N+1 ou agregação de listas no frontend.

## Normalização e segurança

`normalizeAgendaPreviewSource` aceita `unknown`, exige versão `21.12` e
`readOnly: true`, valida métricas finitas e não negativas, datas, arrays, timezone,
warnings e filtros. O resultado permite somente KPIs, distribuição de exceções e série
temporal agregada.

Campos inesperados, linhas operacionais, nomes, identificadores individuais,
descrições, observações e PII não atravessam o normalizador. A API contém somente GET e
não possui fallback para endpoints operacionais de Agenda, aluno, matrícula ou turma.

## Infraestrutura reutilizada

- `PreviewShell`;
- `PreviewField`;
- `PreviewReloadButton`;
- `PreviewStatePanel`;
- `createPreviewQueryOptions`;
- `createBIProvider`, `useBIContract` e `createBIContractEnvelope`;
- registry tipado e feature flag existentes.

O preview foi registrado depois de Turmas. A rota
`/admin/command-center-agenda-preview` usa `ProtectedRoute`, roles `admin` e
`coordenador`, `AppShell` e a feature flag existente.

## Estados

- loading inicial sem valores fictícios;
- refresh com botão desabilitado pela infraestrutura compartilhada;
- empty baseado em KPIs, distribuição e timeline;
- erro inicial seguro com retry;
- erro de refresh não bloqueante e preservação do contrato anterior;
- success exibindo somente métricas disponíveis e datas válidas.

## Performance

A query key é estável, o stale time é de dois minutos e há uma chamada por atualização.
Não há consulta por render, dependência nova, listagem operacional ou cálculo pesado.

## Testes e validações

`agenda-preview.test.mjs` cobre contrato válido/incompatível, payload parcial, KPI
ausente e indisponível, números inválidos, datas, arrays, timezone, warnings, descarte
de PII/linhas, endpoint GET, chamada única, estados, registry e rota protegida.

Também são executados typecheck, lint do Centro de Comando, build client/SSR, testes da
infraestrutura compartilhada, regressões dos previews existentes e testes backend da
fonte BI.

## Limitações e riscos

A fonte representa séries e exceções persistidas; não materializa todos os compromissos.
Zero agregado válido produz estado vazio quando não há distribuição nem timeline, sem
ser tratado como erro. O risco de índices das datas permanece restrito ao backend e está
documentado na Sprint 27.8B.

Próximo passo recomendado: validação funcional do preview com dados agregados reais e,
se necessário, planejamento separado de índices após medição por `EXPLAIN`.
