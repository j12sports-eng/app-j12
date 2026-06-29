# Backup

Estrategia de backup operacional.

## Indice

- [Objetivo](#objetivo)
- [Itens Criticos](#itens-criticos)
- [Banco MySQL](#banco-mysql)
- [Ambiente](#ambiente)
- [Certificados](#certificados)
- [Restore](#restore)
- [Checklist](#checklist)
- [Links Relacionados](#links-relacionados)

## Objetivo

Garantir recuperacao de dados, configuracoes e certificados em caso de falha de deploy, banco ou servidor.

## Itens Criticos

- Banco MySQL.
- `.env` da VPS.
- Certificados Banco Inter.
- Certificados Lets Encrypt.
- Hash Git implantado.
- Configs Nginx e PM2.

## Banco MySQL

Comando exemplo:

```bash
mysqldump -h <host> -u <user> -p <database> > backup-j12-$(date +%F-%H%M).sql
```

Validar se o dump contem tabelas `j12_*`, `users`, `user_sessions`, `financial_payments` e legadas.

## Ambiente

Nunca versionar `.env`. Guardar backup em cofre ou local seguro.

## Certificados

- `certs/inter.crt`.
- `certs/inter.key`.
- `/etc/letsencrypt/live/*`.

## Restore

```bash
mysql -h <host> -u <user> -p <database> < backup.sql
pm2 reload ecosystem.hml.config.cjs --update-env
```

Sempre testar restore em homologacao antes de producao.

## Checklist

- [ ] Backup criado antes de migration.
- [ ] Backup armazenado fora da VPS.
- [ ] Restore testado periodicamente.
- [ ] Acesso restrito.
- [ ] Hash do codigo associado ao backup registrado.

## Links Relacionados

- [VPS](./VPS.md)
- [Migracoes](../BANCO/MIGRACOES.md)
- [Checklist Deploy](./CHECKLIST.md)

