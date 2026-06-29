# SSL

Documentacao de certificados e HTTPS.

## Indice

- [Resumo](#resumo)
- [Nginx](#nginx)
- [Lets Encrypt](#lets-encrypt)
- [Banco Inter](#banco-inter)
- [Renovacao](#renovacao)
- [Checklist](#checklist)
- [Links Relacionados](#links-relacionados)

## Resumo

Nginx usa certificados Lets Encrypt para `app.j12sports.com.br` e `hml.app.j12sports.com.br`. Banco Inter usa certificados mTLS configurados por env.

## Nginx

Arquivos apontam para:

- `/etc/letsencrypt/live/app.j12sports.com.br/fullchain.pem`.
- `/etc/letsencrypt/live/app.j12sports.com.br/privkey.pem`.
- `/etc/letsencrypt/live/hml.app.j12sports.com.br/fullchain.pem`.
- `/etc/letsencrypt/live/hml.app.j12sports.com.br/privkey.pem`.

## Lets Encrypt

Configs Nginx liberam:

```text
/.well-known/acme-challenge/
```

para validacao HTTP.

## Banco Inter

Variaveis:

- `INTER_CERT_PATH`.
- `INTER_KEY_PATH`.
- `INTER_CERT`.
- `INTER_KEY`.

Arquivos default em `.env.example`:

- `certs/inter.crt`.
- `certs/inter.key`.

## Renovacao

Processo recomendado:

```bash
sudo certbot renew --dry-run
sudo systemctl reload nginx
```

## Checklist

- [ ] Certificado do app valido.
- [ ] Certificado da hml valido.
- [ ] Chave privada nao versionada.
- [ ] Certificados Banco Inter existem na VPS.
- [ ] Permissoes de leitura restritas.

## Links Relacionados

- [Nginx](./NGINX.md)
- [Backup](./BACKUP.md)
- [Backend API](../BACKEND/API.md)

