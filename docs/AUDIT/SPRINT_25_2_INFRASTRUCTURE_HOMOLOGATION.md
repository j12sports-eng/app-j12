# Sprint 25.2 — Homologação da Infraestrutura

Data: 2026-07-16  
Branch: `sprint-23`  
HEAD: `37928bb4e28407e7a58c37eee70880b8be1157bc`  
Escopo: auditoria local, sem implementação e sem acesso externo  
Resultado: **NO-GO para produção**  
Execução da Sprint 25.2: **100%**

## 1. Resumo executivo

A infraestrutura disponível no repositório possui uma base consistente: composição canônica API/SSR sob PM2, health/readiness/liveness, graceful shutdown, templates Nginx, deploy e rollback atômicos para AlmaLinux 9, scanner de secrets, logs estruturados e automação protegida de backup/restore. Os contratos locais, testes, builds e verificações de qualidade passaram.

Mesmo assim, a infraestrutura **não está homologada para produção**. A auditoria encontrou bloqueadores de código/configuração e, principalmente, ausência de evidência operacional no host real. Não foram executados deploy, `nginx -t`, reload, PM2, systemd, TLS, firewall, SELinux, backup ou restore reais, porque a Sprint proíbe acesso a VPS, HostGator e ambiente externo.

Bloqueadores principais:

1. O checkpoint está sujo e o deploy atômico exige source checkout limpo e imutável.
2. A API usa `HOST=0.0.0.0` por padrão; o ecosystem não força loopback, divergindo da documentação e ampliando exposição se o firewall falhar.
3. O graceful shutdown aceita até 15 s, mas o ecosystem não define `kill_timeout`; não há evidência de que PM2 aguarde a drenagem completa.
4. O template `api.j12sports.com.br` expõe apenas porta 80, sem TLS nem redirect para HTTPS.
5. TLS do app existe apenas como template; certificados, renovação, cadeia e validade não foram comprovados.
6. Backup e restore possuem bons contratos, mas nunca foram comprovados com MySQL descartável e ferramentas reais.
7. Não há template de variáveis de produção completo e canônico; os exemplos são orientados a desenvolvimento e divergem do runtime atual.

## 2. Checkpoint Git

| Item                       | Resultado                                                        |
| -------------------------- | ---------------------------------------------------------------- |
| Branch                     | `sprint-23`                                                      |
| HEAD                       | `37928bb4e28407e7a58c37eee70880b8be1157bc`                       |
| Origin local               | `origin/sprint-23`, divergência `0 atrás / 0 à frente`           |
| Último commit              | `37928bb docs(23.12): registra decisao final no-go da sprint 23` |
| Working tree               | Sujo e preservado                                                |
| Staging                    | Vazio                                                            |
| `git diff --check` inicial | PASS; avisos LF/CRLF não bloqueantes                             |

Foram executados somente comandos Git locais. Não houve `fetch`, pull, push, merge, rebase, commit ou contato com o remoto.

O checkpoint continha 27 arquivos rastreados modificados e arquivos não rastreados das Sprints 23/24. Nenhum foi revertido, removido, staged ou alterado pela Sprint 25.2.

## 3. Infraestrutura auditada

| Área                      | Evidência local                                       | Estado                           |
| ------------------------- | ----------------------------------------------------- | -------------------------------- |
| PM2                       | `ecosystem.config.cjs` e contratos                    | Parcial                          |
| Start/restart             | npm scripts, ecosystem, `startOrReload`               | Parcial                          |
| Stop/shutdown             | coordenador compartilhado e sinais                    | Parcial                          |
| Health/readiness/liveness | API, SSR, Nginx e testes                              | PASS local                       |
| Nginx/proxy               | templates app, API e HML                              | Parcial                          |
| TLS                       | paths Let's Encrypt no template app/HML               | Não comprovado                   |
| Headers/cache             | Nginx, SSR e middleware da API                        | Parcial                          |
| Gzip                      | nenhuma configuração explícita encontrada             | Ausente/não comprovado           |
| Variáveis                 | `.env.example`, `backend/.env.example`, deploy config | Parcial                          |
| Logs/observabilidade      | PM2 files e logger JSON                               | PASS local com ressalvas         |
| CORS                      | allowlist configurável e testes                       | PASS local                       |
| Uploads                   | limites Nginx/body; sem storage persistente canônico  | Não homologado                   |
| Deploy/rollback           | fluxo AlmaLinux atômico e testes                      | PASS contratual; não operacional |
| Backup/restore            | automação, guardas e testes                           | PASS contratual; não operacional |
| Permissões                | preflight de owner e modos 600/640                    | PASS contratual; não operacional |
| Documentação              | Sprints 23.8–24.6 e runbooks                          | Parcialmente coerente            |

