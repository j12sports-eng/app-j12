# Sprint 27.1A — Correção Global do TypeScript

## Objetivo

Restaurar o typecheck global corrigindo os oito erros TypeScript do módulo Campeonatos, sem alterar regras de negócio, contratos públicos, endpoints, payloads ou comportamento visual.

## Estado inicial

- Branch: `sprint-23`.
- Workspace inicialmente limpo e sincronizado com `origin/sprint-23`.
- `npm run build` já passava.
- `npm run typecheck` falhava com oito erros restritos a três arquivos de Campeonatos.
- O preview financeiro da Sprint 27.1 não apresentava erros TypeScript.

## Erros encontrados e causa técnica

### API pública — cinco erros

`withPublicQuery` recebe a união `PublicChampionshipListFilters | PublicPaginationFilters`. O teste de propriedades era feito em `params || {}`, mas o acesso seguinte voltava à variável `params`; por isso, o narrowing do objeto temporário não era preservado. Os erros atingiam `category`, `modality`, `search`, `sortBy` e `sortDirection`.

### API administrativa — dois erros

`withStatisticsQuery` recebe a união `ChampionshipStatisticsFilters | ChampionshipRankingFilters`. A propriedade `type` pertence somente a `ChampionshipRankingFilters`, e o narrowing feito em `params || {}` não era preservado nos acessos posteriores a `params.type`.

### Tabela de classificação — um erro

`ChampionshipStandingViewMode` define os valores canônicos `"overall"` e `"groups"`, mas a tabela interna recebia o literal singular `"group"`.

## Estratégia adotada

- Foi criado um type guard explícito e reutilizável para reconhecer os filtros exclusivos da listagem pública.
- O membro estreitado da união é armazenado em variável local antes da serialização.
- O filtro de ranking é estreitado diretamente pela propriedade exclusiva `type` e armazenado em variável local.
- O modo interno da tabela foi alinhado ao valor canônico `"groups"`.
- Não foram usados `any`, suppressions TypeScript, casts duplos ou alterações de configuração.

## Arquivos alterados

- `src/features/campeonatos/api/championship-public.api.ts`: narrowing seguro dos filtros públicos.
- `src/features/campeonatos/api/championship.api.ts`: narrowing seguro do filtro de ranking.
- `src/features/campeonatos/components/ChampionshipStandingTable.tsx`: alinhamento do literal do modo agrupado.
- `docs/SPRINT_27_1A.md`: documentação desta sprint corretiva.

## Comportamento preservado

- Mesmos endpoints e métodos HTTP.
- Mesmos nomes e valores de query parameters.
- Mesma omissão de valores `undefined`, nulos, vazios ou inválidos.
- Mesma paginação, filtros, ordenação e codificação por `URLSearchParams`.
- Mesma separação entre parâmetros de estatísticas e ranking.
- Mesmo layout, agrupamento, posições, dados, responsividade e acessibilidade da classificação.

## Validações executadas

### Typecheck

`npm run typecheck`: aprovado. O comando `tsc --noEmit` concluiu sem erros.

### Build

`npm run build`: aprovado.

- Client: 3859 módulos transformados; build concluído.
- SSR: 571 módulos transformados; build concluído.
- O Vite reportou apenas avisos preexistentes de imports não utilizados em dependências TanStack durante o SSR, sem falha.

### Testes adicionais

`node --test src/features/campeonatos/tests/*.test.mjs`: 41 testes aprovados, 0 falhas, 0 ignorados.

## Itens não alterados

- Backend, schema, migrations e banco de dados.
- Endpoints e payloads.
- Tipos públicos de filtros.
- Regras de campeonato.
- Configurações TypeScript e scripts do `package.json`.
- Funcionalidades, filtros e comportamento visual.

## Riscos residuais

Não foram identificados riscos funcionais novos. O type guard público considera as propriedades exclusivas da listagem; um objeto contendo somente paginação continua corretamente tratado como paginação compartilhada.

## Relação com a Sprint 27.2

Esta correção remove a dívida de tipagem global que estava pendente após a Sprint 27.1 e restabelece uma base com typecheck, build e testes de Campeonatos aprovados para o início da Sprint 27.2.
