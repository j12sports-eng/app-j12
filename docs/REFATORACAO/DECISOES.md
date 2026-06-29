# Decisoes Arquiteturais

Registro de decisoes para evolucao do App J12.

## Indice

- [Formato](#formato)
- [ADR-001 - Fonte de Verdade do Banco Atual](#adr-001---fonte-de-verdade-do-banco-atual)
- [ADR-002 - Deploy com Dois Processos PM2](#adr-002---deploy-com-dois-processos-pm2)
- [ADR-003 - Modelo Pessoa como Arquitetura Alvo](#adr-003---modelo-pessoa-como-arquitetura-alvo)
- [ADR-004 - Consolidacao Gradual de Backends](#adr-004---consolidacao-gradual-de-backends)
- [ADR-005 - Documentacao Oficial em docs](#adr-005---documentacao-oficial-em-docs)
- [Links Relacionados](#links-relacionados)

## Formato

Cada decisao deve registrar contexto, decisao, consequencias e status.

## ADR-001 - Fonte de Verdade do Banco Atual

Status: aceita.

Contexto: o codigo atual usa `mysql2`, `backend/src/config/db.js`, SQL direto e tabelas MySQL. Nao ha Prisma nem PostgreSQL no codigo analisado.

Decisao: documentar MySQL como banco operacional atual.

Consequencias:

- Qualquer mencao a PostgreSQL ou Prisma deve ser tratada como alvo futuro ou inconsistencia, nao estado atual.
- Refatoracoes de banco devem partir das tabelas `j12_*`, `users`, `user_sessions`, `financial_payments` e legadas `alunos`/`financeiro`.

## ADR-002 - Deploy com Dois Processos PM2

Status: aceita como estado atual.

Contexto: `ecosystem.config.cjs` e `ecosystem.hml.config.cjs` executam API e frontend SSR como processos separados.

Decisao: manter documentado o modelo `j12-api*` na porta 3001 e `j12-frontend*` na porta 4173.

Consequencias:

- Nginx deve rotear `/api`, `/auth` e `/socket.io` para 3001.
- Trafego de pagina deve ir para 4173.

## ADR-003 - Modelo Pessoa como Arquitetura Alvo

Status: proposta.

Contexto: alunos, responsaveis, professores e usuarios possuem dados pessoais duplicados.

Decisao: planejar `Pessoa` como entidade base futura, especializada em papeis.

Consequencias:

- A migracao deve ser gradual.
- Tabelas atuais continuam funcionando ate backfill validado.

## ADR-004 - Consolidacao Gradual de Backends

Status: proposta.

Contexto: existem `backend/src/server.js`, `server/index.mjs`, `backend/src/app.js`, `server/database.mjs` e rotas legadas.

Decisao: eleger uma entrada oficial e reduzir duplicidade por etapas.

Consequencias:

- Nenhuma rota deve ser removida sem prova de nao uso.
- O mapa de rotas deve ser atualizado antes de consolidar.

## ADR-005 - Documentacao Oficial em docs

Status: aceita.

Contexto: ha documentos soltos na raiz com solucoes pontuais.

Decisao: usar `docs/` como fonte oficial de arquitetura, operacao e refatoracao.

Consequencias:

- Novas decisoes devem entrar neste arquivo.
- Runbooks devem ficar em `docs/DEPLOY`.

## Links Relacionados

- [Roadmap](./ROADMAP.md)
- [Modelo Pessoa](../ARQUITETURA/MODELO_PESSOA.md)
- [VPS](../DEPLOY/VPS.md)

