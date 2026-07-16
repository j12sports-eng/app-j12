# Checklist de Deploy em Produção — J12 Sports

> Documento operacional. Não autoriza deploy, migration, acesso externo ou mudança de infraestrutura. Cada item só pode ser marcado por um operador autorizado, com evidência datada e vinculada à mudança.

## Identificação da mudança

| Campo                                | Valor obrigatório |
| ------------------------------------ | ----------------- |
| Ticket/janela                        |                   |
| Release ID (`YYYYMMDDHHMMSS-gitsha`) |                   |
| SHA completo aprovado                |                   |
| Release anterior                     |                   |
| Operador de aplicação                |                   |
| DBA responsável                      |                   |
| Responsável por infraestrutura       |                   |
| Aprovador GO/NO-GO                   |                   |
| Início/fim planejados                |                   |
| Canal de incidente                   |                   |
| Evidências                           |                   |

## Regras de execução

- [ ] Usar exclusivamente o fluxo AlmaLinux em `deploy/almalinux`; scripts Ubuntu são legados.
- [ ] Não improvisar comandos, não expor secrets e não copiar `.env` para a release.
- [ ] Não executar migration como parte do script de deploy; a janela de banco é separada.
- [ ] Não executar `DOWN`, restore, alteração DNS/TLS/Nginx ou ação financeira sem plano e autorização próprios.
- [ ] Registrar comando, horário, operador, exit code e evidência sanitizada de cada etapa.
- [ ] Declarar NO-GO diante de item obrigatório sem evidência.

## 1. Pré-requisitos de liberação

- [ ] P0 internos zerados e riscos P1 produtivos aceitos formalmente.
- [ ] Checkpoint revisado, commitado, imutável, sem arquivos staged/untracked/modificados.
- [ ] Branch e SHA correspondem à release aprovada; CI remoto do mesmo SHA está verde.
- [ ] Secret Scan, Contracts, Migrations, Security, Backend, Frontend, qualidade e builds passaram.
- [ ] Browser E2E crítico passou em HML equivalente e o artefato está anexado.
- [ ] HML, integrações externas e credenciais produtivas foram homologadas em janelas próprias.
- [ ] Backup recente, checksum, cópia offsite e restore drill estão dentro do RPO/RTO aprovado.
- [ ] Release anterior continua disponível e seu rollback foi ensaiado.
- [ ] Plano de comunicação, observação e contingência possui responsáveis disponíveis.

## 2. Validação da VPS AlmaLinux

- [ ] AlmaLinux 9 confirmado; Node.js 22+, npm, PM2, Nginx, curl, flock, rsync e Git disponíveis.
- [ ] Relógio/NTP, disco, inode, memória e carga possuem margem para build e rollback.
- [ ] Usuário/grupo de serviço dedicados existem e não utilizam login administrativo compartilhado.
- [ ] Layout existe sob `/opt/j12-sports/{releases,shared/{certs,logs,pm2}}`.
- [ ] `/etc/j12-sports/deploy.conf` aponta somente para paths aprovados.
- [ ] Unit PM2 e Nginx estão habilitados e ativos; reinício após boot foi comprovado.
- [ ] Portas 3001/4173 não são públicas e os processos escutam somente em loopback.
- [ ] Nenhuma release concorrente ou lock abandonado existe.
- [ ] O preflight canônico passa integralmente:

```bash
sudo J12_DEPLOY_CONFIG=/etc/j12-sports/deploy.conf \
  bash deploy/almalinux/preflight.sh
```

## 3. PM2

- [ ] `ecosystem.config.cjs` da release é o arquivo aprovado.
- [ ] Processos canônicos são `j12-api` e `j12-frontend`, uma instância em modo fork.
- [ ] API usa `backend/server.js`; SSR usa `scripts/serve-ssr.mjs`.
- [ ] Bind da API e SSR em loopback foi comprovado com inventário de sockets.
- [ ] `kill_timeout` aguarda mais que o timeout máximo de graceful shutdown.
- [ ] Restart, limite de memória, autorestart, logs e `PM2_HOME` compartilhado foram validados.
- [ ] `pm2 save` e unit systemd usam o usuário de serviço correto.
- [ ] SIGTERM/SIGINT sob tráfego foram ensaiados sem perda indevida de requests.

