# Sprint 22.4 - Homologacao funcional do Portal Administrativo

Data: 2026-07-11. Branch inicial `sprint-22`, HEAD `ca37daf`, working tree inicial limpo. Foram lidos integralmente os artefatos 22.1, 22.2 e 22.3. Nenhuma cobranca, pagamento, Pix, automacao, migration ou escrita em banco compartilhado foi executada.

## Metodo e limite de evidencia

A cadeia auditada foi: rota frontend, componente/pagina, hook/store, cliente API, endpoint, autenticacao, autorizacao, controller, service/facade, repository/banco ou integracao e teste. A automacao visual ficou indisponivel porque o ambiente nao expos o canal obrigatorio da skill de navegador. O ambiente local aponta credenciais de banco externo nos logs de inicializacao dos testes; nenhum teste desta Sprint executou operacao financeira ou mutation real. Assim, esta entrega comprova codigo, contratos e regressao isolada, nao aceite visual nem dados reais de HML.

## Matriz consolidada

| Modulo                            | Cadeia encontrada                                                 | Estado                | Evidencia/bloqueio                                                                          |
| --------------------------------- | ----------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------- |
| Login                             | rota/tela -> auth client -> `/auth` -> auth service/banco         | aprovado local        | JWT/rate limit/composition cobertos; E2E visual e expiracao HML pendentes.                  |
| Dashboard                         | `/dashboard` -> stores/API -> dashboard router/queries            | parcial               | conectado; numeros reais dependem do banco e fontes legadas.                                |
| Alunos                            | rota -> store/API -> `/alunos` -> controller -> MySQL             | aprovado local        | token/PII removidos do console; CRUD real nao executado.                                    |
| Responsaveis                      | store/telas de aluno -> `/responsaveis` -> router/vinculos        | parcial               | CRUD existe; fluxo visual de vinculo e dados legados nao homologados.                       |
| Professores                       | rota/store -> `/professores` -> router/MySQL                      | aprovado local        | leitura e mutation gerenciais; seeds historicos permanecem fora da fonte inicial.           |
| Matriculas                        | `/admin/enrollments` -> API -> admin router -> facade/repository  | parcial               | composition root corrigido; schema fisico e fluxo browser+DB pendentes.                     |
| Turmas                            | rota/store -> `/turmas` -> router/MySQL                           | aprovado local        | regras e autorizacao existem; concorrencia/capacidade real pendente.                        |
| Agenda                            | pagina/hook/API -> `/admin/agenda` -> facade/repository           | aprovado isolado      | conflitos, recorrencia e mutations possuem testes; schema/HML pendentes.                    |
| Presenca                          | rota -> API -> `/presencas` -> ownership/repository               | aprovado isolado      | admin e professor protegidos; fluxo visual pendente.                                        |
| Financeiro/mensalidades/cobrancas | admin page/hooks -> APIs legada/moderna -> facades/repositories   | parcial               | leitura, obrigacao e relatorios cobertos; fontes paralelas/schema real pendentes.           |
| Pagamentos/Banco Inter/Pix        | componentes -> admin APIs -> provider/Inter/repository            | bloqueado externo     | somente mocks/contratos; nenhuma transacao real executada.                                  |
| Automacoes/historico              | pagina -> APIs -> orchestrator/history repository                 | parcial               | historia read-only e idempotencia cobertas; n8n/HML indisponivel.                           |
| BI/relatorios/exportacoes         | rotas/hooks -> `/admin/bi` e reports -> repositories              | aprovado isolado      | 600 testes incluem agregacoes/export; dados e performance reais pendentes.                  |
| Quadras/reservas/locacoes         | pagina/hook/API -> router -> service/repository                   | aprovado isolado      | CRUD/conflitos cobertos; pagamento de locacao e browser pendentes.                          |
| Campeonatos/eventos               | rotas/hooks/API -> router -> services/repositories                | aprovado isolado      | CRUD, inscricoes, rodadas, sumula, ranking e publico cobertos.                              |
| Lanchonete                        | inexistente                                                       | nao aplicavel/ausente | nenhuma rota, componente, API ou persistencia encontrada.                                   |
| Configuracoes                     | rota -> settings store -> `/api/state/settings` -> snapshot MySQL | parcial corrigido     | persiste snapshot real, mas usuarios/permissoes da tela nao substituem auth canonica.       |
| Usuarios/permissoes               | settings store/snapshot + guards backend                          | parcial               | backend e fonte de autorizacao; granularidade admin/coordenador nao existe.                 |
| Aula experimental                 | rota/store -> `/api/state/trial-classes` -> snapshot MySQL        | parcial               | seed produtivo vazio; arquivo mock morto permanece; conversao completa browser+DB pendente. |

## Bugs encontrados e corrigidos

1. **P1 permissao:** qualquer usuario autenticado podia ler e sobrescrever colecoes administrativas em `/api/state/*`. O router agora exige `canManageSystem` e retorna 403 para demais perfis.
2. **P1 confidencialidade:** `alunos-api.ts` imprimia Bearer token, alunos completos e identificadores no console. Logs removidos.
3. **P1 confidencialidade:** a persistencia generica imprimia snapshots completos, inclusive Configuracoes/Integracoes. Logs removidos.
4. **P2 exposicao em erro:** o endpoint de state devolvia o body recebido quando `data` faltava. O eco foi removido.

## Mocks e placeholders

Arquivos em `src/lib/settings/mocks` e `src/lib/trialClassesMock.ts` continuam versionados, mas nao alimentam o estado inicial produtivo: Settings usa `defaults.ts`, usuarios/unidades/modalidades vazios ou fontes oficiais; Aula Experimental usa seed vazio. Configuracoes ainda e um snapshot generico, nao um cadastro canonico de usuarios de autenticacao. Banco Inter, Pix, n8n e gateways permanecem mockados/injetados nos testes. Lanchonete nao existe.

## Bloqueadores

- browser E2E indisponivel neste ambiente;
- schema fisico, ledger e dados de HML nao comprovados;
- Banco Inter/Pix/n8n sem sandbox operacional e certificados rotacionados;
- Configuracoes de usuarios/permissoes nao integradas ao cadastro auth canonico;
- fluxo aluno -> responsavel -> matricula -> turma -> financeiro sem banco isolado;
- pagamento de locacao e conciliacao financeira sem E2E;
- performance real de BI/relatorios sem EXPLAIN/cardinalidade.

## Gates locais

- contratos focados 22.2/22.4: 12/12 aprovados;
- regressao descoberta pelo runner: 600/600 aprovada;
- ESLint focado: aprovado;
- `git diff --check`: aprovado;
- Client build: aprovado, 3.737 modulos em 29,84 s;
- SSR build: aprovado, 449 modulos em 8,46 s; avisos somente de imports nao usados em dependencias TanStack.

## Classificacao real

Portal Administrativo: **72%**. Modulos aprovados isoladamente: login, alunos, professores, turmas, agenda, presenca, BI/relatorios/exportacoes, quadras e campeonatos. Parciais: dashboard, responsaveis, matriculas, financeiro, historico, configuracoes, usuarios/permissoes e aula experimental. Bloqueados: pagamentos/Banco Inter/Pix/n8n e pagamento de locacao. Ausente: lanchonete.

Sprint 22.4: **86%**. Inventario, correcoes, contratos, regressao e documentacao foram realizados; browser+DB/HML e integracoes externas representam os 14% nao comprovados. Sprint 22.5 nao foi iniciada.
