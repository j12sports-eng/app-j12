# Sprint 28.1 — Auditoria e Orquestração Segura da Pré-Matrícula

## Objetivo

Consolidar o início da jornada de matrícula na camada Application, reutilizando os domínios reais de Pessoas e Enrollments. A Sprint não cria endpoint, tabela, migration, token público, cobrança, contrato ou ativação automática.

## Baseline auditada

- Branch inicial: `sprint-23`.
- Commit inicial: `edfbe20 feat(crm): adiciona alertas operacionais de SLA` (Sprint 27.18D).
- Worktree inicial: limpa; não havia alterações locais de outra Sprint.
- Persistência: MySQL 5.7, repositories SQL manuais e migrations JavaScript.

## Diagnóstico da arquitetura

### Matrículas

O domínio canônico está em `backend/src/domains/enrollments`. Ele já contém aggregate `Enrollment`, estados `DRAFT`, `PENDING`, `ACTIVE`, `SUSPENDED`, `CANCELLED` e `FINISHED`, facade/application services, repository MySQL, confirmação de DRAFT e consulta consolidada `NONE`/`DRAFT`/`ACTIVE`/`CONFLICT`.

`EnrollmentFacade.resolveOrCreateDraftEnrollmentForResolvedStudent` já representa a fronteira adequada para localizar ou criar o DRAFT, preservar o bloqueio de ACTIVE e rejeitar conflito. A tabela `enrollments` possui chaves estrangeiras para Pessoa/perfil e índice único físico para o DRAFT corrente do aluno/perfil.

### Pessoas, perfis e vínculos

O domínio `backend/src/domains/pessoas` possui serviços de aplicação e repositories para:

- resolver ou criar Pessoa por identidade;
- resolver ou criar perfil de aluno;
- criar perfil de responsável;
- resolver aluno (Pessoa + perfil);
- persistir vínculo entre responsável e aluno.

As lacunas mínimas encontradas eram a resolução idempotente do perfil de responsável e do vínculo responsável-aluno, além do comportamento inseguro de criar uma Pessoa nova quando um `personId` explícito não existia. A Sprint fecha essas lacunas na camada Application sem mudar contratos públicos.

### Estrutura legada de pré-matrícula

Existe `backend/src/domains/pessoas/pre-matricula`, apoiado em `pre_matriculas` e estados em português. O próprio módulo está documentado como isolado, sem rota e sem integração com o domínio canônico de Enrollment. Reutilizá-lo criaria duas fontes de verdade; por isso ele não foi alterado nem exposto.

### CRM

O CRM já possui conversão opcional de Lead para aluno e Enrollment DRAFT, com autorização por unidade e idempotência. O novo orquestrador não depende de Lead: atendimento presencial, WhatsApp, portal ou importação futura podem usar a mesma fronteira de aplicação quando houver um composition root autorizado.

### Banco de dados

A auditoria somente leitura confirmou o índice único de DRAFT corrente em `enrollments` e ausência de DRAFTs duplicados. Também confirmou que a migration existente de identidade normalizada de Pessoas ainda não foi aplicada no banco auditado: colunas/índices normalizados e unicidade de CPF estão ausentes. Nenhuma migration foi executada ou criada nesta Sprint.

## Decisão arquitetural

Foi adotado o **Cenário B**: `Enrollment` em estado `DRAFT` é a representação canônica da pré-matrícula. Não foi criada entidade `PRE_ENROLLMENT`, novo estado, tabela ou estrutura paralela. O link/token público seguro permanece fora do escopo.

## Fluxo implementado

`PreEnrollmentApplicationService.startPreEnrollment`:

1. exige política de autorização injetada, `userId` e `unitId` (fail closed);
2. aceita somente `responsible`, `student` e `enrollment.startDate` e rejeita campos fora do contrato;
3. resolve/cria a Pessoa do responsável com identidade forte;
4. resolve/cria o perfil `RESPONSIBLE`;
5. resolve/cria Pessoa e perfil `STUDENT` pelo serviço já existente;
6. resolve/cria o vínculo ativo `RESPONSIBLE` responsável-aluno;
7. delega a consulta de estado, conflito e criação/reutilização do DRAFT à facade de Enrollment;
8. prepara o evento de auditoria existente, sem incluir CPF ou outros dados pessoais;
9. retorna somente identificadores, estado, resultado e flags de reutilização.

O serviço não foi ligado a controller/rota nesta Sprint. Isso evita uma superfície HTTP sem o composition root de autenticação/autorização por unidade definido.

## Entrada e resultado

A entrada usa apenas campos já mapeados pelos serviços existentes: dados mínimos ou `personId` de responsável/aluno, dados opcionais de vínculo e `enrollment.startDate`. Um `personId` explícito inexistente agora falha com `PERSON_NOT_FOUND`; ele nunca é convertido silenciosamente em criação de outra Pessoa.

Resultados de sucesso seguem os contratos existentes de auditoria de Enrollment:

- `DRAFT_CREATED`;
- `DRAFT_REUSED`.

ACTIVE e `ENROLLMENT_STATE_CONFLICT` continuam sendo erros estruturados do domínio de Enrollment. O resultado contém apenas IDs, `enrollmentStatus: "DRAFT"` e flags `reused`; objetos internos e dados pessoais não são retornados.

