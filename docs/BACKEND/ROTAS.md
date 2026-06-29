# Rotas Backend

Mapa consolidado das rotas Express observadas.

## Indice

- [Entradas](#entradas)
- [Mapa por Dominio](#mapa-por-dominio)
- [Rotas Publicas](#rotas-publicas)
- [Rotas Protegidas](#rotas-protegidas)
- [Rotas Legadas](#rotas-legadas)
- [Pontos de Atencao](#pontos-de-atencao)
- [Links Relacionados](#links-relacionados)

## Entradas

- `backend/src/server.js`: monta rotas via `mount`.
- `server/index.mjs`: monta `routeDefinitions`.
- `backend/src/app.js`: app menor focado em Banco Inter, aparentemente legado.

## Mapa por Dominio

| URL base | Modulo | Observacao |
| --- | --- | --- |
| `/auth`, `/api/auth`, `/__api/auth` | `backend/routes/auth.js` | Login e sessao |
| `/alunos`, `/api/alunos` | `backend/src/routes/alunos.routes.js` | CRUD e listagem por turma |
| `/aluno/me`, `/api/aluno/me` | `backend/routes/aluno-me.js` | Portal aluno legado/compat |
| `/aluno` | `server/routes/aluno.mjs` | Rota isolada de financeiro aluno |
| `/financeiro`, `/api/financeiro` | `backend/src/routes/financeiro.routes.js` | Admin/aluno e delegacao para legado |
| `/modalidades`, `/api/modalidades` | `backend/src/routes/modalidades.routes.js` | Cadastro |
| `/planos`, `/api/planos` | `backend/src/routes/planos.routes.js` | Cadastro |
| `/professores`, `/api/professores` | `backend/src/routes/professores.routes.js` | Cadastro |
| `/responsaveis`, `/responsavel` | `backend/src/routes/responsaveis.routes.js` | Cadastro e portal responsavel |
| `/state`, `/api/state` | `backend/src/routes/state.routes.js` | Snapshots JSON |
| `/turmas`, `/api/turmas` | `backend/src/routes/turmas.routes.js` | Cadastro |
| `/unidades`, `/api/unidades` | `backend/src/routes/unidades.routes.js` | Cadastro |
| `/public`, `/api/public` | `backend/src/routes/public.routes.js` | Matricula publica e catalogos |
| `/pix`, `/inter`, `/webhooks/inter` | `backend/src/routes/inter.routes.js` | Banco Inter |

## Rotas Publicas

- `GET /public/enrollments/next-number`.
- `POST /public/enrollments`.
- `GET /public/address/lookup`.
- `GET /public/modalidades`.
- `GET /public/unidades`.
- `GET /public/turmas`.
- `GET /public/horarios`.

## Rotas Protegidas

Rotas administrativas geralmente usam `requireAuth` e `canManageSystem`. Portais usam `requireAuth` e escopo por aluno/responsavel.

## Rotas Legadas

- `backend/routes/financeiro.js`: ainda ativo via `router.use("/", legacyFinanceiroRoutes)`.
- `backend/src/routes/auth.routes.js`: nao deve ser usado sem revisao por conter segredo hardcoded.
- `server/database.mjs`: backend SQLite legado, nao e fonte de verdade atual.
- `src/routes/-financeiro.routes.js` e `src/routes/-backend-aluno.routes.js`: arquivos com prefixo `-`, possivelmente nao integrados ao TanStack Router.

## Pontos de Atencao

- `GET /alunos/:id` esta comentado.
- Existem rotas montadas com e sem `/api`.
- O frontend usa `/__api` em homologacao.
- O mapa deve ser revalidado apos consolidar bootstrap.

## Links Relacionados

- [API](./API.md)
- [Servicos](./SERVICOS.md)
- [Auditoria](../REFATORACAO/AUDITORIA.md)

