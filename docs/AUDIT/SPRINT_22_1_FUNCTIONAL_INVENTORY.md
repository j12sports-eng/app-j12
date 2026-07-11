# Sprint 22.1 - Inventario funcional

Legenda: A producao; B homologacao; C parcial; D estrutura/placeholder; E nao implementado; F bloqueado por integracao/configuracao externa.

| Modulo                     |                   Back |          Front | Banco/API/testes                       | Classe | Evidencia / risco principal                                        |
| -------------------------- | ---------------------: | -------------: | -------------------------------------- | ------ | ------------------------------------------------------------------ |
| Autenticacao               |                    Sim |            Sim | JWT, rotas e telas                     | B      | Exige E2E de expiracao, recuperacao e ambiente.                    |
| Autorizacao/roles          |                    Sim |            Sim | Guards e menus por role                | C      | Dois stacks de middleware; IDOR nao comprovado.                    |
| Usuarios/perfis            |                    Sim |            Sim | Rotas/stores                           | C      | Configuracoes de usuarios ainda usa mock.                          |
| Portal administrativo      |                    Sim |            Sim | Muitas rotas                           | C      | Entry point PM2 nao monta dominios modernos.                       |
| Portal do aluno            |                    Sim |            Sim | `/aluno/me/*`                          | B      | Sem E2E autenticado global.                                        |
| Portal do responsavel      |                    Sim |            Sim | `/responsavel/*`                       | B      | Escopo multialuno/IDOR requer E2E.                                 |
| Portal do professor        |                Parcial |        Parcial | Inicio/presencas                       | C      | Faltam agenda, avaliacao e comunicacao dedicadas.                  |
| Alunos                     |                    Sim |            Sim | Legado + stores                        | B      | Fallback estatico residual; E2E ausente.                           |
| Responsaveis               |                    Sim |            Sim | Router e store                         | B      | Vinculo e acesso cruzado requerem E2E.                             |
| Professores                |                    Sim |            Sim | Router e store                         | B      | Seed residual e atribuicao real nao homologada.                    |
| Matriculas                 |                    Sim |            Sim | Dominio, migrations, testes            | C      | Router moderno ausente no PM2; schema real nao comprovado.         |
| Mensalidades               |                    Sim |            Sim | Financeiro legado                      | C      | Fluxo completo cobranca->baixa nao comprovado E2E.                 |
| Financeiro                 |                    Sim |            Sim | Legado + dominio/testes                | C      | Dois caminhos e dependencia de schema/entrypoint.                  |
| Pagamentos                 |                    Sim |            Sim | Provider/repository                    | F      | Gateway e conciliacao real dependem do ambiente.                   |
| Banco Inter                |                    Sim |            Sim | Client mTLS, admin API, testes mock    | F      | Credenciais/certificados e API real nao validados.                 |
| Pix                        |                    Sim |            Sim | Emissao/consulta/cancelamento          | F      | Mesma dependencia externa; risco financeiro.                       |
| Boletos                    |         Nao comprovado | Nao comprovado | Sem fluxo canonico completo            | E      | Nao confundir cobranca generica com boleto emitido.                |
| Cartao/link de pagamento   |     Estrutura generica |        Parcial | Provider abstrato                      | D      | Nao ha gateway operacional comprovado.                             |
| Automacoes financeiras     |                    Sim |            Sim | Orchestrator/audit/history             | F      | Depende de n8n/allowlist/configuracao.                             |
| n8n                        |      Adapter/workflows | Admin indireto | Docs e testes mock                     | F      | Importacao/ativacao real nao comprovada aqui.                      |
| WhatsApp/BotConversa       |         Estrutura/docs | Nao comprovado | Sem entrega real comprovada            | F      | Credenciais/allowlist/canal externo.                               |
| Turmas                     |                    Sim |            Sim | Router/store/classes facade            | B      | Capacidade e concorrencia precisam E2E com banco.                  |
| Modalidades                |                    Sim |            Sim | Router/store                           | B      | Sem homologacao operacional atual.                                 |
| Unidades                   |                    Sim |            Sim | Router/store                           | B      | Sem homologacao operacional atual.                                 |
| Agenda                     |                    Sim |            Sim | Dominio, recorrencia, conflito         | C      | Router moderno ausente no PM2; persistencia real parcial.          |
| Presenca/frequencia        |                    Sim |            Sim | Rotas admin/aluno/professor            | C      | Fluxo professor->portal nao tem E2E global.                        |
| Avaliacoes                 |         Nao comprovado |   Pagina aluno | Sem backend canonico encontrado        | D      | Pagina nao prova fluxo funcional.                                  |
| Quadras                    |                    Sim |            Sim | Dominio e testes                       | C      | Router moderno ausente no PM2; schema usa padroes legados.         |
| Reservas/locacoes          |                    Sim |            Sim | API e regras                           | C      | Pagamento de locacao E2E nao comprovado.                           |
| Recorrencias               |                    Sim |            Sim | Agenda/quadras                         | C      | Materializacao/persistencia real precisa homologacao.              |
| Campeonatos                |                    Sim |            Sim | Dominio amplo e testes                 | C      | Routers moderno/publico ausentes no PM2.                           |
| Eventos esportivos         |  Dentro de campeonatos |            Sim | Jogos/sumulas/estatisticas             | C      | E2E de competicao nao comprovado.                                  |
| Portal publico campeonatos |                    Sim |            Sim | API publica sanitizada                 | C      | Ausente no entrypoint PM2.                                         |
| Lanchonete                 |                    Nao |            Nao | Nenhuma implementacao funcional        | E      | Modulo ausente.                                                    |
| Estoque                    |                    Nao |            Nao | Nenhuma implementacao funcional        | E      | Modulo ausente.                                                    |
| Mobile/PWA                 |                    Nao | Responsivo web | Sem manifest/service worker comprovado | E      | Nao ha aplicativo/PWA funcional.                                   |
| Notificacoes               |                    Sim |            Sim | Centro, preferencias, fila             | C      | Canais externos preparados, nao adaptados; PM2 divergente.         |
| Relatorios                 |                    Sim |            Sim | Financeiro e BI                        | C      | Export operacional depende do router moderno.                      |
| BI/dashboard executivo     |                    Sim |            Sim | Read-only, testes                      | C      | PM2 nao monta `/admin/bi`; dados reais nao homologados.            |
| Exportacoes                |                    Sim |            Sim | CSV/XLSX/PDF                           | C      | Limites/testes existem; endpoint produtivo nao comprovado.         |
| Metas                      | Indisponivel explicito |            Sim | Sem persistencia canonica              | D      | Contrato correto de indisponibilidade, nao funcionalidade de meta. |
| Tendencias                 |                    Sim |            Sim | Comparativos deterministas             | B      | Requer validacao com dados reais.                                  |
| Insights                   |                    Sim |            Sim | Regras deterministas                   | B      | Requer carga/latencia e dados reais.                               |
| Auditoria                  |                Parcial |        Parcial | Historico financeiro e logs            | C      | Nao e trilha transversal de todos os dominios.                     |
| Logs                       |                    Sim |            N/A | Console/arquivos PM2                   | C      | Sem rotacao/centralizacao comprovada; logs locais versionados.     |
| Observabilidade            |          Health basico |            N/A | Sem metricas/APM/alertas               | D      | Insuficiente para producao.                                        |
| Backup/restore             |                   Docs |            N/A | Procedimento manual                    | D      | Restore testado nao comprovado.                                    |
| Seguranca operacional      |                Parcial |        Parcial | Headers/rate limit/guards              | C      | Entry points divergentes, IDOR e secrets/logs exigem hardening.    |
| Infraestrutura producao    |                 Config |            SSR | PM2/Nginx/scripts                      | C      | Sem CI, deploy/rollback/restore E2E comprovados.                   |
| Configuracoes              |  Router custom parcial |            Sim | Mocks em `src/lib/settings/mocks`      | D      | Respostas de producao nao persistidas integralmente.               |
| Contratos                  |   API custom/estrutura |            Sim | Store possui seed                      | C      | Persistencia e assinatura juridica E2E nao comprovadas.            |
| Aula experimental          |            Rota custom |            Sim | `trialClassesMock`/seed                | D      | Mock no caminho de producao.                                       |
| Planos                     |                    Sim |            Sim | Router/store                           | B      | Homologacao real nao comprovada.                                   |

