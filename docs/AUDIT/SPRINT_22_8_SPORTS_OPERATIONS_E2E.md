# Sprint 22.8 — Operações esportivas E2E

Data: 2026-07-11.

## Base e escopo

- Branch: `sprint-22`.
- Commit base: `4c7b8a345c9461ce90132be52739a32a923efe2f`.
- Working tree inicial da Sprint 22.8: limpo.
- Estado encontrado nesta retomada: dois arquivos modificados e este relatório novo não rastreado; todas as alterações foram preservadas integralmente.
- Foram lidos integralmente os 15 relatórios das Sprints 22.1 a 22.7.
- Nenhum commit, push, tag, deploy, migration ou operação financeira real foi executado.
- A Sprint 22.9 não foi iniciada.

## Método e limite da evidência

A auditoria cruzou, para cada capacidade, rota/página frontend, cliente API ou store, endpoint Express, autenticação/autorização, service/facade, repository/SQL e testes. O composition root canônico monta os routers modernos sob os prefixos oficiais e `/api`.

O canal exigido pela automação do navegador não estava disponível nesta sessão. Nenhuma mutation foi executada contra o banco externo indicado pelo ambiente. Assim, “comprovado” neste relatório significa código e testes locais/isolados; não significa aceite visual em browser ou E2E com banco HML.

Classificação explícita da evidência:

- **Comprovado por teste local:** regras exercitadas pelos testes focados e regressões listados neste documento.
- **Comprovado por contrato:** encadeamentos frontend/API/backend, autorização e persistência verificados estaticamente no código, sem promover essa inspeção a E2E real.
- **Simulado/mockado:** testes de services, rotas e integrações que substituem banco, gateway, sessão ou dependências por doubles controlados.
- **Não comprovado por ausência de browser E2E:** navegação, renderização, responsividade e jornadas completas em navegador.
- **Não comprovado por ausência de banco isolado/HML:** DDL físico, migrations aplicadas, transações e concorrência contra ambiente controlado.
- **Dependente de integração externa:** gateway financeiro, Banco Inter, Pix, webhook e automações externas; nenhuma chamada real foi feita.
- **Funcionalidade parcial:** existe capacidade real, porém distribuída ou sem ciclo completo homologado, como Eventos e financeiro de Locações.
- **Funcionalidade ausente:** Lanchonete/Cantina e módulo autônomo geral de Eventos não existem.

## Matriz consolidada