## 4. PM2

### Pontos aprovados

- Dois processos: `j12-api` e `j12-frontend`.
- Entrypoint canônico da API: `backend/server.js`.
- SSR usa `scripts/serve-ssr.mjs` e bind explícito `127.0.0.1:4173`.
- `fork`, uma instância, autorestart, limite de reinícios e delay configurados.
- Logs stdout/stderr separados, mesclados por processo e com timestamp.
- Frontend possui `max_memory_restart: 512M`.
- Deploy usa `pm2 startOrReload --update-env` e `pm2 save` em `PM2_HOME` compartilhado.
- Preflight exige unit systemd PM2 ativa e habilitada.

### Divergências e riscos

- API não recebe `HOST=127.0.0.1`; seu default é `0.0.0.0`.
- `kill_timeout` não está configurado. O shutdown interno usa 15 s e o config operacional sugere 20 s, mas esse valor não é propagado ao ecosystem.
- `listen_timeout`, `wait_ready` e sinal explícito não estão configurados; readiness é usada pelo smoke após reload, mas não como handshake PM2.
- API não possui limite de memória equivalente ao frontend.
- Não há rotação/retenção de logs configurada; a documentação atribui isso ao host.
- PM2/systemd reais, startup após reboot, restart, reload e comportamento sob crash não foram testados.

Estado: **NÃO HOMOLOGADO OPERACIONALMENTE**.

## 5. Nginx

### Template do app

- Redireciona HTTP para HTTPS.
- Configura TLS e HTTP/2.
- Encaminha `/health` para API `/ready`, `/live` para liveness e `/ssr/health` para SSR readiness.
- Encaminha API, auth, WebSocket e SSR para loopback.
- Preserva Host, IP e `X-Forwarded-*`.
- Configura upgrade WebSocket, timeouts de 60 s e `client_max_body_size 10m`.
- Adiciona `nosniff` e referrer policy.

### Divergências

- `deploy/nginx/api.j12sports.com.br.conf` possui somente `listen 80`, sem TLS, HTTP→HTTPS, WebSocket, health dedicado ou headers adicionais.
- Gzip/Brotli não aparece nos templates auditados.
- Cache de assets não é configurado no Nginx; o SSR aplica `public, max-age=2592000, immutable` apenas a `/assets/`.
- O app Nginx adiciona somente dois headers. A API adiciona hardening no middleware, mas páginas SSR dependem dos headers emitidos pelo frontend/Nginx.
- Não há OCSP stapling, parâmetros TLS explícitos, renovação ou teste de expiração documentados no template.
- `nginx -t`, reload e tráfego real não foram executados.

Estado: **NO-GO** até definir qual virtual host é canônico, eliminar exposição HTTP indevida e validar a configuração no host.

## 6. Health

- API expõe `/live`, `/ready`, `/health` e aliases `/api/*`.
- `/health` permanece alias de readiness para compatibilidade.
- Endpoint interno exige `HEALTH_INTERNAL_TOKEN` e responde 404 quando indisponível/inválido.
- SSR expõe `/live`, `/ready` e `/health`.
- Nginx externo não mascara a API: `/health` aponta para `/ready`.
- Payloads públicos omitem host, banco, stack, mensagem interna e secrets.

Testes locais de integração/contrato passaram. Estado: **PASS LOCAL**.

## 7. Readiness

API exige bootstrap, schema, probe de banco e ausência de shutdown. SSR exige os bundles Client/Server e ausência de shutdown. Integrações opcionais não participam do probe, evitando chamadas externas em health.

Ressalva: nenhum probe foi executado contra a infraestrutura real. A readiness prova dependências internas quando o processo está ativo, mas não comprova TLS, Nginx, disco, espaço, certificado, DNS ou serviços do host.

Estado: **PASS LOCAL / NÃO COMPROVADO EM PRODUÇÃO**.

## 8. Graceful Shutdown

### Implementação validada

- Handlers one-shot para SIGTERM e SIGINT na API e SSR.
- Estado `shuttingDown` derruba readiness.
- Fecha HTTP e conexões ociosas.
- Fecha Socket.IO e jobs em paralelo.
- Finaliza pool MySQL após drenagem.
- Timeout força conexões HTTP e retorna exit code 1.
- Chamadas concorrentes compartilham uma Promise.

