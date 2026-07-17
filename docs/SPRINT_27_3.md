# Sprint 27.3 — Infraestrutura Compartilhada do Centro de Comando

## Objetivo e baseline

Extrair infraestrutura reutilizável dos previews existentes sem adicionar módulos, alterar contratos públicos ou modificar o comportamento funcional do Preview Financeiro.

Baseline na branch `sprint-23`:

- worktree limpo;
- `npm run typecheck` aprovado;
- build client aprovado com 3860 módulos;
- build SSR aprovado com 572 módulos.

## Arquitetura encontrada

O Centro de Comando já possuía abstrações compartilhadas consolidadas para:

- `BIContractEnvelope` e tipos de filtros, metadados e KPIs;
- `BIAdapterInput` e criação de envelopes read-only;
- `BIProvider` e injeção tipada de loaders;
- `useBIContract` e estado React Query;
- shells, estados e cards dos widgets oficiais do dashboard.

O preview financeiro mantinha localmente quatro elementos neutros — shell, painel de estado, botão de recarga e card de metadados — e repetia a construção das opções de query. O normalizer e o provider financeiros são específicos do domínio e permaneceram isolados.

## Componentes e infraestrutura extraídos

### Componentes

- `PreviewShell`: limite visual base com eyebrow, título, descrição e conteúdo.
- `PreviewStatePanel`: painel acessível para loading, empty e error.
- `PreviewReloadButton`: recarga com bloqueio durante fetching e indicação visual.
- `PreviewField`: card compacto para metadados técnicos do contrato.

### Abstrações

- `PreviewReloadHandler`: assinatura comum para callbacks síncronos ou assíncronos.
- `CommandCenterPreviewDefinition`: definição tipada de um preview registrável.
- `createPreviewQueryOptions`: chave-base e defaults compartilhados para React Query.
- `createCommandCenterPreviewRegistry`: registro imutável com `get` e `list`.
- `commandCenterPreviewRegistry`: registro inicial contendo apenas o preview financeiro já existente.

Os exports foram centralizados em `preview/index.ts` para permitir que futuros previews usem a infraestrutura sem importar detalhes internos.

## Duplicações eliminadas

Foram removidas do `FinancialCommandCenterPreview` as implementações privadas de:

- `PreviewShell`;
- `StatePanel`;
- `ReloadButton`;
- `PreviewField`;
- objeto inline de opções React Query.

O componente financeiro agora contém somente composição, textos e decisões específicas do seu fluxo. Providers, adapters, hook, normalizer, contratos, contagens e estados permanecem os mesmos.

## Impacto e compatibilidade

- nenhuma alteração no backend, banco, schema ou migrations;
- nenhuma alteração em API, endpoint ou método HTTP;
- nenhum contrato público modificado;
- nenhuma regra financeira movida ou reimplementada;
- mesmas condições de loading, refresh, empty, error e success;
- mesmos textos, classes, acessibilidade, botão e callback de refetch;
- mesmas opções efetivas: query key, retry, stale time e refetch on focus;
- registro apenas arquitetural, sem nova rota ou novo módulo funcional.

## Testes

Os testes do Centro de Comando cobrem:

- normalização e estados do preview financeiro;
- callback do botão compartilhado;
- query keys e overrides compartilhados;
- registro e identidade dos componentes;
- composição do financeiro pela infraestrutura extraída;
- ausência das antigas implementações locais.

Também são executados lint do módulo, typecheck global e builds client/SSR.

Resultados finais:

- `npm run lint:command-center`: aprovado;
- `npm run typecheck`: aprovado, zero erros;
- testes do Centro de Comando: 8 aprovados, 0 falhas;
- `npm run build`: client aprovado com 3868 módulos e SSR aprovado com 580 módulos;
- `git diff --check`: aprovado.

## Próximos módulos preparados

A infraestrutura aceita futuros previews de alunos, turmas, professores, arena, campeonatos, comunicação e portais. A Sprint 27.3 não registra nem integra esses módulos; cada integração futura deverá fornecer seu provider, normalizer específico, contrato e critérios de empty sem alterar a base visual compartilhada.
