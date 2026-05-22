# Publicacao Final em `app.j12sports.com.br`

## O que ja foi preparado

O projeto agora possui duas camadas prontas para producao:

1. frontend TanStack Start para publicar na Cloudflare Workers
2. API Node persistente em SQLite para publicar em `api.j12sports.com.br`

Arquivos principais:

- frontend Cloudflare: `wrangler.jsonc`
- backend persistente: `server/index.mjs`
- banco SQLite: `data/j12.sqlite`
- colecoes sincronizadas: `src/lib/remote-collection.ts`

## O que mudou na pratica

Os modulos principais agora salvam em backend centralizado:

- autenticacao com sessoes persistidas em SQLite
- alunos
- professores
- planos
- turmas
- financeiro
- contratos
- aulas experimentais
- configuracoes

O navegador ainda usa `localStorage` apenas para manter o token e a sessao local do usuario.

## Arquitetura recomendada

### `app.j12sports.com.br`

Publicar o frontend na Cloudflare Workers.

### `api.j12sports.com.br`

Publicar a API Node deste repositorio em um servidor Node com HTTPS.

### Banco

O backend atual usa SQLite local em disco.

Para operacao pequena ou interna, isso pode funcionar bem em uma unica maquina ou VPS.
Para crescimento maior, o proximo passo natural e migrar para Postgres ou MySQL.

## Variaveis de producao

Crie `.env.production` com base em `.env.production.example`:

```env
VITE_API_URL=https://api.j12sports.com.br
```

Para a API Node, crie `.env.api.production` com base em `.env.api.production.example`:

```env
NODE_ENV=production
HOST=127.0.0.1
PORT=3001
CORS_ALLOWED_ORIGINS=https://app.j12sports.com.br
HEALTH_SHOW_DETAILS=false
```

## Deploy do frontend

### 1. Login no Cloudflare

```powershell
npx wrangler login
```

### 2. Confirmar o custom domain no `wrangler.jsonc`

O projeto ja esta configurado para publicar em `app.j12sports.com.br`.

### 3. Publicar

```powershell
npm run deploy
```

### 4. Dry run opcional

```powershell
npm run deploy:dry
```

## Deploy da API

O comando da API e:

```powershell
npm run start:api
```

Para producao com PM2:

```powershell
npm run start:api:prod
```

Arquivos de apoio incluidos no repositorio:

- PM2: `ecosystem.config.cjs`
- Nginx: `deploy/nginx/api.j12sports.com.br.conf`
- script Ubuntu: `deploy/server/api-first-deploy-ubuntu.sh`
- env da API: `.env.api.production.example`

Roteiro recomendado de publicacao:

1. subir a pasta do projeto em um VPS ou host Node
2. instalar Node 24+
3. rodar `npm install`
4. criar `.env.api.production`
5. instalar PM2 no servidor com `npm install -g pm2`
6. iniciar a API com `pm2 start ecosystem.config.cjs`
7. persistir o processo com `pm2 save`
8. registrar auto start com `pm2 startup`
9. publicar atras de Nginx ou Caddy
10. apontar `api.j12sports.com.br` para esse servidor

## Exemplo direto para VPS Ubuntu

```bash
cd /var/www/j12-sports-hub-main
npm install
cp .env.api.production.example .env.api.production
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
```

## Exemplo de proxy reverso com Nginx

```nginx
server {
    listen 80;
    server_name api.j12sports.com.br;
    client_max_body_size 4m;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Fluxo tipico no servidor:

```bash
sudo cp deploy/nginx/api.j12sports.com.br.conf /etc/nginx/sites-available/api.j12sports.com.br.conf
sudo ln -s /etc/nginx/sites-available/api.j12sports.com.br.conf /etc/nginx/sites-enabled/api.j12sports.com.br.conf
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d api.j12sports.com.br
```

## Script pronto para a primeira publicacao da API

Se o servidor for Ubuntu e o projeto estiver em `/var/www/j12-sports-hub-main`, voce pode rodar:

```bash
chmod +x deploy/server/api-first-deploy-ubuntu.sh
EMAIL=seu-email@dominio.com APP_DIR=/var/www/j12-sports-hub-main bash deploy/server/api-first-deploy-ubuntu.sh
```

O script:

- instala Nginx e Certbot
- roda `npm install`
- cria `.env.api.production` se ainda nao existir
- instala PM2 se precisar
- sobe a API com `ecosystem.config.cjs`
- publica o Nginx e tenta emitir o SSL

## DNS

Para o custom domain do app funcionar:

1. a zona `j12sports.com.br` precisa estar dentro da Cloudflare
2. `app.j12sports.com.br` nao pode ter um CNAME antigo em conflito
3. `api.j12sports.com.br` precisa apontar para o servidor Node da API

## Proximo passo exato na Cloudflare

### 1. Colocar a zona `j12sports.com.br` dentro da Cloudflare

No painel da Cloudflare:

1. adicione o dominio raiz `j12sports.com.br`
2. revise os registros DNS importados
3. troque os nameservers no registrador pelos nameservers entregues pela Cloudflare
4. aguarde a zona ficar `Active`

### 2. Configurar o `api.j12sports.com.br`

No DNS da Cloudflare, crie:

- tipo `A`
- nome `api`
- conteudo: IP publico do seu VPS
- proxy status: `Proxied`

Se usar IPv6, pode adicionar um `AAAA` tambem.

### 3. Nao criar DNS manual para `app.j12sports.com.br`

Para o frontend, como o Worker esta usando custom domain via `wrangler.jsonc`, o fluxo correto e:

1. garantir que nao exista CNAME antigo para `app`
2. rodar `npm run deploy`
3. deixar a propria Cloudflare criar o registro e o certificado do custom domain

### 4. Ajustar SSL/TLS da zona

Na Cloudflare, use `SSL/TLS > Overview > Full (strict)`.

Isso e o ideal quando sua API em `api.j12sports.com.br` estiver com HTTPS valido no servidor.

### 5. Validar depois do deploy

Verifique:

- `https://app.j12sports.com.br`
- `https://api.j12sports.com.br/health`
- login no app
- `pm2 status` no servidor da API

## Validacoes minimas antes de abrir ao publico

- `https://app.j12sports.com.br` carregando com HTTPS
- `https://api.j12sports.com.br/health` respondendo 200
- login funcionando com usuario real
- criacao e edicao refletindo em navegadores diferentes
- backup do arquivo SQLite ou snapshot do servidor
- `pm2 status` mostrando `j12-api` como `online`

## Riscos e proximo passo recomendado

O backend atual ja e persistente e centralizado, com CORS travado para o app de producao quando `NODE_ENV=production`.
Ainda assim, ele continua usando SQLite nativo do Node.
Para uma operacao mais robusta, o proximo passo recomendado e migrar a API para Postgres ou MySQL e adicionar rotinas de backup, auditoria e recuperacao.

## Referencias oficiais

- Cloudflare custom domains: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- Cloudflare Wrangler config: https://developers.cloudflare.com/workers/wrangler/configuration/
