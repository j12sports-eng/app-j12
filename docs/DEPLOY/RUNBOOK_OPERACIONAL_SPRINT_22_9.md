# Runbook operacional — Sprint 22.9

Este runbook foi preparado por auditoria local. Nenhum comando de VPS, produção, banco, DNS, certificado ou integração externa foi executado. Todo passo mutável exige janela aprovada, operador identificado e evidência anexada ao incidente ou release.

## Arquitetura observada

- Nginx público em 80/443.
- Frontend SSR em `127.0.0.1:4173`, processo PM2 `j12-frontend`.
- API em porta 3001, processo PM2 `j12-api`.
- MySQL externo conforme `.env` do ambiente.
- Configuração de produção: `ecosystem.config.cjs` e `deploy/nginx/app.j12sports.com.br.conf`.

## Pré-requisitos e segurança

1. Registrar operador, ambiente, janela, ticket, branch e hash alvo.
2. Exigir working tree limpo e release previamente validada em HML.
3. Não imprimir `.env`, tokens, chaves, certificados ou URLs com credenciais.
4. Usar usuário de serviço sem login interativo, permissões mínimas e firewall bloqueando 3001/4173 externamente.
5. Armazenar secrets em cofre; montar `.env` e certificados fora do Git com modo 600 e owner do serviço.
6. Rotacionar imediatamente qualquer chave privada que tenha sido versionada. Remover do HEAD não elimina o histórico.
7. Confirmar espaço livre, relógio/NTP, validade TLS e acesso ao backup antes de mudar runtime ou schema.

## Deploy seguro

O script `api-first-deploy-ubuntu.sh` não é compatível com AlmaLinux porque usa `apt-get`. O script SSR também faz mudanças amplas, `npm install`, manipulação de processos/porta e Nginx; não deve ser executado cegamente em produção.

Procedimento recomendado após aprovação:

```bash
export RELEASE_SHA='<hash-aprovado>'
export APP_DIR='/var/www/app-j12'
cd "$APP_DIR"
git status --short
git rev-parse HEAD
git fetch --prune origin
git cat-file -e "$RELEASE_SHA^{commit}"
npm ci --ignore-scripts
npm run build
test -f dist/server/server.mjs
test -d dist/client
```

Antes de qualquer migration, executar o runbook de backup abaixo. Migrations são manuais e não possuem runner canônico; não aplicar DDL até haver inventário, ordem, checksum, responsável e rollback aprovado.

Após build validado, usar release por diretório e symlink atômico, preservando a release anterior. O repositório atual ainda não fornece esse mecanismo. Só então recarregar processos:

```bash
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 status
pm2 describe j12-api
pm2 describe j12-frontend
```

Não usar `kill -9` durante operação normal. Drenar tráfego, enviar SIGTERM, aguardar encerramento e escalar somente após timeout documentado.

## Validação do deploy

Executar de dentro da VPS e depois externamente:

```bash
curl --fail --silent --show-error http://127.0.0.1:3001/health
curl --fail --silent --show-error http://127.0.0.1:4173/
curl --fail --silent --show-error https://app.j12sports.com.br/health
curl --fail --silent --show-error https://app.j12sports.com.br/
pm2 status
pm2 logs j12-api j12-frontend --lines 200 --nostream
sudo nginx -t
```

Limitação atual: o Nginx responde `/health` estaticamente, portanto esse endpoint externo não prova saúde da API. A API retorna HTTP 200 também quando o banco está degradado. Até readiness estrito ser implementado, validar o JSON (`data.status=ok`, `database=ready`, `schemaReady=true`) e falhar o deploy se qualquer campo divergir.

Smoke funcional mínimo em HML: login válido/inválido, dashboard, leitura de alunos, financeiro somente leitura e portais. Não executar Pix, baixa, webhook ou automação real como smoke.

## Detecção de falhas

Sinais mínimos:

- PM2 em `errored`, restart loop ou uso de memória crescente.
- HTTP 5xx/429 anormal, latência elevada ou health degradado.
- falha de conexão/schema do banco;
- expiração TLS próxima;
- disco/inodes cheios;
- ausência de backup recente ou falha de job;
- erros SSR, proxy 502/504 e CORS bloqueado.

O repositório não comprova coletor, dashboard ou canal de alertas implantado. Implantar monitor externo para HTTPS, readiness, certificado e latência; agente para CPU, RAM, disco e processos; e alertas por taxa de 5xx/restarts. Toda regra deve ter owner, severidade, janela, deduplicação e canal testado.

## Logs e rotação

```bash
pm2 logs j12-api j12-frontend --lines 200 --nostream
tail -n 200 logs/j12-api.error.log
tail -n 200 logs/j12-frontend.error.log
journalctl -u nginx --since '30 minutes ago'
```

