# API Backend

Referencia da API Express do App J12.

## Indice

- [Resumo](#resumo)
- [Entradas](#entradas)
- [Formato de Resposta](#formato-de-resposta)
- [Prefixos](#prefixos)
- [Principais Dominios](#principais-dominios)
- [Erros](#erros)
- [Saude](#saude)
- [Links Relacionados](#links-relacionados)

## Resumo

A API atual e Express + MySQL. O codigo usa SQL direto por `mysql2`, sem Prisma. Existem duas entradas relevantes: `backend/src/server.js` e `server/index.mjs`.

## Entradas

- `backend/server.js`: chama `backend/src/server.js`.
- `backend/src/server.js`: API Express local completa, com CORS, Socket.IO, middlewares e rotas.
- `server/index.mjs`: entrada usada nos arquivos PM2 e monta rotas do backend por `createRequire`.

## Formato de Resposta

Padrao desejado nos erros:

```json
{
  "success": false,
  "message": "Mensagem amigavel",
  "code": "INTERNAL_ERROR",
  "requestId": "...",
  "timestamp": "..."
}
```

Na pratica, algumas rotas ainda retornam formatos legados como `{ "message": "..." }`, `{ "error": "..." }` ou arrays diretamente.

## Prefixos

Prefixos suportados:

- Sem prefixo: `/alunos`, `/financeiro`, `/auth`.
- `/api`: usado por browser/producao.
- `/__api`: usado em homologacao pelo frontend em `src/lib/api.ts` e SSR/proxy.

## Principais Dominios

| Dominio | Rotas principais | Fonte |
| --- | --- | --- |
| Auth | `/auth/*`, `/api/auth/*`, `/__api/auth/*` | `backend/routes/auth.js` |
| Alunos | `/alunos`, `/api/alunos` | `backend/src/routes/alunos.routes.js` |
| Financeiro | `/financeiro`, `/api/financeiro` | `backend/src/routes/financeiro.routes.js` + legado |
| Turmas | `/turmas`, `/api/turmas` | `backend/src/routes/turmas.routes.js` |
| Planos | `/planos`, `/api/planos` | `backend/src/routes/planos.routes.js` |
| Professores | `/professores`, `/api/professores` | `backend/src/routes/professores.routes.js` |
| Responsaveis | `/responsavel`, `/responsaveis` | `backend/src/routes/responsaveis.routes.js` |
| Publico | `/public/*`, `/api/public/*` | `backend/src/routes/public.routes.js` |
| Estado remoto | `/state/:collection`, `/api/state/:collection` | `backend/src/routes/state.routes.js` |
| Banco Inter/Pix | `/pix/*`, `/inter/*`, `/webhooks/inter` | `backend/src/routes/inter.routes.js` |

## Erros

`backend/src/server.js` e `server/index.mjs` normalizam erros de banco para 503. Erros inesperados recebem 500. Algumas rotas legadas ainda tratam erro localmente e retornam mensagens diferentes.

## Saude

Endpoints:

- `GET /health`.
- `GET /api/health`.
- `GET /api/test`.

`/health` retorna estado de banco, schema e uptime em `backend/src/server.js`.

## Links Relacionados

- [Rotas](./ROTAS.md)
- [Autenticacao](./AUTENTICACAO.md)
- [Middlewares](./MIDDLEWARES.md)
- [Banco Modelo](../BANCO/MODELO.md)

