# Sprint 23.8 — Health, readiness, liveness e graceful shutdown

Data: 2026-07-12. Branch: `sprint-23`. HEAD inicial: `0087f79083e966cec235703863d21d42d2ad59b2`.

## Conclusão executiva

Os quatro riscos registrados na Sprint 22 foram corrigidos no runtime canônico:

- Nginx não responde mais `/health` estaticamente;
- API degradada ou sem banco/schema retorna readiness HTTP 503;
- SSR possui liveness e readiness próprias;
- API e SSR tratam SIGTERM/SIGINT com drenagem, fechamento de recursos e timeout seguro.

Nenhum endpoint expõe host de banco, credenciais, mensagem de erro, stack trace ou configuração interna. `/health` foi mantido como alias compatível de readiness.

## Estado anterior

| Componente    | Antes                                  | Risco                                            |
| ------------- | -------------------------------------- | ------------------------------------------------ |
| Nginx app/HML | `return 200 "ok"`                      | mascarava queda da API e banco                   |
| API canônica  | `/health` sempre HTTP 200              | orquestrador/deploy aceitava estado degradado    |
| SSR           | nenhum health                          | processo e artefatos não observáveis             |
| API shutdown  | apenas `server.close` + `process.exit` | pool, Socket.IO e jobs não drenados; sem timeout |
| SSR shutdown  | nenhum handler                         | conexões encerradas abruptamente                 |
| Keepalive DB  | timer não exposto                      | job podia sobreviver ao início do shutdown       |

## Contratos finais

| Endpoint              | Componente | Semântica                                       | HTTP                             |
| --------------------- | ---------- | ----------------------------------------------- | -------------------------------- |
| `/live`               | API        | processo/event loop está atendendo              | 200 enquanto o servidor responde |
| `/ready`              | API        | bootstrap, schema, banco e ausência de shutdown | 200 ou 503                       |
| `/health`             | API/Nginx  | alias compatível de readiness                   | 200 ou 503                       |
| `/internal/health`    | API        | readiness com timestamps/uptime                 | 404 sem token; 200/503 com token |
| `/live`               | SSR local  | processo SSR atendendo                          | 200                              |
| `/ready` ou `/health` | SSR local  | bundles Client/Server presentes e sem shutdown  | 200 ou 503                       |
| `/ssr/health`         | Nginx      | proxy da readiness SSR                          | 200 ou 503                       |

### Dependências de readiness

API verifica somente dependências necessárias para aceitar tráfego:

1. bootstrap de banco concluído;
2. schema obrigatório validado;
3. probe `SELECT 1` bem-sucedida;
4. processo não está em shutdown.

SSR verifica:

1. diretório de assets Client presente;
2. bundle Server presente;
3. processo não está em shutdown.

Integrações Banco Inter, n8n, e-mail e outros serviços opcionais não participam da readiness e não são chamados pelos probes.

## Payload seguro

Os endpoints públicos retornam apenas status, timestamp, flags booleanas das dependências e estado de shutdown. `lastError`, mensagem do banco, host, nome do banco, stack, versão de dependências e secrets não são expostos.

O health interno exige `HEALTH_INTERNAL_TOKEN`; quando ausente ou inválido responde 404, reduzindo enumeração. O token nunca aparece na resposta ou logs adicionados.

## Graceful shutdown

O coordenador compartilhado é idempotente e executado uma única vez para SIGTERM ou SIGINT:

1. marca `shuttingDown=true`, fazendo readiness retornar 503;
2. para de aceitar novas conexões HTTP e fecha conexões ociosas;
3. encerra Socket.IO e jobs em paralelo com a drenagem HTTP;
4. para o keepalive do banco;
5. encerra o pool após drenagem/jobs;
6. conclui com sucesso quando todos os recursos fecham;
7. ao exceder `SHUTDOWN_TIMEOUT_MS` (15 s por padrão), força conexões HTTP, registra timeout sanitizado e define exit code 1.

O timeout é cancelado após encerramento normal. Chamadas concorrentes de shutdown compartilham a mesma Promise.

## Nginx

Nos templates de produção e HML:

- `/health` faz proxy para `127.0.0.1:3001/ready`;
- `/live` faz proxy para `127.0.0.1:3001/live`;
- `/ssr/health` faz proxy para `127.0.0.1:4173/ready`;
- não existe mais resposta `200 ok` estática.

Os arquivos foram alterados, mas nenhuma configuração Nginx foi aplicada ou recarregada nesta sprint.

## Testes

Cobertura focada:

- liveness independente do banco;
- readiness saudável;
- startup degradado com 503 e sem detalhes internos;
- probe de banco indisponível;
- readiness durante shutdown;
- SSR com artefatos presentes/ausentes;
- shutdown de HTTP, Socket.IO, job e pool;
- idempotência para dois sinais;
- timeout e fechamento forçado;
- contratos estáticos API/SSR/Nginx.

## Arquivos

### Criados

- `backend/src/operations/runtime-health.js`
- `backend/src/operations/runtime-health.test.js`
- `backend/src/operations/graceful-shutdown.js`
- `backend/src/operations/graceful-shutdown.test.js`
- `backend/src/operations/runtime-health-integration.test.js`
- `scripts/runtime/ssr-health.mjs`
- `scripts/runtime/ssr-health.test.mjs`
- `docs/AUDIT/SPRINT_23_8_HEALTH_READINESS_SHUTDOWN.md`

### Alterados

- `backend/src/server.js`: endpoints, probe e sinais canônicos.
- `backend/src/config/db.js`: ciclo de vida do keepalive exportado.
- `scripts/serve-ssr.mjs`: endpoints SSR e graceful shutdown.
- `deploy/nginx/app.j12sports.com.br.conf`: health real API/SSR.
- `deploy/nginx/hml.app.j12sports.com.br.conf`: health real API/SSR.

## Gates finais

| Gate                           | Resultado                                    |
| ------------------------------ | -------------------------------------------- |
| Health/shutdown focado         | **12/12 aprovados**                          |
| Contratos segurança/composição | **9/9 aprovados**                            |
| Backend completo               | **598/598 aprovados**                        |
| Frontend completo              | **78/78 aprovados**                          |
| ESLint focado                  | **aprovado**                                 |
| Prettier focado                | **aprovado**                                 |
| `git diff --check`             | **aprovado**                                 |
| Build Client/SSR               | **aprovado**, 3.737 módulos no Client        |
| `nginx -t`/reload              | **não executado**, binário/host indisponível |

## Limitações operacionais

- Nginx não foi validado com `nginx -t`, pois o binário/host de deploy não está disponível localmente.
- Nenhum processo PM2, container ou banco externo foi iniciado.
- O shutdown foi comprovado com servidores/recursos controlados; drenagem sob tráfego real permanece para HML provisionada.
- `server/index.mjs` é composição legada e não é o entrypoint PM2 canônico; o runtime implantável permanece `backend/server.js`.

## Percentual real

- implementação dos contratos canônicos: **100%**;
- testes locais controlados: **100%**;
- aplicação Nginx/PM2 real: **0% nesta sprint**;
- ensaio com tráfego HML real: **não comprovado**.

Nenhuma ação da Sprint 23.9 foi iniciada. Não houve commit, push, tag, deploy, reload Nginx, acesso a banco externo ou chamada financeira.
