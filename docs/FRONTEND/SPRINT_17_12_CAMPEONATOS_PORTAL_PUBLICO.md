# Sprint 17.12 - Frontend - Portal Publico de Campeonatos

## Objetivo

Entregar a Fase B do Portal Publico de Campeonatos, consumindo exclusivamente a API publica da
Sprint 17.12 Fase A.

O portal frontend e somente leitura e nao depende de autenticacao.

## Arquitetura Final

Arquivos principais:

- `src/features/campeonatos/types/championship-public.types.ts`
- `src/features/campeonatos/api/championship-public.api.ts`
- `src/features/campeonatos/hooks/usePublicChampionships.ts`
- `src/features/campeonatos/components/ChampionshipPublicLayout.tsx`
- `src/features/campeonatos/components/ChampionshipPublicCard.tsx`
- `src/features/campeonatos/components/ChampionshipPublicDataViews.tsx`
- `src/features/campeonatos/pages/ChampionshipPublicHomePage.tsx`
- `src/features/campeonatos/pages/ChampionshipPublicDetailsPage.tsx`

O `src/routeTree.gen.ts` foi atualizado pelo gerador local do TanStack Router.

## Rotas Publicas

- `/campeonatos`
- `/campeonatos/$championshipId`

Arquivos:

- `src/routes/campeonatos.tsx`
- `src/routes/campeonatos.$championshipId.tsx`

## API Consumida

Base publica:

- `/api/public/campeonatos`

Funcoes:

- `listPublicChampionships()`
- `getPublicChampionship()`
- `listPublicChampionshipGroups()`
- `listPublicChampionshipTeams()`
- `listPublicChampionshipMatches()`
- `getPublicChampionshipStandings()`
- `getPublicChampionshipBracket()`
- `getPublicChampionshipStatistics()`
- `getPublicChampionshipTopScorers()`

Todas usam:

- `skipAuthHeader: true`
- `skipAuthRedirect: true`
- metodo HTTP `GET`

Nao ha `POST`, `PUT`, `PATCH` ou `DELETE` no cliente publico.

## Hooks

Hooks somente leitura:

- `usePublicChampionships()`
- `usePublicChampionship()`
- `usePublicChampionshipGroups()`
- `usePublicChampionshipTeams()`
- `usePublicChampionshipMatches()`
- `usePublicChampionshipStandings()`
- `usePublicChampionshipBracket()`
- `usePublicChampionshipStatistics()`
- `usePublicChampionshipTopScorers()`

Todos usam React Query com `useQuery`, `retry: 1`, `staleTime` curto e `keepPreviousData` nas
colecoes paginadas.

## Estrutura das Paginas

### `/campeonatos`

Exibe:

- resumo de campeonatos publicados;
- filtros por nome, categoria e modalidade;
- cards de campeonatos publicados;
- estados de loading, empty e error;
- navegacao para `/campeonatos/$championshipId`.

### `/campeonatos/$championshipId`

Exibe:

- dados do campeonato;
- grupos;
- equipes;
- jogos;
- classificacao;
- mata-mata;
- estatisticas;
- artilharia;
- navegacao interna por anchors;
- estados de loading, empty e error por secao.

## Payloads Esperados

### Campeonato

```ts
type PublicChampionship = {
  id: string;
  name: string | null;
  description: string | null;
  category: string | null;
  modality: string | null;
  status: "PUBLISHED";
  startDate: string | null;
  endDate: string | null;
  publishedAt: string | null;
  logo: PublicAsset | null;
};
```

### Colecoes paginadas

```ts
type PublicPaginatedResponse<T> = {
  items: T[];
  limit: number;
  page: number;
  total: number;
};
```

### Jogos

```ts
type PublicMatch = {
  id: string | null;
  home: PublicMatchTeam;
  away: PublicMatchTeam;
  score: { home: number | null; away: number | null };
  matchDate: string | null;
  startTime: string | null;
  status: "SCHEDULED" | "FINISHED" | "POSTPONED" | "CANCELLED" | null;
};
```

## Regras de Negocio no Frontend

- O frontend nao decide se um campeonato e publico; ele confia nos endpoints publicos.
- O frontend nao chama `/api/admin/...`.
- O frontend nao usa `ProtectedRoute` nas paginas publicas.
- O frontend nao usa `useAuth` no portal publico.
- Todos os componentes publicos sao somente leitura.
- Empty states sao exibidos quando cada colecao vem vazia.
- Error states sao exibidos sem redirecionar para login.

## Fluxo de Navegacao

1. Usuario acessa `/campeonatos`.
2. A pagina chama `usePublicChampionships()` e renderiza cards publicados.
3. O card leva para `/campeonatos/$championshipId`.
4. A pagina de detalhe chama os hooks publicos de detalhe e renderiza secoes independentes.
5. O usuario navega pelas secoes via anchors: grupos, equipes, jogos, classificacao, mata-mata,
   estatisticas e artilharia.

## Testes

Arquivo:

- `src/features/campeonatos/tests/championship-public.frontend.test.mjs`

Cobertura:

- hooks publicos;
- contrato de API somente leitura;
- paginas publicas;
- componentes publicos;
- navegacao TanStack Router;
- rotas em `routeTree.gen.ts`;
- ausencia de `ProtectedRoute`, `useAuth`, `useMutation` e chamadas de escrita.

## Decisoes Tecnicas

- Componentes publicos separados dos componentes administrativos para reduzir risco de regressao.
- Uma pagina de detalhe unica exibe todas as secoes do campeonato em modo leitura.
- `ChampionshipPublicDataViews` concentra tabelas e visualizacoes reutilizaveis.
- O layout publico usa tema escuro J12 e link para area restrita apenas como navegacao externa.

## Limitacoes

- Sem escrita publica.
- Sem autenticacao publica.
- Sem upload.
- Sem filtros avancados por fase/status de jogo nesta fase.
- Sem build global na Fase B; o build global e validado na Fase C.

## Validacao da Fase C

Resultados de testes, lint e build ficam registrados no relatorio final da Sprint 17.12.
