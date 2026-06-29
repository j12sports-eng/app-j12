# Homologacao

Runbook do ambiente de homologacao.

## Indice

- [Resumo](#resumo)
- [Dominio](#dominio)
- [PM2](#pm2)
- [Nginx](#nginx)
- [Variaveis](#variaveis)
- [Deploy](#deploy)
- [Smoke Test](#smoke-test)
- [Links Relacionados](#links-relacionados)

## Resumo

Homologacao usa `ecosystem.hml.config.cjs`, Nginx `hml.app.j12sports.com.br.conf`, API em 3001 e frontend SSR em 4173.

## Dominio

- `https://hml.app.j12sports.com.br`.
- Variante CORS configurada: `https://www.hml.app.j12sports.com.br`.

## PM2

- `j12-api-hml`.
- `j12-frontend-hml`.

## Nginx

Rotas:

- `/api` e `/api/` para API.
- `/auth/` para API.
- `/socket.io/` para API com WebSocket.
- `/` para frontend SSR.

## Variaveis

`ecosystem.hml.config.cjs` define:

- `NODE_ENV=production`.
- `HOST=127.0.0.1`.
- `PORT=3001`.
- `CORS_ORIGIN=https://hml.app.j12sports.com.br,https://www.hml.app.j12sports.com.br`.
- Frontend com `VITE_API_URL=/__api`.

## Deploy

```bash
git fetch origin
git checkout homolog
git pull origin homolog
npm install
npm run build
pm2 reload ecosystem.hml.config.cjs --update-env
```

## Smoke Test

- [ ] `pm2 status`.
- [ ] `curl http://127.0.0.1:3001/health`.
- [ ] Abrir `https://hml.app.j12sports.com.br`.
- [ ] Login admin.
- [ ] Dashboard.
- [ ] Alunos.
- [ ] Financeiro.
- [ ] Portal aluno/responsavel.
- [ ] Verificar console sem 403 CORS e sem 404 indevido.

## Links Relacionados

- [PM2](./PM2.md)
- [Nginx](./NGINX.md)
- [Checklist](./CHECKLIST.md)