### Riscos

- O arquivo usa `timeoutId` sem declaração lexical dentro de `performShutdown`, criando estado global implícito em CommonJS. Execuções simultâneas em um mesmo processo poderiam interferir; os testes atuais não cobrem essa condição.
- PM2 não possui `kill_timeout` alinhado aos 15 s do runtime.
- O config de deploy define `J12_SHUTDOWN_TIMEOUT_SECONDS=20`, mas o ecosystem/runtime não consome essa variável.
- Não houve teste sob tráfego, WebSocket ativo, query longa ou reinício real do PM2.

Estado: **PASS FUNCIONAL LOCAL, NO-GO OPERACIONAL**.

## 9. Variáveis

### Pontos aprovados

- Deploy exige `.env` externo sob `shared`, com owner correto e modo 600/640.
- Certificados/chaves também exigem modo 600/640.
- Secrets não são copiados para releases.
- Secret Scan passou com zero achados.
- JWT falha fechado sem secret canônico forte.

### Divergências

- `.env.example` raiz e `backend/.env.example` usam `NODE_ENV=development` e valores locais.
- `backend/.env.example` contém host e usuário específicos de um ambiente, embora a senha seja placeholder.
- Não existe exemplo de produção completo e canônico cobrindo `HOST`, `PORT`, `SHUTDOWN_TIMEOUT_MS`, `HEALTH_INTERNAL_TOKEN`, `REQUEST_LIMIT`, DB SSL, limites de segurança, observabilidade e retenção.
- O ecosystem define CORS de produção/HML diretamente e mistura as duas origens no processo de produção.
- Existem aliases de URL da API (`API_TARGET`, `SSR_API_URL`, `API_BASE_URL`, `VITE_API_URL`), aumentando risco de configuração divergente.

Estado: **NÃO HOMOLOGADO**.

## 10. Segurança

- Secret Scan: PASS, 1.667 arquivos e zero findings.
- Security: PASS, 34/34.
- Headers, cache `no-store`, rate limiting, força bruta e auditoria estruturada estão cobertos.
- CORS usa allowlist configurável no runtime canônico.
- Preflight exige firewalld, HTTP/HTTPS e proíbe portas 3001/4173 públicas.
- SELinux não pode estar desabilitado e deve permitir proxy Nginx.
- Source deploy deve estar limpo, release ID deve corresponder ao HEAD e confirmações são exatas.

Riscos:

- Bind API em `0.0.0.0` cria dependência excessiva de firewalld.
- Virtual host API sem TLS permite transporte HTTP se instalado como está.
- Stores de rate limit/força bruta são locais por processo.
- Certificados e permissões reais não foram inspecionados.
- O harness de testes carrega `.env` local e imprime metadados de um host remoto ao instanciar o pool lazy. Não houve evidência de conexão/query, mas a suíte não é hermética por construção.

Estado: **PASS DE CÓDIGO / NO-GO DE INFRAESTRUTURA**.

## 11. Observabilidade

- Structured Logger JSON com INFO/WARN/ERROR, correlation ID, request ID e sanitização.
- HTTP, erro, banco e operações assíncronas possuem eventos padronizados.
- PM2 direciona stdout/stderr para storage compartilhado entre releases.
- Health e readiness fornecem sinais básicos para smoke.

Ausências:

- Sem coletor, métricas, tracing distribuído, dashboard ou alertas externos.
- Sem rotação/retenção comprovada de logs.
- Sem monitoramento de disco, certificado, PM2, fila, latência, 5xx, backup e RPO/RTO implementado no repositório.
- Logs do SSR ainda usam console textual e podem incluir corpo truncado de respostas 5xx, o que requer revisão de privacidade operacional.

Estado: **PARCIAL**.

## 12. Deploy

O fluxo AlmaLinux é seguro por contrato:

- preflight de SO, Node, Nginx, systemd, SELinux, firewall, paths e permissões;
- source limpo/imutável e release ID ligado ao SHA;
- lock com `flock`;
- `rsync` sem Git, env, certs, logs, dependências ou builds antigos;
- `npm ci --ignore-scripts` e build antes da ativação;
- migration somente dry-run;
- symlink atômico;
- reload PM2 e smoke de API/SSR;
- restauração automática da release anterior em falha.

Bloqueios:

- O working tree atual é sujo e seria recusado pelo script.
- AlmaLinux 9, PM2, systemd, Nginx, firewall, SELinux e paths não foram verificados.
- O script não provisiona host, TLS, Nginx, serviço, secrets ou backup; isso é intencional, mas exige runbook executado antes do GO.
- Nenhum deploy real foi validado.

Estado: **PASS CONTRATUAL / NÃO HOMOLOGADO**.

## 13. Rollback

- Exige release existente e confirmação `ROLLBACK:<release-id>`.
- Troca symlink atomicamente, recarrega PM2 e executa smoke.
- Em falha, restaura a release original.
- Não recompila, não reinstala e não toca migrations.
- Documenta corretamente que rollback de aplicação não reverte schema.

Ausências: ensaio real, medição de tempo, compatibilidade com schema aplicado e validação após reboot.

Estado: **PASS CONTRATUAL / NÃO HOMOLOGADO**.

## 14. Backup

- Usa `mysqldump` sem senha na linha de comando.
- Exige defaults file absoluto e protegido.
- Gera gzip, SHA-256 e manifesto.
- Recusa output dentro do repositório.
- Exige aceite explícito de storage criptografado.
- Retenção é dry-run por padrão e restringe nomes canônicos.
- Testes focados passaram.

Ausências: job/scheduler, storage offsite, criptografia comprovada, alertas, backup real, RPO medido e evidência de retenção no host.

Estado: **PASS CONTRATUAL / NO-GO OPERACIONAL**.

## 15. Restore

- Só permite banco descartável com nome seguro e confirmação exata.
- Valida gzip/checksum antes de restaurar.
- Verifica estrutura, tabelas críticas, `mysqlcheck` e smoke read-only.
- Drill mede RPO/RTO.
- Testes usam processos simulados e streams sintéticos.

Nenhum restore real foi comprovado com MySQL isolado, `mysql`, `mysqlcheck` e aplicação. Logo, recuperabilidade não está homologada.

Estado: **NO-GO OPERACIONAL**.

## 16. Coerência documental

| Documento    | Coerência com código atual | Divergências                                                                                                                 |
| ------------ | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Sprint 23.8  | Parcial                    | afirma upstreams em loopback, mas API default é `0.0.0.0`; PM2 não força HOST; risco `timeoutId` não documentado             |
| Sprint 23.9  | Parcial                    | estratégia atômica permanece; validação real continua 0%; checkpoint sujo não é implantável; `kill_timeout` não foi alinhado |
| Sprint 23.10 | Coerente                   | gates continuam offline e sem deploy; contagens cresceram com novas sprints                                                  |
| Sprint 24.4  | Coerente                   | logger/contexto/middlewares existem; coletor e alertas seguem ausentes                                                       |
| Sprint 24.5  | Coerente                   | hardening e riscos residuais permanecem conforme documentado                                                                 |
| Sprint 24.6  | Coerente                   | testes/builds seguem verdes; ressalvas de ambiente e qualidade global permanecem                                             |

Divergências adicionais:

- Runbooks antigos ainda mencionam `/health` e limitações anteriores à Sprint 23.8; devem ser tratados como históricos ou atualizados em sprint própria.
- Documentação de VPS/Ubuntu e scripts `deploy/server/*ubuntu.sh` coexistem com o fluxo canônico AlmaLinux. A produção precisa declarar um único caminho suportado.
- `docs/DEPLOY/BACKUP.md` é legado frente à automação segura de `scripts/recovery`.
- O template API HTTP conflita com a expectativa geral de TLS descrita em `docs/DEPLOY/SSL.md`.

## 17. Gates e testes

| Gate                                 | Resultado                                                          |
| ------------------------------------ | ------------------------------------------------------------------ |
| Secret Scan                          | PASS — 1.667 arquivos, 0 findings                                  |
| Contracts                            | PASS — 12/12                                                       |
| Migrations                           | PASS                                                               |
| Migration Runner                     | PASS                                                               |
| Topology                             | PASS                                                               |
| Integrity                            | PASS                                                               |
| Migrations/Runner/Topology/Integrity | PASS — 48/48                                                       |
| Security                             | PASS — 34/34                                                       |
| Backend                              | PASS — 703/703                                                     |
| Frontend                             | PASS — 78/78                                                       |
| Recovery + SSR health focado         | PASS — 11/11                                                       |
| Build Client                         | PASS — 3.737 módulos                                               |
| Build SSR                            | PASS — 449 módulos; warnings de imports não usados em dependências |
| `node --check`                       | PASS — 44 arquivos, 0 falhas                                       |
| Prettier escopado                    | PASS                                                               |
| ESLint escopado                      | PASS                                                               |
| `git diff --check` inicial           | PASS; avisos LF/CRLF                                               |

