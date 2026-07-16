# Runbook Operacional — J12 Sports

> Referência para operadores autorizados. Não autoriza acesso, deploy, migration, restore ou mudança externa. Valores entre `<...>` devem ser substituídos e revisados; nunca copiar secrets para comandos, tickets ou logs.

## 1. Identidade operacional

| Item                                   | Valor a manter fora deste documento público |
| -------------------------------------- | ------------------------------------------- |
| Ticket/canal de mudança                |                                             |
| Incident Commander                     |                                             |
| On-call aplicação                      |                                             |
| On-call infraestrutura                 |                                             |
| DBA                                    |                                             |
| Segurança                              |                                             |
| Negócio/comunicação                    |                                             |
| Provedor VPS/DNS/TLS                   |                                             |
| RPO/RTO aprovados                      |                                             |
| Local das evidências/runbooks privados |                                             |

Contatos pessoais, telefones, credenciais e URLs privadas devem ficar no diretório operacional restrito, não no Git.

## 2. Arquitetura operacional

- SO alvo: AlmaLinux 9.
- Raiz: `/opt/j12-sports`.
- Releases imutáveis: `/opt/j12-sports/releases/<release-id>`.
- Ativa: symlink `/opt/j12-sports/current`.
- Compartilhado: `.env`, `certs`, `logs` e `pm2` sob `shared`.
- Processos: `j12-api` em 3001 e `j12-frontend` em 4173, ambos em loopback.
- Entrada pública: Nginx HTTPS.
- Entrypoints canônicos: `backend/server.js` e `scripts/serve-ssr.mjs`.

## 3. Início da aplicação

Pré-condições: preflight aprovado, release ativa válida, env/certs externos presentes e Nginx válido.

- usar `pm2 startOrReload` pelo ecosystem da release, como faz `deploy/almalinux/lib.sh`;
- executar sob usuário de serviço, `HOME` e `PM2_HOME` compartilhados;
- nunca iniciar `server/index.mjs` legado em produção;
- validar API/SSR readiness antes de aceitar tráfego;
- executar `pm2 save` somente após estabilidade.

Preferir o fluxo de deploy canônico; início manual é contingência aprovada e deve reproduzir exatamente seus parâmetros.

## 4. Parada controlada

1. anunciar manutenção e drenar/remover tráfego conforme procedimento do proxy;
2. pausar jobs/escritas quando aplicável;
3. enviar SIGTERM via PM2 ao processo correto;
4. aguardar readiness 503 e a janela completa de graceful shutdown;
5. confirmar fechamento HTTP, Socket.IO, jobs e pool MySQL;
6. escalar somente após timeout; preservar logs antes de força bruta.

Não usar `kill -9` no fluxo normal. O timeout PM2 deve ser maior que `SHUTDOWN_TIMEOUT_MS`.

## 5. Reinício e reload

- Preferir reload controlado com `--update-env` quando a release/configuração exigir.
- Não alterar env e código simultaneamente sem mudança documentada.
- Confirmar uma única instância de cada processo e paths da release ativa.
- Após restart, validar `/live`, `/ready`, `/health` e `/ssr/health`.
- Se houver loop de restart, interromper tentativa repetitiva, preservar logs e acionar contingência.

## 6. Troca de certificados

1. validar certificado novo, chave correspondente, SANs, cadeia e validade fora do path ativo;
2. confirmar origem, owner e modos 600/640;
3. manter backup seguro do certificado anterior apenas se não comprometido/revogado;
4. substituir os arquivos no diretório compartilhado aprovado;
5. executar `sudo nginx -t`;
6. recarregar Nginx somente com teste válido;
7. validar HTTPS, cadeia, HSTS e alertas de expiração;
8. remover/revogar material antigo conforme política.

Nunca usar HTTP como fallback e nunca restaurar chave historicamente exposta.

## 7. Backup

Pré-requisitos: `mysqldump`, defaults file protegido, storage criptografado fora do repositório, espaço e política offsite.

```bash
node scripts/recovery/j12-recovery.cjs backup \
  --database=<DB_EXATO> \
  --defaults-file=/run/secrets/j12-backup.cnf \
  --output-dir=/var/backups/j12 \
  --storage-encrypted \
  --git-sha=<SHA_ATIVO>

node scripts/recovery/j12-recovery.cjs validate \
  --artifact=<ARTEFATO_ABSOLUTO.sql.gz>
```

Registrar manifesto, checksum, duração, tamanho, release, cópia offsite e resultado. Retenção é dry-run por padrão; `--apply` exige mudança autorizada.

## 8. Restore e drill

Restore operacional regular deve ocorrer primeiro em MySQL isolado, com integrações/jobs bloqueados:

```bash
node scripts/recovery/j12-recovery.cjs drill \
  --artifact=<ARTEFATO_ABSOLUTO.sql.gz> \
  --database=j12_restore_<DATA> \
  --confirm-database=j12_restore_<DATA> \
  --defaults-file=/run/secrets/j12-restore.cnf \
  --rpo-hours=<RPO> \
  --rto-minutes=<RTO>
```

