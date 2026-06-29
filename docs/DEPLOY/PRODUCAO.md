# Producao

Runbook do ambiente de producao.

## Indice

- [Resumo](#resumo)
- [Dominio](#dominio)
- [PM2](#pm2)
- [Nginx](#nginx)
- [Deploy](#deploy)
- [Validacao](#validacao)
- [Rollback](#rollback)
- [Links Relacionados](#links-relacionados)

## Resumo

Producao usa `ecosystem.config.cjs` e Nginx `app.j12sports.com.br.conf`.

## Dominio

- `https://app.j12sports.com.br`.
- API dedicada possivel: `api.j12sports.com.br`.

## PM2

- `j12-api`.
- `j12-frontend`.

## Nginx

Encaminha:

- `/api` e `/auth` para `127.0.0.1:3001`.
- `/socket.io` para `127.0.0.1:3001`.
- Demais rotas para `127.0.0.1:4173`.

## Deploy

Produção deve receber somente codigo validado em homologacao.

```bash
git fetch origin
git checkout main
git pull origin main
npm ci
npm run build
pm2 reload ecosystem.config.cjs --update-env
```

## Validacao

- [ ] Hash implantado registrado.
- [ ] `/health`.
- [ ] Login.
- [ ] Dashboard.
- [ ] Cadastro de aluno.
- [ ] Financeiro.
- [ ] Pix se configurado.
- [ ] Logs sem erro 500 recorrente.

## Rollback

```bash
git log --oneline -10
git checkout <hash-anterior>
npm run build
pm2 reload ecosystem.config.cjs --update-env
```

Preferir `git revert` quando houver tempo operacional.

## Links Relacionados

- [Homologacao](./HOMOLOGACAO.md)
- [Backup](./BACKUP.md)
- [Checklist](./CHECKLIST.md)

