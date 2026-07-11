# Sprint 22.1 - Auditoria global da arquitetura

Data da auditoria: 2026-07-10. Base: branch `sprint-21`, commit `d00882a`. O working tree inicial estava limpo. Esta auditoria e somente leitura sobre codigo e configuracao; nao houve acesso a VPS, Banco Inter, n8n ou banco compartilhado.

## Resumo executivo

O repositorio possui frontend React/TanStack Start, API Express/MySQL, dominios novos em camadas e rotas legadas. Client e SSR compilam e existe cobertura unitaria relevante. O sistema nao pode ser classificado como pronto para producao porque o processo PM2 aponta para um entrypoint que nao monta os routers modernos e porque E2E, migrations em producao, restore, observabilidade e integracoes externas nao foram comprovados.

## Arquitetura encontrada

| Camada                 | Implementacao comprovada                                              | Observacao                                                                                 |
| ---------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Frontend               | `src/routes`, `src/features`, `src/components`, TanStack Router/Query | Quatro superficies: admin, aluno, responsavel e professor.                                 |
| SSR                    | `scripts/serve-ssr.mjs`, `dist/server/server.mjs`                     | Proxy de `/api`, `/__api` e `/auth`; timeout de 30 s no PM2.                               |
| API moderna            | `backend/src/server.js` via `backend/server.js`                       | Monta dominios de matriculas, financeiro, agenda, quadras, campeonatos, notificacoes e BI. |
| API configurada no PM2 | `server/index.mjs`                                                    | Monta apenas conjunto legado/custom; nao monta os routers modernos acima.                  |
| Persistencia           | MySQL, SQL manual e `queryRunner`                                     | Nao existe `schema.prisma` neste checkout.                                                 |
| Migrations             | `backend/src/database/migrations`                                     | 10 artefatos; criacao nao prova aplicacao em HML/producao.                                 |
| Integracoes            | Banco Inter/Pix, n8n e webhooks                                       | Implementacao e testes mockados existem; operacao real depende de ambiente/credenciais.    |
| Operacao               | PM2, Nginx, scripts Ubuntu, health checks                             | Sem CI/CD versionado, monitoramento externo ou restore comprovado.                         |

## Divergencia dos entrypoints

Evidencia critica:

- `ecosystem.config.cjs` e `ecosystem.hml.config.cjs` iniciam `server/index.mjs`.
- `server/index.mjs:141-166` declara somente rotas legadas e custom; o 404 e registrado em `server/index.mjs:497`.
- `backend/src/server.js:518-570` monta os routers modernos antes do 404.
- `backend/server.js` carrega `backend/src/server.js`, mas nao e o script do PM2.

Impacto: endpoints que passam nos testes de router podem responder 404 no processo configurado para producao. Este risco deve ser resolvido e testado antes de homologacao integrada.

## Portais

| Portal         | Rotas/paginas                                                                                     | APIs/dados                                                      | Classificacao | Evidencia e lacuna                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------- |
| Administrativo | Dashboard, alunos, professores, matriculas, turmas, agenda, financeiro, BI, quadras e campeonatos | Ampla cobertura frontend/backend                                | C             | Entry point produtivo divergente; Configuracoes usa mocks; sem E2E global.                      |
| Aluno          | Dashboard, perfil, agenda, presencas, financeiro, contrato, notificacoes e treinos                | Hooks chamam `/aluno/me/*`                                      | B             | Fluxos estao conectados no backend moderno/legado, mas nao ha suite E2E autenticada comprovada. |
| Responsavel    | Dependentes, dashboard, perfil, agenda, presencas, financeiro, contrato e notificacoes            | Escopo de aluno selecionado em contexto e APIs `/responsavel/*` | B             | Ha escopo funcional, mas IDOR/multidependente nao foi validado E2E nesta auditoria.             |
| Professor      | Inicio e presencas                                                                                | `/professor/me` e rotas de presenca                             | C             | Superficie pequena; agenda, avaliacoes e comunicacao dedicadas nao estao completas.             |

Responsividade e navegacao existem em layouts mobile-first, mas nao houve teste visual em dispositivos nesta auditoria.

## Matriz frontend para backend

