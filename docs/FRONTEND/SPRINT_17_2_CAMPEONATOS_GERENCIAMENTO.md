# Sprint 17.2 - Frontend do Gerenciamento de Campeonatos

## Objetivo

Concluir a tela administrativa de Campeonatos para gerenciamento do cadastro e ciclo de vida do campeonato.

## Alteracoes

- A pagina `/admin/campeonatos` permite criar e editar campeonatos.
- Os cards administrativos permitem publicar, arquivar e remover.
- O formulario e reutilizado para criacao e edicao.
- As metricas da tela exibem total, publicados, rascunhos e arquivados.
- React Query ganhou mutacoes dedicadas para publicar e arquivar.
- Tipos frontend possuem `ChampionshipLogo` para consumir metadados futuros de logo.
- Tipos frontend possuem contrato preparado para escudo/logo de equipe e comissao tecnica futura.

## Logo

Nao ha controle de upload real de logo na tela.

A estrutura de tipo foi preparada para receber referencias futuras retornadas pela API, mas o envio de arquivos fica para uma sprint posterior com o modulo de armazenamento consolidado.

## Equipes e comissao tecnica

`ChampionshipTeam` e `ChampionshipTeamCommissionMember` existem apenas como tipos de contrato. Nao ha tela, upload, formulario ou CRUD especifico para comissao tecnica nesta sprint.

## Protecao

A rota frontend continua protegida por `ProtectedRoute roles={["admin", "coordenador"]}`.

O backend permanece como fonte final de autorizacao com `requireAuth + canManageSystem`.