Os logs atuais usam `console` e arquivos PM2, sem logger estruturado central. `pm2-logrotate` não está comprovado. Se aprovado, instalar/configurar retenção, compressão e tamanho máximo; depois forçar uma rotação em HML e registrar arquivos antes/depois. Não considerar rotação funcional apenas pela configuração.

## Reinício gracioso

A API trata SIGTERM/SIGINT com `server.close`, mas não possui timeout forçado nem encerramento explícito do pool/Socket.IO. O SSR não possui handler de shutdown. Até corrigir e testar:

1. bloquear novas mudanças financeiras e jobs;
2. observar requisições em voo;
3. usar `pm2 reload`, não delete/start;
4. acompanhar logs e tempo de encerramento;
5. reconciliar operações financeiras após qualquer interrupção inesperada.

## Rollback

Critérios: readiness não alcançada, 5xx recorrente, restart loop, corrupção de asset/SSR, erro de migration ou regressão crítica.

1. Parar avanço e registrar hash/horário/sintomas.
2. Se não houve mudança de banco, apontar o symlink para a release anterior validada e `pm2 startOrReload`.
3. Validar health, SSR e smoke read-only.
4. Se houve migration, não executar DOWN automaticamente. Avaliar compatibilidade; restaurar banco somente com aprovação e evidência de backup/restore.
5. Registrar resultado e preservar logs.

`git checkout <hash>` no diretório vivo não é rollback atômico e pode deixar arquivos/dependências misturados. O fluxo por releases ainda é pendência do projeto.

## Backup

Definir RPO/RTO, retenção, criptografia, região/conta separada e responsável. Exemplo somente após aprovação:

```bash
umask 077
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mysqldump --single-transaction --quick --routines --triggers --events \
  --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" --password \
  "$DB_NAME" | gzip > "j12-${STAMP}.sql.gz"
sha256sum "j12-${STAMP}.sql.gz" > "j12-${STAMP}.sql.gz.sha256"
gzip -t "j12-${STAMP}.sql.gz"
sha256sum -c "j12-${STAMP}.sql.gz.sha256"
```

Não passar senha na linha de comando; usar prompt ou arquivo de defaults protegido. Copiar o artefato criptografado para armazenamento externo e registrar hash da aplicação, versão MySQL, tamanho, checksum e contagem esperada de tabelas. `gzip -t` e checksum provam integridade do arquivo, não restaurabilidade lógica.

Backup de configuração deve incluir Nginx, ecosystem, inventário de env sem valores e referências do cofre. Chaves privadas exigem cofre próprio; nunca anexar a tickets ou Git.

## Restore e comprovação

Nunca restaurar por cima da produção como teste. Provisionar MySQL isolado, sem webhooks/jobs e sem acesso de usuários:

```bash
sha256sum -c j12-<timestamp>.sql.gz.sha256
gunzip -c j12-<timestamp>.sql.gz | mysql --defaults-extra-file=/run/secrets/j12-restore.cnf j12_restore
mysqlcheck --defaults-extra-file=/run/secrets/j12-restore.cnf --check j12_restore
```

Comprovação exige, no mínimo:

- restore termina com exit code 0 em banco vazio isolado;
- schema/tabelas/constraints críticas inventariadas;
- contagens e invariantes comparadas com o manifesto do backup;
- aplicação da mesma release sobe apontando somente para o banco restaurado;
- health/readiness e smoke read-only aprovados;
- jobs, e-mail, Pix, Banco Inter, webhooks e n8n permanecem bloqueados;
- duração medida contra RTO e data do backup comparada ao RPO;
- ambiente de restore descartado com aprovação após preservar evidência.

No estado auditado, backup e restore são **não comprovados**: há somente exemplos documentais.

## Certificados

```bash
sudo certbot certificates
sudo certbot renew --dry-run
openssl s_client -connect app.j12sports.com.br:443 -servername app.j12sports.com.br </dev/null
```

Executar apenas na VPS autorizada. O host dedicado `api.j12sports.com.br` possui template HTTP sem TLS e não deve ser publicado assim. Renovação, reload e alarme de expiração precisam de teste registrado.

## Secrets

- Cofre como fonte de verdade; `.env` gerado no host e nunca copiado do Git.
- Permissões 600, diretórios 700, usuário de serviço dedicado.
- Separação HML/produção e menor privilégio no MySQL/provedores.
- Rotação periódica e imediata após exposição.
- Scanning de secrets no pre-commit e CI, inclusive histórico.
- Logs devem mascarar tokens, cookies, credenciais e payloads financeiros.

## Incidente

Preservar timestamp UTC, hash implantado, estado PM2/Nginx, métricas, request ID e logs. Conter primeiro, reconciliar efeitos financeiros antes de retry e comunicar conforme severidade. Nunca usar restore como primeira resposta sem diagnóstico e autorização.