| Área                     | Frontend → API                             | Backend/autorização                                      | Banco                                                 | Testes                                         | Estado real                                 |
| ------------------------ | ------------------------------------------ | -------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------- | ------------------------------------------- |
| Aluno                    | páginas/stores administrativos e portais   | rotas administrativas e self-service com escopo do token | tabelas legadas + people/profiles                     | regressão e ownership                          | completo local, sem browser/DB HML          |
| Matrícula                | `/admin/enrollments` → API moderna         | `requireAuth` + gestão; facade/service                   | `enrollments`                                         | criação, confirmação, conflito e duplicidade   | completo isolado                            |
| Modalidade               | store → `/modalidades`                     | leitura autenticada; mutations gerenciais                | `j12_modalidades`                                     | coberta pela regressão geral                   | parcial: sem E2E dedicado                   |
| Turma                    | tela/store → `/turmas`                     | leitura autenticada; mutations gerenciais                | `j12_turmas`                                          | contratos e integrações de matrícula           | completo local                              |
| Horário                  | turma, Agenda e portal Professor           | escopo gerencial/professor                               | turma + agenda                                        | conflito e recorrência                         | completo isolado                            |
| Professor                | tela/store e `/professor/me/*`             | gestão no cadastro; ownership no portal                  | professores e vínculos                                | ownership e acesso cruzado                     | completo local                              |
| Capacidade               | matrícula → vínculo com turma              | rechecagem dentro da transação                           | links ativos + capacidade da turma                    | lotação, overbooking e rollback                | completo isolado                            |
| Frequência               | admin e portal Professor/Aluno/Responsável | ownership por turma/aluno                                | presença legada                                       | tentativa cruzada antes da escrita             | completo isolado                            |
| Agenda/aulas             | `/admin/agenda` e portais                  | gestão; consultas por perfil em rotas próprias           | agenda items/recorrência                              | CRUD inicial, filtros e conflitos              | completo isolado                            |
| Agenda/eventos           | mesma agenda planejada                     | gestão no admin                                          | tabelas de agenda                                     | validação por professor, quadra, aluno e turma | parcial: não há módulo geral de eventos     |
| Conflitos de agenda      | hook/tela + validation API                 | `AgendaConflictValidationService`                        | candidatos por overlap                                | sobreposição parcial e bloqueios               | completo isolado                            |
| Visualização por perfil  | admin, aluno, responsável e professor      | IDs derivados da sessão/vínculo                          | queries com escopo                                    | ownership anterior                             | completo local; browser pendente            |
| Cadastro de quadra       | tela administrativa → `/admin/quadras`     | gestão                                                   | `j12_quadras`                                         | rota/service                                   | completo isolado                            |
| Disponibilidade/bloqueio | calendário e APIs de validação             | gestão                                                   | reservas/bloqueios                                    | horário, bloqueio e overlap                    | completo isolado                            |
| Reserva/conflito         | formulário → reservas                      | gestão                                                   | `j12_quadra_reservas`                                 | conflito antes da gravação                     | completo isolado                            |
| Recorrência de reserva   | formulário e tipos                         | gestão                                                   | grupo/ocorrências materializadas                      | semanal e mensal limitadas                     | completo isolado                            |
| Cancelamento/remarcação  | ações administrativas                      | gestão                                                   | reservas e cobranças espelho                          | rotas e conflito de remarcação                 | completo isolado                            |
| Locação                  | página administrativa completa             | gestão                                                   | quadras, locatários, reservas, waitlist e auditoria   | service/routes/BI                              | completo isolado                            |
| Financeiro da locação    | confirmação de pagamento e espelho         | gestão                                                   | reserva + `j12_financeiro_cobrancas` quando vinculada | guarda de cancelada adicionada                 | parcial: sem transação/HML e sem gateway    |
| Campeonato               | páginas admin → `/admin/campeonatos`       | gestão                                                   | tabelas do domínio                                    | CRUD, publish/archive                          | completo isolado                            |
| Categorias/equipes       | formulários/inscrições                     | gestão                                                   | campeonato/equipes/inscrições                         | compatibilidade e limites                      | completo isolado                            |
| Atletas                  | roster por inscrição                       | gestão                                                   | atletas de inscrição                                  | camisa duplicada, capitão e exclusão lógica    | completo isolado                            |
| Inscrições               | tela e API                                 | gestão                                                   | inscrições                                            | duplicidade, status e limite de equipes        | completo isolado                            |
| Jogos/resultados         | rodadas, jogos e súmula                    | gestão                                                   | rodadas/jogos/súmulas                                 | choque de quadra, placar e eventos             | completo isolado                            |
| Classificação            | tela e recálculo                           | gestão                                                   | snapshot/classificação                                | geral e por grupo                              | completo isolado                            |
| Mata-mata                | árvore e ações                             | gestão                                                   | bracket/matches                                       | geração, avanço e duplicidade                  | completo isolado                            |
| Portal público           | páginas e API read-only                    | público intencional, DTO sanitizado                      | consultas sem soft-deleted/privados                   | rotas e sanitização                            | completo isolado                            |
| Eventos esportivos       | agenda + eventos de súmula/campeonato      | gestão conforme domínio                                  | agenda e match events                                 | lifecycle de súmula                            | parcial: não existe cadastro geral autônomo |
| Participantes de eventos | atletas/inscrições de campeonato           | gestão                                                   | inscrições e roster                                   | duplicidade/ownership do campeonato            | parcial: somente campeonato                 |
| Financeiro de eventos    | BI expõe receita quando houver fonte       | leitura gerencial                                        | agregados de inscrições                               | BI isolado                                     | não comprovado E2E; sem cobrança canônica   |
| Lanchonete               | inexistente                                | inexistente                                              | inexistente                                           | inexistente                                    | ausente; nenhum módulo inventado            |

