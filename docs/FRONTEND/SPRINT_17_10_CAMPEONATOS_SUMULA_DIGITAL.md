# Sprint 17.10 - Frontend - Sumula Digital

## Objetivo

Adicionar a tela administrativa de sumula digital em
`/admin/campeonatos/$championshipId/jogos/$matchId/sumula`, acessada pela lista de jogos dentro de
Rodadas.

## Hooks

Arquivo `src/features/campeonatos/hooks/useMatchReport.ts`:

- `useMatchReport()`
- `useCreateMatchReport()`
- `useUpdateMatchReport()`
- `useOpenMatchReport()`
- `useFinalizeMatchReport()`
- `useReopenMatchReport()`
- `useMatchEvents()`
- `useCreateMatchEvent()`
- `useUpdateMatchEvent()`
- `useDeleteMatchEvent()`

As mutacoes invalidam o cache da sumula. A finalizacao tambem invalida rodadas e classificacao do
campeonato.

## API

Funcoes adicionadas em `src/features/campeonatos/api/championship.api.ts`:

- `getMatchReport()`
- `createMatchReport()`
- `updateMatchReport()`
- `openMatchReport()`
- `createMatchReportEvent()`
- `updateMatchReportEvent()`
- `deleteMatchReportEvent()`
- `finalizeMatchReport()`
- `reopenMatchReport()`

## Componentes

Componentes adicionados:

- `ChampionshipMatchReportForm.tsx`
- `ChampionshipMatchEventsList.tsx`
- `ChampionshipGoalForm.tsx`
- `ChampionshipCardForm.tsx`
- `ChampionshipSubstitutionForm.tsx`
- `ChampionshipMatchTimeline.tsx`

## Pagina e Rota

Pagina:

- `src/features/campeonatos/pages/ChampionshipMatchReportPage.tsx`

Rota:

- `src/routes/admin/campeonatos.$championshipId.jogos.$matchId.sumula.tsx`

## Interface

A tela permite:

- criar sumula quando ainda nao existe
- editar arbitro, assistente, anotador e observacoes
- abrir partida
- registrar gols
- registrar cartao amarelo
- registrar cartao vermelho
- registrar faltas
- registrar tempo tecnico
- registrar observacoes
- registrar W.O.
- registrar substituicoes
- editar minuto, periodo e descricao de eventos
- remover eventos
- finalizar com placar oficial
- reabrir sumula finalizada

## Estados

Estados tratados:

- carregamento com `SkeletonDashboard`
- erro com mensagem formatada por `formatApiErrorMessage`
- sumula ainda nao criada
- linha do tempo vazia
- lista de eventos vazia
- botoes desabilitados durante mutacoes
- bloqueio visual de edicao quando a sumula esta finalizada

## Navegacao

Foi adicionada a acao `Sumula` em `ChampionshipRoundList`, dentro de cada jogo da pagina de
Rodadas. Nao foi criado menu paralelo.

## Testes

Arquivo adicionado:

- `src/features/campeonatos/tests/championship-match-reports.frontend.test.mjs`

Cenarios cobertos:

- hooks React Query da sumula
- pagina e rota dedicada
- componentes de dados da sumula, eventos, gol, cartoes/faltas/W.O., substituicao e linha do tempo
- endpoints REST da sumula
- tipos frontend de sumula e eventos
- ausencia de escopos futuros como rankings, estatisticas e portal publico

## Fora do Escopo

Nao foram implementados nesta sprint:

- estatisticas e rankings
- portal publico
- notificacoes automaticas
- integracoes externas
- novas telas publicas