Total de execuções com resumo numérico: **886 aprovadas, 0 falhas**. Há sobreposição intencional entre Backend e suítes específicas; o total representa execuções, não casos únicos.

Não foram executados Browser E2E, testes externos, migration real, Banco Inter, Pix, BI externo, banco remoto, VPS, HostGator ou deploy.

## 18. Riscos

### Críticos/altos

- Processo API pode escutar em todas as interfaces.
- Virtual host API disponível somente em HTTP.
- PM2 pode interromper o processo antes do timeout de drenagem.
- Restore real e RPO/RTO não comprovados.
- Checkpoint sujo não é aceito pelo deploy canônico.

### Médios

- Variáveis de produção incompletas e aliases sobrepostos.
- Ausência de gzip explícito e política completa de cache/headers para SSR.
- Sem persistência canônica para uploads entre releases; qualquer upload em filesystem local pode ser perdido no próximo deploy.
- Limites de body divergem: Nginx app 10 MB, API template 4 MB e Express 8 MB.
- Logs sem rotação/alertas; SSR pode registrar corpo de erro 5xx truncado.
- API sem `max_memory_restart`.
- Dois caminhos de deploy (Ubuntu legado e AlmaLinux canônico) coexistem.

### Baixos

- Avisos LF/CRLF no working tree.
- Warnings de imports não usados em dependências durante build SSR.

## 19. Bloqueadores

1. Produzir um checkpoint limpo, revisado e imutável antes de usar o deploy atômico.
2. Homologar em AlmaLinux autorizado: preflight, `nginx -t`, PM2/systemd, firewall, SELinux e portas.
3. Garantir bind loopback da API ou controle equivalente explicitamente comprovado.
4. Alinhar `kill_timeout` do PM2 à janela de graceful shutdown e ensaiar SIGTERM/SIGINT sob carga.
5. Definir virtual host canônico e validar TLS/redirect para todos os domínios públicos, especialmente API.
6. Criar/validar matriz canônica de variáveis de produção sem secrets.
7. Executar backup e restore drill em MySQL descartável, com RPO/RTO, checksum, `mysqlcheck` e smoke.
8. Definir rotação, retenção e alertas de logs/health/backup/TLS.
9. Definir persistência de uploads ou comprovar formalmente que produção não grava uploads locais.
10. Escolher e documentar um único fluxo de deploy suportado; scripts Ubuntu legados não devem competir com AlmaLinux.

## 20. GO / NO-GO da infraestrutura

**NO-GO PARA PRODUÇÃO.**

O código possui boa preparação e cobertura local, mas homologação de infraestrutura exige evidência do ambiente em que ela será executada. Os bloqueadores acima afetam exposição de rede, transporte TLS, drenagem de processos, recuperabilidade e reprodutibilidade do deploy. Gates verdes não substituem `nginx -t`, PM2/systemd, firewall/SELinux, certificados e drill de restore reais.

## 21. Percentual da Sprint 25.2

**Sprint 25.2: 100% concluída**, pois todas as atividades autorizadas de auditoria, gates e relatório foram executadas.

**Prontidão de infraestrutura estimada: 60%.** A arquitetura e os contratos locais estão preparados, mas os controles operacionais críticos não foram comprovados e existem divergências de bind, TLS e timeout que impedem GO.

## 22. Arquivos da Sprint 25.2

### Arquivos alterados

Nenhum arquivo preexistente foi alterado.

### Arquivos novos

- `docs/AUDIT/SPRINT_25_2_INFRASTRUCTURE_HOMOLOGATION.md` — relatório completo da homologação local.

## 23. Estado final do Git

- Branch: `sprint-23`.
- HEAD: `37928bb4e28407e7a58c37eee70880b8be1157bc`.
- Origin local no checkpoint: divergência `0/0`.
- Staging: vazio; nenhuma ação de stage executada.
- Working tree: preservado, acrescido somente deste relatório.
- Commit: não executado.
- Push: não executado.
- Merge: não executado.
- Rebase: não executado.
- Deploy: não executado.
- Ambiente externo/VPS/HostGator: não acessados.