## Conflitos e duplicidade

- Matrícula/turma: vínculo ativo duplicado é reutilizado; capacidade é checada e rechecada dentro da transação, com rollback em overbooking.
- Agenda: sobreposição parcial é bloqueada por professor, quadra, aluno e turma; bloqueios administrativos e datas indisponíveis também conflitam.
- Recorrência da Agenda: séries e exceções usam chaves idempotentes; a geração não duplica ocorrências.
- Quadras: reservas e bloqueios são consultados antes da gravação; intervalos adjacentes não são tratados como sobreposição.
- Reservas recorrentes: ocorrências são limitadas e materializadas por grupo.
- Campeonatos: inscrição duplicada de equipe, nome duplicado de grupo, atribuição duplicada, camisa duplicada, confrontos repetidos e choque de quadra são rejeitados.
- Mata-mata: times repetidos e edições de confronto duplicadas são bloqueados.

## Bug encontrado e corrigido

### Pagamento de reserva cancelada

`CourtRentalService.confirmReservationPayment` preservava `status = cancelled`, mas ainda marcava `payment_status = paid` e podia baixar `j12_financeiro_cobrancas`. Isso permitia uma baixa financeira incompatível com o ciclo da locação.

Correção:

- reserva cancelada agora retorna conflito HTTP 409;
- a guarda ocorre imediatamente após carregar a reserva;
- nenhuma atualização de reserva, cobrança, auditoria ou notificação ocorre;
- teste novo comprova zero queries/mutations.

Não foi criada integração financeira nova. O espelho financeiro existente continua parcial e dependente de HML.

## Testes e gates

| Gate                           | Resultado                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------- |
| Backend focado operacional     | 272/272 aprovado antes da correção                                              |
| Frontend focado operacional    | 55/55 aprovado                                                                  |
| Quadras/locações após correção | 10/10 aprovado                                                                  |
| Backend completo               | 538/538 aprovado após a correção                                                |
| Frontend completo              | 78/78 aprovado                                                                  |
| ESLint amplo dos domínios      | falhou com 265 erros de Prettier preexistentes; não reformatados fora do escopo |
| ESLint direcionado             | aprovado nos dois arquivos JavaScript alterados                                 |
| Prettier direcionado           | aprovado nos três arquivos da Sprint 22.8                                       |
| `git diff --check`             | aprovado                                                                        |
| Build Client                   | aprovado: 3.737 módulos, 22,82 s                                                |
| Build SSR                      | aprovado: 449 módulos, 7,61 s                                                   |

O build oficial completo (`npm.cmd run build`) terminou com exit code 0 em 37,6 s. Os warnings limitaram-se a imports não utilizados dentro de dependências TanStack (`@tanstack/start-server-core` e `@tanstack/start-client-core`); não houve erro de compilação nem warning atribuído à Sprint 22.8.

## Percentuais funcionais

