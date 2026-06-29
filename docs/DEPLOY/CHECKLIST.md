# Checklist de Deploy

Checklist operacional para deploy do App J12.

## Indice

- [Pre Deploy](#pre-deploy)
- [Banco](#banco)
- [Build](#build)
- [PM2](#pm2)
- [Nginx](#nginx)
- [Smoke Test](#smoke-test)
- [Pos Deploy](#pos-deploy)
- [Links Relacionados](#links-relacionados)

## Pre Deploy

- [ ] Branch correta.
- [ ] `git status --short` limpo ou alteracoes explicadas.
- [ ] Backup definido.
- [ ] `.env` validado.
- [ ] Dependencias instaladas.
- [ ] Hash atual registrado.

## Banco

- [ ] Backup MySQL criado se houver schema/dados.
- [ ] Variaveis `DATABASE_URL` ou `DB_*` conferidas.
- [ ] Usuario e permissoes MySQL validos.
- [ ] `/health` retorna banco pronto apos deploy.

## Build

- [ ] `npm run build`.
- [ ] Sem erro TypeScript/Vite.
- [ ] Assets em `dist/`.

## PM2

- [ ] Config correta: hml ou producao.
- [ ] `pm2 reload ... --update-env`.
- [ ] `pm2 status` sem restart loop.
- [ ] Logs revisados.

## Nginx

- [ ] `nginx -t`.
- [ ] `systemctl reload nginx`.
- [ ] `/api` roteia para API.
- [ ] `/socket.io` funciona.
- [ ] HTTPS valido.

## Smoke Test

- [ ] Login valido.
- [ ] Login invalido retorna 401.
- [ ] Dashboard carrega.
- [ ] Alunos carrega.
- [ ] Financeiro carrega.
- [ ] Portais aluno/responsavel carregam.
- [ ] Console sem CORS indevido.

## Pos Deploy

- [ ] Hash novo registrado.
- [ ] Equipe avisada.
- [ ] Logs monitorados por 15 minutos.
- [ ] Rollback pronto se necessario.

## Links Relacionados

- [VPS](./VPS.md)
- [PM2](./PM2.md)
- [Nginx](./NGINX.md)
- [Backup](./BACKUP.md)