O utilitário recusa banco não descartável. Restore produtivo requer runbook privado do DBA, autorização de incidente, isolamento de writers, snapshot do estado atual, PITR/backup validado e reconciliação de operações.

## 9. Atualização da aplicação

1. concluir `PRODUCTION_DEPLOY_CHECKLIST.md`;
2. preparar source imutável e release ID correspondente ao SHA;
3. executar preflight AlmaLinux;
4. garantir backup/restore e rollback prontos;
5. tratar migrations em janela separada;
6. executar `deploy/almalinux/deploy-release.sh` com confirmação exata;
7. acompanhar build, dry-run, symlink, PM2 e smoke;
8. executar `POST_DEPLOY_VALIDATION.md`;
9. observar métricas e obter aceite formal.

Deploy nunca instala infraestrutura, configura DNS/TLS, aplica migration ou faz backup automaticamente.

## 10. Operação de migrations

- `plan` e `up --dry-run` são offline e não acessam banco.
- `status` e `up` exigem `--confirm-database=<DB_EXATO>`.
- Banco não local exige também `--allow-remote`, que é apenas guarda técnica.
- Exigir backup, DBA, inventário, lock, janela e aprovação antes de `up` real.
- Nunca executar `DOWN` automaticamente.
- Após execução, arquivar ledger/checksums e validar readiness/schema.

## 11. Troubleshooting

### Processo ausente ou reiniciando

- verificar usuário, `PM2_HOME`, release/path, env presente e logs sanitizados;
- verificar memória, disco, porta e exit code;
- não iniciar entrypoint legado;
- se relacionado à release, seguir rollback.

### Readiness 503

- confirmar se o processo está em shutdown;
- verificar bootstrap/schema e probe de banco sem expor credenciais;
- confirmar pool, rede privada, locks e recursos do MySQL;
- não mascarar readiness com resposta estática.

### Liveness indisponível

- verificar processo, socket/listener, CPU/event loop e Nginx;
- separar falha do processo de falha do proxy/TLS/DNS;
- aplicar contingência somente na camada afetada.

### Nginx 502/504

- validar upstream loopback, processo/porta e timeouts;
- executar `nginx -t` antes de qualquer reload;
- verificar SELinux `httpd_can_network_connect` e firewalld;
- preservar configuração anterior e usar rollback Nginx se a causa for mudança recente.

### TLS inválido

- confirmar hostname, SAN, validade, cadeia, chave e relógio;
- não desabilitar verificação TLS nem liberar HTTP;
- acionar renovação/troca controlada.

### Banco indisponível

- verificar alcance privado, TLS, credencial pelo cofre, limite do pool e saúde do servidor;
- não aumentar retries/timeout indiscriminadamente;
- bloquear migrations e escritas arriscadas;
- acionar DBA e plano de continuidade.

### Disco/logs

- identificar crescimento, rotação, artefatos e releases antigas;
- não apagar backup/log/evidência sem política e aprovação;
- retenção de recovery só remove nomes canônicos e deve ser pré-visualizada.

### CORS, proxy ou autenticação

- confirmar hostname/origin exatos, `X-Forwarded-Proto` e env da release;
- não ampliar CORS para `*` em resposta a incidente;
- não logar tokens/cookies para diagnóstico.

## 12. Monitoramento diário

- PM2, restarts, CPU, memória e event loop;
- liveness/readiness, 5xx e p50/p95;
- pool/banco, espaço, locks e backup;
- Nginx, TLS, expiração e DNS;
- filas/jobs/webhooks e integrações habilitadas;
- disco, logs, rotação e alertas;
- eventos de segurança e anomalias de autenticação.

Cada alerta deve ter owner, severidade, deduplicação, canal testado e ação documentada.

## 13. Plano de contingência

| Falha                | Ação inicial                                         | Escalonamento              |
| -------------------- | ---------------------------------------------------- | -------------------------- |
| Release regressiva   | congelar, preservar evidência, rollback de aplicação | aplicação + IC             |
| Banco/schema         | bloquear writes/migrations, preservar estado         | DBA + negócio              |
| Nginx/proxy          | validar upstream e config; rollback da config        | infraestrutura             |
| TLS/DNS              | manter HTTPS seguro; reverter camada específica      | infraestrutura + segurança |
| Integração externa   | desabilitar circuito/automação conforme plano        | owner da integração        |
| Perda/corrupção      | isolar writers, snapshot, avaliar PITR/restore       | DBA + segurança + negócio  |
| Observabilidade cega | não liberar mudança; restaurar visibilidade          | SRE/infraestrutura         |

Rollback detalhado está em `ROLLBACK_RUNBOOK.md`. Não executar restore, alteração DNS ou certificado como reflexo automático de falha de aplicação.

## 14. Comunicação e encerramento

- registrar timeline, impacto, release/SHA e camada afetada;
- comunicar início, atualizações, mitigação e resolução pelos canais aprovados;
- anexar evidências sanitizadas, sem secrets ou PII;
- confirmar reconciliação de dados/operações antes de encerrar;
- abrir ações corretivas com owner e prazo;
- realizar post-mortem para incidentes relevantes.