| Domínio       |       Percentual | Justificativa limitante                                                                          |
| ------------- | ---------------: | ------------------------------------------------------------------------------------------------ |
| Alunos/turmas |          **78%** | cadeia ampla e regras de capacidade/ownership testadas; browser e banco HML ausentes             |
| Agenda        |          **82%** | conflitos, recorrência e perfis cobertos; eventos derivados e persistência real pendentes        |
| Quadras       |          **80%** | cadastro, disponibilidade e bloqueios completos isoladamente; schema nasce no service            |
| Locações      |          **75%** | reserva/cancelamento/recorrência cobertos; financeiro não transacional nem homologado            |
| Campeonatos   |          **88%** | maior cobertura ponta a ponta local, incluindo público; browser/DB real pendentes                |
| Eventos       |          **58%** | existe em Agenda e Campeonatos, mas não como módulo geral com participantes/financeiro canônicos |
| Lanchonete    | **0% — ausente** | nenhuma implementação real; excluída do cálculo ponderado por ser auditoria condicional          |

Percentual funcional real da Sprint 22.8: **77%** sobre os seis domínios implementados. A média não promove mocks/testes isolados a HML e exclui Lanchonete porque o escopo determinou auditá-la somente se houvesse implementação real.

## Pendências internas

- DDL de Quadras e Campeonatos ainda nasce em services/repositories, sem ledger canônico de migrations.
- A confirmação financeira da locação não forma uma única transação entre reserva e cobrança.
- Agenda não cria presença ou financeiro automaticamente, por contrato.
- Não existe módulo autônomo de Eventos com participantes e ciclo financeiro completo.
- Lanchonete/Cantina não existe.
- Os 265 achados do lint amplo são dívida preexistente, sobretudo em Agenda e Enrollments, e devem ser tratados fora desta sprint.

## Dependências externas e HML

- Browser E2E e aceite visual não estavam disponíveis nesta sessão.
- Banco isolado/HML, schema físico e migrations aplicadas não foram comprovados.
- Concorrência real de capacidade, reservas e jogos não foi exercitada em MySQL controlado.
- Gateway financeiro, Banco Inter, Pix, webhooks e n8n dependem de homologação externa; nenhuma operação real foi executada.

## Bloqueadores de produção

- automação visual/browser indisponível nesta sessão;
- banco HML isolado, schema físico e migrations aplicadas não comprovados;
- DDL de Quadras e Campeonatos ainda nasce em services/repositories, sem ledger canônico;
- concorrência real de capacidade, reservas e jogos não testada em MySQL;
- confirmação financeira da locação não é uma transação única entre reserva e cobrança;
- não há gateway/cobrança canônica E2E para locação ou evento;
- não existe módulo autônomo de eventos com participantes e ciclo financeiro;
- Agenda não cria presença ou financeiro automaticamente, por contrato;
- Lanchonete não existe;
- os 265 achados de lint amplo são dívida de formatação preexistente e devem ser tratados em mudança própria.

Esses itens impedem declarar 100% ou homologação produtiva E2E, embora não invalidem os gates locais aprovados.

## Estado final e arquivos da Sprint

- Estado final: dois arquivos modificados e um arquivo novo não rastreado; nenhum artefato de build rastreado foi adicionado.
- Modificados: `backend/src/domains/quadras/application/services/court-rental.service.js` e `backend/src/domains/quadras/application/tests/court-rental.service.test.js`.
- Criado: `docs/AUDIT/SPRINT_22_8_SPORTS_OPERATIONS_E2E.md`.
- Garantia da correção: uma reserva com `status = cancelled` recebe HTTP 409 antes de qualquer query de atualização; portanto não pode ser marcada como paga, não baixa a cobrança financeira vinculada e não gera auditoria ou notificação de pagamento.
- Nenhum código foi alterado depois da regressão backend 538/538 e da regressão frontend 78/78; por isso essas regressões não foram repetidas no fechamento.
- A Sprint 22.9 não foi iniciada.

## Conclusão

Os principais fluxos esportivos existem e têm cobertura isolada relevante. Campeonatos é o domínio mais completo; Agenda, Quadras e matrícula/turma possuem boas proteções de conflito e duplicidade. A Sprint corrigiu uma baixa indevida de locação cancelada. A homologação E2E formal ainda depende de browser, banco controlado e concorrência real; nenhum módulo ausente foi inventado.