| Fluxo                                  | Frontend -> API                       | Backend real                                 | Estado                                                         |
| -------------------------------------- | ------------------------------------- | -------------------------------------------- | -------------------------------------------------------------- |
| Login                                  | `/auth`/`/api/auth`                   | Auth montado nos dois entrypoints            | Conectado; HML/expiracao exige validacao operacional.          |
| Alunos/responsaveis/professores/turmas | stores/hooks -> rotas legadas         | Routers legados montados nos dois caminhos   | Conectado, com seeds/fallbacks residuais em alguns stores.     |
| Matricula publica/admin                | `matricula-api` e `enrollments-api`   | Routers em `backend/src/server.js`           | Parcial: nao montado no entrypoint PM2.                        |
| Financeiro administrativo              | `useFinanceiroAdmin`                  | Legado + dominio moderno                     | Parcial: parte legada conectada; Inter/moderno diverge no PM2. |
| Agenda                                 | feature Agenda -> `/admin/agenda`     | Router moderno                               | Parcial: nao montado no entrypoint PM2.                        |
| Quadras                                | feature Quadras -> API administrativa | Router moderno                               | Parcial: nao montado no entrypoint PM2.                        |
| Campeonatos admin/publico              | feature completa                      | Routers moderno admin/publico                | Parcial: nao montado no entrypoint PM2.                        |
| Notificacoes                           | feature/hook -> notification center   | Router moderno                               | Parcial: nao montado no entrypoint PM2.                        |
| BI/exports/insights                    | feature BI -> `/admin/bi/*`           | Router BI moderno                            | Parcial: nao montado no entrypoint PM2.                        |
| Configuracoes                          | paginas/stores                        | `src/lib/settings/mocks/*`                   | Desconectado de persistencia real.                             |
| Aula experimental                      | store `trialClassesMock`              | Rota custom existe, mas store inicia de mock | Parcial/placeholder em producao.                               |

## Banco e migrations

Foram encontrados 10 artefatos de migration: enrollments; constraint de draft; auditoria de confirmacao; duas migrations concorrentes para `enrollment_class_links`; obrigacoes financeiras; agenda; recorrencia; notificacoes; historico de automacao financeira. Ha risco de drift pela duplicidade `20260701103000`/`20260701120000` para a mesma tabela.

Classificacao de evidencia:

1. Existencia: comprovada para os 10 artefatos.
2. Teste estrutural: comprovado para parte das migrations JS e por testes de repositories.
3. Teste isolado/rollback: documentado para varias sprints antigas, sem reexecucao nesta auditoria.
4. Homologacao: nao comprovada de forma global e atual.
5. Producao: nao comprovada.

Nao foi executada migration. O repositorio mistura migrations formais, tabelas legadas e criacao idempotente/service-side em dominios antigos. FKs e indices existem em alguns artefatos; nao ha inventario atual do schema fisico. Timezone de BI e `America/Sao_Paulo`, enquanto persistencia legada varia entre DATE/DATETIME/timestamps.

## Autenticacao, autorizacao e privacidade

JWT, login, logout e recuperacao de senha existem. Frontend filtra navegacao por role e backend moderno usa `requireAuth`/guards como `canManageSystem`. Isso nao elimina riscos: ha dois entrypoints, middleware legado paralelo e ausencia de E2E de IDOR para aluno, responsavel e professor. Secrets de ambiente estao ignorados; nenhum valor foi lido ou copiado. Logs versionados e `console.log` operacionais aumentam risco de PII/secrets acidentais e devem ser saneados antes do go-live.

## Testes e qualidade

- 110 arquivos de teste backend em `backend/src`.
- 22 arquivos `.test.mjs` frontend.
- Predominam testes unitarios/contrato com mocks ou `queryRunner` injetado.
- Existem smokes documentados com rollback, mas nao uma suite E2E global reproduzivel.
- Ausencia de `.github/workflows` ou outro pipeline CI versionado.
- Gate 22.1: backend `511/511` e frontend `74/74`, ambos com exit code 0.
- Gate 22.1: build oficial Client + SSR com `BUILD_EXIT_CODE=0`.
- Prettier dos quatro artefatos de auditoria aprovado.
- ESLint global falhou com 1.066 erros preexistentes (1.058 potencialmente formataveis). Alem de formatacao, ha hooks condicionais e imports `require` em `src/lib/alunos-store.ts`; nenhum arquivo de codigo foi alterado para mascarar a divida.

## Infraestrutura e producao

Ha configuracao PM2, Nginx com HTTPS/health, proxy SSR/API e scripts Ubuntu. Nao ha evidencia atual de deploy reproduzido, restore testado, rotacao centralizada, APM, metricas, alertas, SLO ou CI/CD. `docs/DEPLOY/BACKUP.md` descreve comandos manuais, mas documentacao nao prova execucao. O Nginx de `api.j12sports.com.br` nao declara TLS no arquivo auditado.

## Limitacoes

Auditoria estatica local: sem VPS, banco real, DNS, certificados, APIs externas, browser E2E ou carga. Classificacoes A nao foram atribuidas porque nenhum modulo critico reuniu evidencia de deploy, E2E, operacao e ausencia de bloqueantes.
