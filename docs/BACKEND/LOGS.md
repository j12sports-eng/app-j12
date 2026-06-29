# Logs

Padroes atuais e recomendados de logs no backend.

## Indice

- [Resumo](#resumo)
- [Logs Atuais](#logs-atuais)
- [Login](#login)
- [CORS](#cors)
- [Erros](#erros)
- [PM2](#pm2)
- [Riscos](#riscos)
- [Padrao Recomendado](#padrao-recomendado)
- [Links Relacionados](#links-relacionados)

## Resumo

O sistema usa `console.log`, `console.warn` e `console.error`. Parte dos logs ja usa JSON, mas ainda ha logs verbosos e inconsistentes.

## Logs Atuais

- Request logger em `backend/src/server.js`.
- Logger JSON em `server/index.mjs`.
- Logs de banco em `backend/src/config/db.js`.
- Logs de login em `backend/routes/auth.js`.
- Logs de CORS em `backend/src/server.js` e `server/index.mjs`.
- Logs de estado remoto em `backend/src/routes/state.routes.js`.

## Login

Registra:

- request id.
- endpoint.
- usuario informado sem senha.
- horario.
- ambiente.
- etapas do login.

## CORS

Registra:

- Origin recebido.
- Host.
- Referer.
- URL requisitada.
- lista de origens permitidas.
- motivo da rejeicao.

## Erros

Handlers globais logam:

- mensagem.
- stack.
- endpoint.
- request id.
- ambiente.
- status/code.

## PM2

Arquivos configurados:

- `logs/j12-api.out.log`.
- `logs/j12-api.error.log`.
- `logs/j12-frontend.out.log`.
- `logs/j12-frontend.error.log`.
- Versoes `*-hml` em homologacao.

## Riscos

- Logs de stores frontend imprimem token em `src/lib/alunos-api.ts`.
- Rotas de state imprimem body completo.
- Logs com payload financeiro podem expor dados pessoais.

## Padrao Recomendado

```json
{
  "timestamp": "2026-06-28T00:00:00.000Z",
  "level": "info",
  "requestId": "...",
  "module": "auth",
  "event": "login.completed",
  "message": "Login concluido",
  "meta": {}
}
```

## Links Relacionados

- [Middlewares](./MIDDLEWARES.md)
- [PM2](../DEPLOY/PM2.md)
- [Auditoria](../REFATORACAO/AUDITORIA.md)

