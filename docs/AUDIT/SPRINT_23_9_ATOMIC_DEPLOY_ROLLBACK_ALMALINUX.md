# Sprint 23.9 — Deploy e rollback atômicos no AlmaLinux

Data: 2026-07-12. Branch: `sprint-23`. HEAD inicial: `a0aa892c8e9686d0a824ef3c1bbaf958661ea690`.

## Conclusão executiva

Foi preparado um fluxo específico para AlmaLinux 9 com releases imutáveis, build antes da ativação, symlink atômico, smoke de readiness, restauração automática da release anterior e rollback explícito. Nenhum script foi executado em VPS e nenhuma configuração de sistema foi alterada.

O fluxo não instala pacotes, não cria secrets, não executa migrations, não altera Nginx/firewalld/SELinux e não possui credenciais. Essas operações exigem preparação administrativa e autorização separadas.

## Auditoria inicial

| Área                | Estado encontrado                                | Risco/decisão                                                           |
| ------------------- | ------------------------------------------------ | ----------------------------------------------------------------------- |
| Sistema operacional | VPS informada como AlmaLinux 9.8                 | scripts existentes usam Ubuntu e `apt-get`                              |
| PM2                 | ecosystems produção/HML e processos API/SSR      | atualização no diretório vivo; documentação divergente sobre entrypoint |
| Nginx               | templates app/HML/API                            | Ubuntu usa `sites-available`; AlmaLinux normalmente usa `conf.d`        |
| Node/npm            | scripts exigem versões diferentes                | novo preflight exige Node 22+ e presença de npm                         |
| systemd             | Nginx documentado; PM2 unit não comprovada       | novo preflight exige ambas as units enabled/active                      |
| firewall            | recomendação documental                          | novo preflight exige firewalld, HTTP/HTTPS e rejeita 3001/4173 públicos |
| SELinux             | não tratado nos scripts Ubuntu                   | novo preflight proíbe Disabled e exige proxy Nginx permitido            |
| Paths               | `/var/www/...` e busca automática ampla          | novo layout fixo sob `/opt/j12-sports`                                  |
| Permissões          | `.env`/certs recomendados, não validados         | owner e modos 600/640 validados                                         |
| Releases            | inexistentes                                     | diretórios versionados e `current` atômico                              |
| Logs                | dentro do checkout                               | movidos logicamente para `shared/logs`                                  |
| Migrations          | runner canônico disponível                       | deploy apenas gera dry-run; nunca executa `up`/`DOWN`                   |
| Secrets             | scripts antigos podem copiar exemplo para `.env` | novo fluxo exige `.env`/certs externos e exclui `.env*` da cópia        |
| Rollback            | `git checkout` no diretório vivo                 | troca de symlink para release já construída e validada                  |

## Layout canônico preparado

```text
/opt/j12-sports/
├── current -> /opt/j12-sports/releases/<release-id>
├── releases/
│   ├── 20260712153000-a0aa892/
│   └── 20260711120000-abcdef0/
├── shared/
│   ├── .env
│   ├── certs/
│   ├── logs/
│   └── pm2/
└── deploy.lock
```

O release ID obrigatório é `YYYYMMDDHHMMSS-gitsha`. Paths configurados devem corresponder exatamente a `releases`, `shared` e `current` sob a raiz aprovada.

## Fluxo de deploy

1. Administrador executa o preflight AlmaLinux.
2. Código aprovado e imutável é disponibilizado em staging fora do diretório vivo.
3. Operador `j12` informa release ID e confirmação exata `DEPLOY:<release-id>`.
4. `flock` impede deploy/rollback concorrentes.
5. `rsync` copia código, excluindo Git, secrets, certificados, logs, dependências e builds anteriores.
6. `.env`, `certs` e `logs` são symlinks para `shared`.
7. `npm ci --ignore-scripts` instala dependências determinísticas.
8. `npm run build` ocorre antes da ativação.
9. artefatos Client/SSR são validados.
10. runner canônico gera somente plano `up --dry-run`, salvo em log compartilhado.
11. `current` é trocado atomicamente com symlink temporário e `mv -Tf`.
12. PM2 executa `startOrReload` apontando para a release escolhida.
13. smoke consulta readiness local da API e SSR.
14. sucesso executa `pm2 save` no PM2_HOME compartilhado.
15. falha restaura symlink/processos da release anterior.

## Fluxo de rollback

Rollback exige release existente, já construída, e confirmação exata `ROLLBACK:<release-id>`. Ele não reinstala, não recompila e não toca o banco. A troca é atômica, seguida por reload e smoke. Se o alvo falhar, a release originalmente ativa é restaurada.

Rollback de aplicação não implica rollback de schema. Se uma migration compatível já tiver sido aplicada em janela separada, a compatibilidade deve ser analisada. `DOWN` e restore de banco nunca são automáticos.

## Segurança por área

### AlmaLinux, systemd e Node

O preflight aceita apenas `ID=almalinux` e major 9, exige Node 22+, Nginx ativo/habilitado e uma unit PM2 configurável ativa/habilitada. Instalação/upgrade de pacotes fica fora do script operacional.

### Firewall e bind

Firewalld deve estar ativo, serviços HTTP/HTTPS liberados e portas 3001/4173 não podem aparecer como públicas. API/SSR continuam vinculados a loopback pelos ecosystems.

