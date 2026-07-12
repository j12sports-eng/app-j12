# Sprint 22.10 — Testes E2E globais e regressão

Data: 2026-07-12.

## Base, escopo e método

- Branch: `sprint-22`.
- HEAD/base: `85f590c42c23a934dc53e955f002a7b35c4bf538`.
- Working tree inicial: limpo.
- Os 17 relatórios das Sprints 22.1–22.9 foram lidos integralmente e permanecem preservados.
- Foram executados os 115 arquivos de teste backend e os 23 arquivos de teste frontend encontrados no repositório.
- Não houve acesso a VPS, produção, banco HML/isolado, Banco Inter, Pix, webhook externo ou n8n real.
- Nenhuma migration, operação financeira, deploy, commit, push ou tag foi executada.
- A Sprint 22.11 não foi iniciada.

Classificação oficial:

- **A — E2E real comprovado:** browser, API, banco e dependências reais/controladas na mesma jornada.
- **B — integração comprovada em ambiente isolado:** componentes reais integrados contra ambiente isolado, sem produção.
- **C — parcialmente comprovado:** partes relevantes cobertas localmente, mas a cadeia completa não foi executada.
- **D — somente unitário/estrutural:** contrato, source inspection, unidade ou estrutura sem integração suficiente.
- **E — não comprovado:** sem evidência funcional suficiente.
- **F — bloqueado externamente:** depende de HML, banco, infraestrutura ou integração externa indisponível/não autorizada.

Testes com query runners, repositories in-memory, mocks, doubles e transporte simulado são registrados como tal. Testes HTTP de router/controller não são promovidos a browser E2E. O canal obrigatório da skill de browser não estava disponível na sessão anterior; portanto, browser E2E real permanece não comprovado.

## Matriz oficial dos fluxos obrigatórios

|   # | Fluxo                                       | Classe | Tipo exato de evidência                                                                 | Resultado e limite                                           |
| --: | ------------------------------------------- | :----: | --------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
|   1 | Admin autentica                             |   C    | testes locais de JWT, guards, rate limit e contratos de rota; sem browser/banco isolado | autenticação implementada; sessão real E2E não executada     |
|   2 | Admin cria/consulta aluno                   |   C    | router/store e testes de homologação estrutural/local                                   | CRUD real contra HML não executado                           |
|   3 | Responsável é vinculado                     |   C    | testes de ownership e contratos com doubles                                             | vínculo persistido real e jornada visual não comprovados     |
|   4 | Matrícula é criada                          |   C    | service/facade/repository testados com query runner                                     | schema e transação em banco isolado não comprovados          |
|   5 | Aluno entra em turma                        |   C    | testes de class link, capacidade, duplicidade e rollback simulados                      | concorrência e persistência MySQL real não exercitadas       |
|   6 | Obrigação financeira é gerada               |   C    | application service e repository isolados, unique estrutural                            | tabela/migration aplicada em HML não comprovada              |
|   7 | Cobrança é criada ou simulada com segurança |   C    | criação isolada e providers mockados                                                    | falta ponte canônica da obrigação para cobrança/mensalidade  |
|   8 | Pagamento é processado ou simulado          |   F    | simulação/mock com validação de valor e zero mutation em divergência                    | processamento real Banco Inter/Pix bloqueado externamente    |
|   9 | Conciliação atualiza status                 |   F    | service/repository isolados e webhooks mockados                                         | conciliação real, payload e transação HML não homologados    |
|  10 | Automação é executada                       |   C    | orchestrator/scenario runner local; adapter n8n mockado                                 | execução n8n real bloqueada externamente                     |
|  11 | Histórico é persistido                      |   C    | repository e migration estrutural testados com doubles                                  | persistência em schema HML não comprovada                    |
|  12 | Admin consulta histórico                    |   C    | controller, API e frontend GET-only testados estruturalmente                            | browser e dados reais ausentes                               |
|  13 | BI reflete dados                            |   C    | services/repositories/agregações e frontend testados isoladamente                       | coerência, volume e performance com dados reais pendentes    |
|  14 | Professor consulta turma                    |   C    | security tests e APIs `/professor/me/*` com ownership simulado                          | sessão browser e banco multiusuário não comprovados          |
|  15 | Professor registra presença                 |   C    | testes de rota/ownership impedem aluno ou turma cruzados antes da escrita               | mutation real e jornada visual não executadas                |
|  16 | Aluno consulta seus dados                   |   C    | guards e escopo derivados da sessão testados; cliente não escolhe `alunoId`             | browser e banco isolado ausentes                             |
|  17 | Responsável consulta dependente             |   C    | teste negativo de vínculo e descarte de resposta obsoleta                               | múltiplos dependentes reais em HML não exercitados           |
|  18 | Reserva de quadra é criada                  |   C    | service/router local, recorrência e regras testadas com doubles                         | schema, transação e browser não comprovados                  |
|  19 | Conflito de horário é impedido              |   C    | testes unitários/serviço de overlap, bloqueios e conflito antes da gravação             | concorrência MySQL real não testada                          |
|  20 | Campeonato é criado                         |   C    | services, validators, repositories e rotas testados isoladamente                        | banco e browser E2E ausentes                                 |
|  21 | Portal público exibe campeonato             |   C    | rota pública sanitizada e contratos frontend/backend                                    | renderização browser contra dados persistidos não comprovada |

Resumo por classe: A `0`, B `0`, C `19`, D `0`, E `0`, F `2`. As classes F possuem simulações seguras locais, mas o comportamento real solicitado depende de integrações externas; por isso não foram promovidas a C ou B.

## Resultados consolidados