## 4. Nginx e proxy reverso

- [ ] Um único conjunto de virtual hosts canônicos foi definido; templates legados não estão ativos.
- [ ] `app` e `api` redirecionam HTTP para HTTPS.
- [ ] API, auth, Socket.IO, SSR e health apontam para os upstreams corretos em loopback.
- [ ] Headers `Host`, `X-Real-IP`, `X-Forwarded-For` e `X-Forwarded-Proto` são preservados.
- [ ] Upgrade WebSocket e timeouts são compatíveis com a aplicação.
- [ ] Limites de body estão alinhados entre Nginx e Express.
- [ ] Headers de segurança, compressão e cache de assets foram aprovados.
- [ ] A configuração instalada passa antes de qualquer reload:

```bash
sudo nginx -t
```

- [ ] Reload, se autorizado, preserva conexões e tem rollback do arquivo anterior preparado.

## 5. TLS

- [ ] Certificado, chave e cadeia correspondem a cada hostname público.
- [ ] Validade remanescente, SAN, emissor e cadeia completa foram verificados.
- [ ] Chaves pertencem ao owner correto, têm modo 600/640 e não estão no Git/release/logs.
- [ ] Renovação automática e alerta de expiração foram testados.
- [ ] Versões/ciphers aprovados, HSTS e redirecionamento HTTPS foram validados.
- [ ] Certificados históricos potencialmente expostos foram rotacionados/revogados com evidência.

## 6. Firewall e SELinux

- [ ] Firewalld está ativo; apenas HTTP/HTTPS e acessos administrativos aprovados estão liberados.
- [ ] 3001, 4173 e MySQL não estão publicamente expostos.
- [ ] SELinux não está desabilitado.
- [ ] `httpd_can_network_connect` e labels necessários ao proxy/storage foram validados sem política permissiva ampla.
- [ ] Mudanças de firewall/SELinux possuem rollback e evidência separada.

## 7. Variáveis e secrets

- [ ] `.env` produtivo fica em `shared`, fora da release, com modo 600/640.
- [ ] Nenhum valor secreto aparece no ticket, terminal compartilhado, histórico ou logs.
- [ ] `NODE_ENV=production`, host/porta, CORS e URLs pública/interna estão coerentes.
- [ ] `JWT_SECRET`, banco, health token, e-mail e integrações usam valores do cofre aprovado.
- [ ] Aliases de URL (`API_TARGET`, `SSR_API_URL`, `API_BASE_URL`, `VITE_API_URL`) resolvem para destinos coerentes.
- [ ] Timeouts, limites de request, rate limit, força bruta e shutdown têm valores aprovados.
- [ ] Variáveis externas não homologadas permanecem desabilitadas; nenhuma credencial de HML é reutilizada.
- [ ] Validação sanitizada confirma presença/tipo sem imprimir conteúdo.

## 8. Banco e backup

- [ ] Host, porta, database, TLS, usuário de menor privilégio e limite do pool foram aprovados.
- [ ] Conectividade ocorre apenas pela rede autorizada; MySQL não está público.
- [ ] Schema baseline, charset/collation, timezone, espaço e locks foram inventariados.
- [ ] Backup pré-mudança foi criado fora do repositório em storage criptografado:

```bash
node scripts/recovery/j12-recovery.cjs backup \
  --database=<DB_EXATO> \
  --defaults-file=/run/secrets/j12-backup.cnf \
  --output-dir=/var/backups/j12 \
  --storage-encrypted \
  --git-sha=<SHA_APROVADO>
```

- [ ] Artefato e manifesto passaram em `validate`; cópia offsite e retenção foram confirmadas.
- [ ] Restore drill recente em banco descartável comprovou integridade, smoke e RPO/RTO.

## 9. Migrações

- [ ] Catálogo, topologia, dependencies e checksums correspondem ao SHA aprovado.
- [ ] Plano e dry-run offline foram arquivados:

```bash
node backend/src/database/migration-runner/cli.js plan
node backend/src/database/migration-runner/cli.js up --dry-run
```