### SELinux

SELinux não pode estar desabilitado. O preflight confirma `httpd_can_network_connect=on`, necessário para Nginx alcançar os upstreams. O fluxo não executa `setenforce`, não desabilita políticas e não inventa módulos SELinux.

### Nginx

O preflight executa `nginx -t`; deploy não copia nem recarrega configuração. Templates devem ser instalados separadamente em `/etc/nginx/conf.d` por administrador, validados e recarregados somente após aprovação.

### Secrets e permissões

`.env` e certificados ficam em `shared`, fora das releases e do Git. `.env` precisa pertencer a `j12:j12` (configurável) e ter modo 600/640; cada certificado/chave também deve ter modo 600/640. Scripts não imprimem conteúdo de secret.

### Logs

Logs PM2, plano de migrations e evidências ficam em `shared/logs`, sobrevivendo a deploy/rollback. Rotação/retenção continuam responsabilidade operacional do host; não foi instalado módulo PM2 nesta sprint.

## Migrations

Deploy executa exclusivamente:

```text
node backend/src/database/migration-runner/cli.js up --dry-run
```

Execução real requer janela separada, backup comprovado, confirmação exata do banco, lock do runner e aprovação. Nenhuma migration destrutiva automática foi adicionada.

## Comandos preparados

```bash
sudo J12_DEPLOY_CONFIG=/etc/j12-sports/deploy.conf bash deploy/almalinux/preflight.sh

sudo -u j12 J12_DEPLOY_CONFIG=/etc/j12-sports/deploy.conf \
  bash deploy/almalinux/deploy-release.sh \
  --source=/srv/j12-staging/source \
  --release-id=20260712153000-a0aa892 \
  --confirm=DEPLOY:20260712153000-a0aa892

sudo -u j12 J12_DEPLOY_CONFIG=/etc/j12-sports/deploy.conf \
  bash deploy/almalinux/rollback.sh \
  --release-id=20260711120000-abcdef0 \
  --confirm=ROLLBACK:20260711120000-abcdef0
```

Os comandos são documentação; não foram executados.

## Testes e evidência

Os testes locais inspecionam:

- bloqueio de Ubuntu/apt-get e alterações inseguras de SELinux/firewall;
- checks AlmaLinux/systemd/Node/Nginx/firewall/SELinux;
- build antes do symlink;
- lock concorrente;
- dry-run de migrations sem `up` real;
- exclusão e symlinks de secrets;
- confirmação de deploy/rollback;
- smoke e restauração automática;
- `mv -Tf` para troca atômica;
- PM2 apontando para release imutável.

Bash e ShellCheck não estão instalados no workstation Windows. O executável WSL existe, mas não há distribuição Linux instalada; portanto, `bash -n`, ShellCheck e execução simulada não puderam ser realizados. Nenhum resultado Linux operacional é declarado.

## Arquivos da Sprint 23.9

- `.gitattributes`: força LF nos scripts Bash AlmaLinux.
- `deploy/almalinux/j12-deploy.conf.example`
- `deploy/almalinux/lib.sh`
- `deploy/almalinux/preflight.sh`
- `deploy/almalinux/smoke.sh`
- `deploy/almalinux/deploy-release.sh`
- `deploy/almalinux/rollback.sh`
- `deploy/almalinux/README.md`
- `deploy/almalinux/atomic-deploy.contract.test.cjs`
- `docs/AUDIT/SPRINT_23_9_ATOMIC_DEPLOY_ROLLBACK_ALMALINUX.md`

## Gates finais

| Gate                           | Resultado                                        |
| ------------------------------ | ------------------------------------------------ |
| Contratos AlmaLinux/deploy     | **5/5 aprovados**                                |
| Backend completo               | **598/598 aprovados**                            |
| Frontend completo              | **78/78 aprovados**                              |
| ESLint focado                  | **aprovado**                                     |
| Prettier focado                | **aprovado**                                     |
| Varredura de padrões proibidos | **aprovada**                                     |
| `git diff --check`             | **aprovado**                                     |
| Política LF dos scripts        | **aprovada via `git check-attr`**                |
| Build Client/SSR               | **aprovado**, 3.737 módulos no Client            |
| `bash -n`/ShellCheck           | **não executado**, Bash/distro WSL indisponíveis |
| Deploy/rollback AlmaLinux real | **não executado**                                |

## Limitações operacionais

- VPS AlmaLinux não foi acessada.
- `dnf`, systemd, PM2, Nginx, firewalld e SELinux não foram alterados.
- Não houve `nginx -t` real no AlmaLinux.
- Não houve build/reload/smoke/rollback em host Linux.
- Unit PM2, usuário/grupo, paths, labels SELinux, TLS e permissões reais ainda precisam ser provisionados e validados.
- Nenhuma migration ou backup/restore foi executado.

## Percentual real

- estratégia e automação preparadas: **100%**;
- contratos estáticos locais: **100%**;
- validação sintática Bash: **não comprovada por ausência do Bash**;
- execução em AlmaLinux/HML: **0%**;
- deploy/rollback real: **0%**.

Nenhuma ação da Sprint 23.10 foi iniciada. Não houve commit, push, tag, deploy, SSH ou alteração externa.
