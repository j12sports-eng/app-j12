# Publicacao Final em `app.j12sports.com.br`

## Stack de producao

O projeto roda em VPS Linux com Node.js 22+, PM2 e Nginx.

- Frontend: TanStack Start SSR gerado por Vite.
- Runtime do frontend: Node.js + Express em `scripts/serve-ssr.mjs`.
- Backend/API: Node.js + Express em `server/index.mjs`.
- PM2: `ecosystem.config.cjs`.
- Nginx: proxy reverso para `127.0.0.1:4173` e `127.0.0.1:3001`.

Nao ha runtime serverless na producao. O build gera:

- `dist/client`: assets do navegador.
- `dist/server/server.mjs`: entry SSR consumido pelo servidor Node.

## Portas locais

- Frontend SSR: `127.0.0.1:4173`.
- API: `127.0.0.1:3001`.
- Dominio publico: `https://app.j12sports.com.br`.

## Variaveis de producao

Crie `.env.api.production` para a API:

```env
NODE_ENV=production
HOST=127.0.0.1
PORT=3001
CORS_ORIGIN=https://app.j12sports.com.br
```

Para o frontend, se precisar sobrescrever o backend interno:

```env
API_TARGET=http://127.0.0.1:3001
VITE_API_URL=/api
```

## Comandos principais

```bash
npm install
npm run build
npm run start
npm run start:prod
npm run pm2:start
```

## Deploy recomendado na VPS

```bash
cd /var/www/app-j12
npm install
npm run build
pm2 start ecosystem.config.cjs
pm2 save
sudo nginx -t
sudo systemctl reload nginx
```

Para reparar apenas o frontend SSR e aplicar o Nginx do projeto:

```bash
cd /var/www/app-j12
chmod +x deploy/server/frontend-ssr-deploy-ubuntu.sh
APP_DIR=/var/www/app-j12 DOMAIN=app.j12sports.com.br bash deploy/server/frontend-ssr-deploy-ubuntu.sh
```

## Nginx

O template principal esta em:

```text
deploy/nginx/app.j12sports.com.br.conf
```

Ele faz:

- redirect de HTTP para HTTPS;
- proxy de `/` para `http://127.0.0.1:4173`;
- proxy de `/api`, `/auth` e `/socket.io` para `http://127.0.0.1:3001`;
- suporte a WebSocket para Socket.IO.

O certificado esperado e:

```text
/etc/letsencrypt/live/app.j12sports.com.br/fullchain.pem
/etc/letsencrypt/live/app.j12sports.com.br/privkey.pem
```

## Validacoes

Depois do deploy:

```bash
curl -I http://127.0.0.1:4173
curl -I http://127.0.0.1:3001/health
curl -I https://app.j12sports.com.br
pm2 status
pm2 logs j12-frontend
pm2 logs j12-api
```

## Observacoes

O frontend SSR nao deve chamar o proprio dominio publico durante a renderizacao.
Chamadas internas de servidor devem usar `http://127.0.0.1:3001`.