- [ ] `status` foi executado pelo DBA com nome exato e, para host não local, opt-in explícito.
- [ ] Cada migration foi classificada por duração, lock, espaço, compatibilidade e rollback lógico.
- [ ] Aplicação real possui janela/backup/DBA/aprovação próprios e não é embutida no deploy.
- [ ] `DOWN` automático é proibido; correção forward-only ou restore exige decisão formal.
- [ ] Aplicação e release anterior permanecem compatíveis com o schema resultante.

## 10. Build e preparação da release

- [ ] Source staging é checkout limpo e seu HEAD corresponde ao sufixo da release ID.
- [ ] Lockfile está presente e aprovado.
- [ ] Build ocorre antes da ativação e produz `dist/client` e `dist/server/server.mjs`.
- [ ] Artefatos não carregam `.env`, certificados, dumps ou secrets.
- [ ] Plano de migrations gerado pelo deploy foi revisado antes da liberação de tráfego.

## 11. Execução do deploy

Executar somente após GO formal e substituindo todos os placeholders:

```bash
sudo -u j12 J12_DEPLOY_CONFIG=/etc/j12-sports/deploy.conf \
  bash deploy/almalinux/deploy-release.sh \
  --source=/srv/j12-staging/source \
  --release-id=<YYYYMMDDHHMMSS-GITSHA> \
  --confirm=DEPLOY:<YYYYMMDDHHMMSS-GITSHA>
```

- [ ] Symlink `current` aponta para a release esperada.
- [ ] PM2 executa a release pelo path imutável esperado.
- [ ] O deploy informou `migrations=not-applied`.
- [ ] Smoke interno do script passou; em falha, a release anterior foi restaurada.

## 12. Health e readiness

- [ ] API `/live` retorna 200.
- [ ] API `/ready` retorna 200 somente com bootstrap/schema/banco saudáveis.
- [ ] `/health` externo reflete readiness real e não resposta estática.
- [ ] SSR `/live` e `/ready` retornam 200 com bundles presentes.
- [ ] `/ssr/health` externo reflete readiness SSR.
- [ ] `/internal/health` não é enumerável sem token.
- [ ] Payloads não expõem host, database, stack, secrets ou mensagens internas.

## 13. Observabilidade e monitoramento

- [ ] Request/correlation IDs aparecem ponta a ponta.
- [ ] Logs JSON de HTTP, banco, erro, async e segurança chegam ao destino aprovado.
- [ ] Rotação, retenção, owner, espaço e acesso aos logs estão comprovados.
- [ ] Alertas de 5xx, latência, readiness, PM2, pool, disco, TLS e backup foram testados.
- [ ] Dashboard e canal de incidentes estão acompanhados durante toda a janela.
- [ ] Nenhum log contém token, cookie, senha, payload pessoal ou corpo sensível.

## 14. Rollback imediato preparado

- [ ] Release anterior, seu SHA e compatibilidade de schema estão registrados.
- [ ] Operador sabe executar `docs/DEPLOY/ROLLBACK_RUNBOOK.md`.
- [ ] Confirmação exata e comando de rollback estão preparados, mas não executados preventivamente.
- [ ] Backup pré-mudança está disponível; restore não é confundido com rollback de aplicação.
- [ ] Arquivos anteriores de Nginx/TLS/DNS têm cópia e plano separados.
- [ ] Critérios automáticos de abort/rollback foram acordados.

## 15. Critérios para liberar produção

Marcar **GO** somente quando todos forem verdadeiros:

- [ ] Zero bloqueador P0 e nenhum item obrigatório pendente.
- [ ] Infraestrutura real passou preflight, Nginx, PM2, TLS, firewall e SELinux.
- [ ] Backup/restore e rollback possuem evidência recente dentro do RPO/RTO.
- [ ] Migrations foram decididas e, quando aplicáveis, concluídas/validadas em janela própria.
- [ ] Health/readiness e validação pós-deploy estão verdes.
- [ ] Métricas e logs permaneceram estáveis durante a observação acordada.
- [ ] Negócio, segurança, DBA e infraestrutura assinaram o aceite.

Qualquer resposta negativa resulta em **NO-GO**, preservação de evidências e acionamento do plano de contingência.