## Fluxos criticos E2E

|   # | Fluxo                       | Estado                                | Classe/bloqueio                                |
| --: | --------------------------- | ------------------------------------- | ---------------------------------------------- |
|   1 | Admin cria aluno            | Parcialmente comprovado por API/store | B; sem browser+DB E2E atual.                   |
|   2 | Vincula responsavel         | Parcial                               | C; IDOR e relacionamento real nao homologados. |
|   3 | Cria matricula              | Implementado em dominio               | C; router PM2/schema real.                     |
|   4 | Aluno entra em turma        | Implementado com link                 | C; concorrencia/capacidade real.               |
|   5 | Gera obrigacao financeira   | Implementado                          | C; migration/entrypoint.                       |
|   6 | Cria cobranca               | Implementado                          | C; fluxo legado/moderno.                       |
|   7 | Realiza pagamento           | Codigo existe                         | F; gateway real.                               |
|   8 | Concilia pagamento          | Codigo existe                         | F; webhook/API real.                           |
|   9 | Mensalidade paga            | Repository implementa                 | F; E2E financeiro ausente.                     |
|  10 | Detecta inadimplencia       | BI/automacao implementados            | B; dados reais.                                |
|  11 | Executa automacao           | Orchestrator implementado             | F; n8n.                                        |
|  12 | Persiste historico          | Implementado/migration                | C; schema produtivo.                           |
|  13 | Admin consulta historico    | Front/backend implementados           | C; PM2.                                        |
|  14 | BI reflete dados            | Queries canonicas                     | C; PM2 e banco real.                           |
|  15 | Professor consulta turma    | Parcial                               | C; portal limitado.                            |
|  16 | Professor registra presenca | Implementado                          | C; E2E ausente.                                |
|  17 | Aluno/responsavel consulta  | Implementado                          | B; E2E de escopo ausente.                      |
|  18 | Reserva quadra              | Implementado                          | C; PM2/schema real.                            |
|  19 | Paga locacao                | Nao comprovado ponta a ponta          | F.                                             |
|  20 | Cria campeonato             | Implementado                          | C; PM2.                                        |
|  21 | Registra equipe/inscricao   | Implementado                          | C; PM2/E2E.                                    |
|  22 | Portal publico exibe        | Implementado                          | C; PM2/deploy.                                 |

Nenhum fluxo recebeu classe A: nao ha evidencia conjunta de browser E2E, banco real atual, entrypoint produtivo correto e operacao monitorada.