| Gate                                  |     Total | Aprovados | Falhas | Ignorados |                                 Bloqueados |
| ------------------------------------- | --------: | --------: | -----: | --------: | -----------------------------------------: |
| Backend (`node --test`, 115 arquivos) |       538 |       538 |      0 |         0 |                                          0 |
| Frontend (`node --test`, 23 arquivos) |        78 |        78 |      0 |         0 |                                          0 |
| Consolidado local                     |       616 |       616 |      0 |         0 |                                          0 |
| Browser E2E real                      | 21 fluxos |         0 |      0 |         0 | 21 não comprovados/bloqueados por ambiente |

O runner backend carregou configuração que referencia banco externo nos logs, mas os testes selecionados usam doubles/query runners e não executaram deliberadamente mutations externas. Isso não constitui evidência de integração com banco real.

### Lint

`npm.cmd run lint` terminou com exit code 1: **689 erros preexistentes**, 681 potencialmente formatáveis, sem warnings. A maior parte é `prettier/prettier`, incluindo CRLF. Nenhum arquivo afetado foi alterado em massa e a falha não foi mascarada.

### Build

- Build oficial: exit code `0`.
- Client: **3.737 módulos**, **26,45 s**.
- SSR: **449 módulos**, **8,49 s**.
- Warnings: imports não utilizados dentro de dependências TanStack; nenhum erro do código da Sprint 22.10.

## Bugs

Nenhum bug novo objetivo foi encontrado pelos 616 testes ou pelo build. Nenhum código foi alterado apenas para produzir mudanças. Permanecem as lacunas arquiteturais e operacionais já documentadas, que não são falhas novas desta execução.

## Riscos P0–P3

| Prioridade | Risco preservado                                                                 | Impacto                                                             |
| ---------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| P0         | chave e certificado Banco Inter rastreados no Git                                | credencial mTLS deve ser considerada exposta e rotacionada/revogada |
| P0         | backup e restore não comprovados                                                 | recuperação de dados e RTO/RPO desconhecidos                        |
| P0         | ponte `enrollment_financial_obligations` → mensalidade/cobrança ausente          | interrompe o ciclo financeiro canônico antes do pagamento           |
| P1         | Banco Inter, Pix, webhook e n8n não homologados                                  | pagamento, conciliação e automação reais não comprovados            |
| P1         | schema físico e migrations HML/produção desconhecidos; `ensureSchema` em runtime | drift, locks e rollback imprevisível                                |
| P1         | health/readiness insuficiente e graceful shutdown incompleto                     | deploy pode aceitar serviço degradado ou interromper operações      |
| P1         | scripts Ubuntu/`apt-get` para AlmaLinux; deploy/rollback não atômicos            | falha operacional e release parcial                                 |
| P2         | CI/CD, monitoramento, alertas e rotação de logs não comprovados                  | regressão e incidentes detectados tardiamente                       |
| P2         | ausência de browser E2E e banco isolado                                          | jornadas e ownership integrados permanecem incertos                 |
| P2         | 689 erros de lint preexistentes                                                  | reduz sinal dos gates e aumenta risco de manutenção                 |
| P3         | warnings TanStack no build                                                       | ruído de dependência, sem falha funcional observada                 |

## Pendências e dependências

### Internas

- implementar a ponte canônica obrigação → cobrança/mensalidade e definir fonte financeira única;
- criar runner/ledger de migrations e retirar DDL do runtime gradualmente;
- implementar readiness e graceful shutdown completos;
- criar deploy AlmaLinux atômico, rollback ensaiado e CI obrigatório;
- tratar lint legado em mudança própria;
- criar suíte browser E2E reproduzível com fixtures e banco descartável.

### Externas

- HML isolada com MySQL controlado, migrations conhecidas e massa sintética;
- rotação/revogação Banco Inter e sandbox mTLS autorizado;
- endpoints de teste para Pix, webhook e n8n sem destinatários reais;
- storage offsite e ambiente isolado para comprovar backup/restore;
- VPS AlmaLinux autorizada para validar Nginx, PM2, TLS, health, shutdown e observabilidade.

## Bloqueadores

### Homologação

1. Browser E2E e banco isolado indisponíveis.
2. Ponte obrigação → cobrança/mensalidade ausente.
3. Schema/migrations implantados não comprovados.
4. Integrações financeiras/n8n sem sandbox homologado.
5. Secrets Inter expostos e ainda não rotacionados.

### Produção

Todos os bloqueadores de homologação, mais backup/restore comprovados, deploy/rollback atômicos, readiness/shutdown, CI/CD, monitoramento, alertas, rotação de logs, TLS e aceite operacional.

## Percentuais e metodologia

Os percentuais usam os 21 fluxos obrigatórios, com pesos por evidência, e não quantidade bruta de testes:

- funcional local: A=100, B=85, C=60, D=30, E=0, F=20;
- prontidão HML: A=100, B=80, C=40, D=15, E/F=0;
- produção: A=100, B=60, C=20, D=5, E/F=0, com redutor por P0 operacional aberto.

Resultados arredondados:

- **funcional real/local: 56%**;
- **prontidão para homologação: 36%**;
- **prontidão para produção: 15%**.

Os 100% da regressão local significam somente que 616 testes passaram. Não significam E2E real, homologação ou produção.

## Conclusão

A regressão local está estável: 616/616 testes e Client/SSR aprovados. Entretanto, nenhum dos 21 fluxos atingiu A ou B porque não houve browser E2E nem ambiente isolado integrado. O financeiro real permanece bloqueado pela ponte ausente e pelas integrações externas. A Sprint 22.10 está encerrada como validação global consolidada, com evidência classificada sem promoção indevida. Nenhuma Sprint posterior foi iniciada.