## Idempotência e concorrência

- Pessoa: reutiliza `PersonApplicationService`/resolução de identidade forte.
- Perfis: consulta no máximo dois candidatos ativos; um é reutilizado e múltiplos geram conflito para revisão assistida.
- Vínculo: consulta a chave lógica responsável + aluno + tipo + status; um é reutilizado e múltiplos geram conflito.
- Enrollment: reutiliza a facade/repository já existentes, incluindo consulta de estado, lock existente e índice único físico de DRAFT corrente.
- Chamadas simultâneas ao orquestrador convergem para o mesmo DRAFT no teste dirigido.

Não foi criada uma segunda estratégia de lock. O `GET_LOCK` existente no repository de Enrollment usa o query runner geral; como ele pode adquirir conexões diferentes entre aquisição e liberação, o índice único é a proteção física confiável no banco auditado. Isso deve ser corrigido com conexão dedicada em Sprint futura.

## Estratégia transacional

Os serviços atuais de Pessoa, perfil, vínculo e Enrollment não aceitam uma transação compartilhada. Uma refatoração ampla foi evitada. O fluxo é sequencial, idempotente e retomável: se uma etapa posterior falhar, uma nova chamada reutiliza os artefatos anteriores.

O índice único de Enrollment protege o DRAFT, mas não há unicidade física equivalente auditada para perfis e vínculos. Portanto, concorrência entre processos nessas etapas ainda é risco residual.

## Segurança e conflitos

- autorização por unidade obrigatória e injetada;
- exigência de identidade forte ao criar Pessoa;
- falha fechada para ID explícito inexistente;
- allowlist de campos e data ISO válida;
- erros inesperados sanitizados;
- logs/auditoria apenas com IDs e correlação;
- conflitos de perfis, vínculos e Enrollment não são resolvidos silenciosamente;
- nenhum dado financeiro, token ou contrato é aceito ou criado.

## Arquivos

Criados:

- `backend/src/domains/pessoas/application/services/pre-enrollment-application.service.js`;
- `backend/src/domains/pessoas/application/services/pre-enrollment-application.service.test.js`;
- `backend/src/domains/pessoas/application/services/relationship-application.service.test.js`;
- `docs/BACKEND/SPRINT_28_1.md`.

Alterados:

- `backend/src/domains/pessoas/application/services/index.js`;
- `backend/src/domains/pessoas/application/services/person-application.service.js`;
- `backend/src/domains/pessoas/application/services/person-application.service.test.js`;
- `backend/src/domains/pessoas/application/services/profile-application.service.js`;
- `backend/src/domains/pessoas/application/services/profile-application.service.test.js`;
- `backend/src/domains/pessoas/application/services/relationship-application.service.js`;
- `backend/src/domains/pessoas/relationships/relationship.repository.js`.

## Testes cobertos

- criação e reutilização do DRAFT;
- bloqueio de ACTIVE e de conflito de estado;
- reutilização de Pessoas, perfis e vínculo;
- repetição sem duplicação;
- entrada inválida e rejeição de campo financeiro;
- autorização ausente/negada;
- falha de infraestrutura sanitizada;
- ausência de efeito financeiro e de ativação;
- retorno/log sem dados pessoais;
- chamadas simultâneas criando um único DRAFT;
- queries e regras de resolução de Pessoa, perfil e vínculo.

## Validações executadas

- Testes dirigidos do novo orquestrador, serviços de Pessoa/perfil/vínculo/aluno e regressão da conversão CRM: **58/58 aprovados**.
- Testes canônicos de Enrollment (application service, facade, boundary de aluno e repository): **48/48 aprovados**.
- Total: **105 casos únicos aprovados**; um teste do repository de Enrollment foi executado nas duas baterias.
- ESLint somente nos arquivos JavaScript da Sprint: **0 erros**.
- `npm run typecheck` (`tsc --noEmit`): **aprovado**.
- `npm run ci:secrets`: **2.299 arquivos verificados, 0 achados**.
- `git diff --check`: **aprovado**; apenas avisos informativos de conversão futura LF/CRLF do Git.

## Limites e riscos residuais

- Nenhuma rota/controller foi criada; a integração HTTP depende de um composition root com política real de unidade.
- O banco auditado ainda não recebeu a migration existente de identidade normalizada de Pessoas; criação por CPF não deve ser exposta em produção antes da regularização.
- Perfis e vínculos não possuem constraint única para suas chaves lógicas.
- O fluxo não possui transação compartilhada entre domínios.
- O named lock de Enrollment deve usar a mesma conexão para adquirir e liberar.
- Não há token/link público, pagamentos, contratos, CRM obrigatório ou ativação automática.

## Recomendação para a Sprint 28.2

1. Auditar duplicidades e aplicar, em janela controlada, a migration já existente de identidade normalizada/única de Pessoas.
2. Definir constraints ou uma estratégia transacional/concorrente para perfis e vínculos após saneamento dos dados.
3. Ajustar o named lock de Enrollment para uma conexão dedicada.
4. Criar o composition root autenticado com autorização real de unidade e testes de integração.
5. Só depois projetar convite de matrícula com token criptograficamente forte, hash persistido, expiração, uso único e revogação.
