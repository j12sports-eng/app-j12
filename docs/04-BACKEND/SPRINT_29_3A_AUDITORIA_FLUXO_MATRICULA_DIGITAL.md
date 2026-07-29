# Sprint 29.3A — Auditoria de prontidão do fluxo de matrícula digital

**Data da auditoria:** 2026-07-29

**Branch auditada:** `sprint-23`

**HEAD auditado:** `d68369a` (`docs(enrollments): document multi-tenant security architecture`)
**Natureza:** diagnóstico documental, sem alteração de código, testes, banco, infraestrutura, rotas ou deploy

## 1. Objetivo

Determinar, a partir do código versionado, se o J12 Sports Hub dispõe hoje de um fluxo canônico e pronto para produção que percorra:

`origem da matrícula -> DRAFT -> convite -> formulário -> documentos -> contrato -> revisão -> turma -> ativação -> financeiro -> portal do responsável`.

O resultado é **não pronto de ponta a ponta**. Existem componentes funcionais e testados isoladamente, mas não há uma orquestração de produção que conecte todas as etapas. O maior risco imediato é que as rotas de confirmação atualmente montadas promovem `DRAFT` para `ACTIVE` sem exigir conclusão cadastral, documentos, contrato, revisão administrativa, turma ou preparação financeira.

## 2. Escopo e método

Foram inspecionados estaticamente:

- bootstrap e montagem de rotas em `backend/src/server.js`;
- domínio `backend/src/domains/enrollments`;
- entradas relacionadas em `backend/src/domains/crm` e `backend/src/domains/pessoas`;
- rotas legadas `backend/src/routes/public.routes.js` e `backend/src/routes/responsaveis.routes.js`;
- migrations e seu catálogo de dependências em `backend/src/database/migrations` e `backend/src/database/migration-runner/migration-dependencies.js`;
- frontend público em `src/routes/matricula.$token.tsx` e `src/features/enrollments`;
- testes unitários, de integração, migração e frontend existentes no repositório.

Não foram executados testes, migrations ou consultas ao banco. Portanto, “há migration” significa apenas **artefato versionado**; não significa que a tabela ou constraint esteja aplicada em qualquer ambiente.

### 2.1 Vocabulário de prontidão

| Classificação | Significado nesta auditoria |
|---|---|
| **Montado e alcançável** | O bootstrap registra a rota e a cadeia pode ser chamada por HTTP. |
| **Implementado, não montado** | Há código de domínio/aplicação/composição, mas o bootstrap não o expõe. |
| **Bloqueado de propósito** | O código existe, porém responde/falha fechado por ausência de pré-condição canônica. |
| **Fundação persistente** | Há entity/repository/migration, sem afirmar aplicação no banco nem fluxo operacional. |
| **Legado paralelo** | Fluxo operacional que usa modelo/tabelas diferentes e não completa a matrícula digital moderna. |
| **Ausente** | Não foi encontrada implementação produtiva para a capacidade. |
| **Não verificado** | Exigiria banco, ambiente, infraestrutura externa ou execução proibida pelo escopo. |

## 3. Estado atual

O domínio moderno consegue criar/reutilizar `DRAFT`, resolver convite por token, atualizar cadastro e armazenar documentos quando todas as relações necessárias já existem. Também possui fundações para contrato, revisão, ativação, turma e financeiro. Isso não forma um fluxo operacional único.

Os bloqueios centrais são:

1. o produtor de `DRAFT` alcançável pelo CRM não persiste o ownership completo do responsável exigido pelo formulário digital;
2. as rotas administrativas de convite existem, mas não são montadas;
3. não há orquestração produtiva que crie `digital_enrollment_progress` para iniciar o formulário;
4. o avanço para `REVIEW` é fail-closed, sem política documental e contrato operacionais na composição pública;
5. contrato e aceite estão deliberadamente bloqueados;
6. revisão administrativa, vínculo de turma e ativação transacional não têm entrada HTTP montada;
7. a confirmação HTTP montada ignora essas pré-condições;
8. o evento de confirmação não cria obrigação/cobrança;
9. o portal do responsável continua baseado no modelo legado.

## 4. Fluxo funcional pretendido e fluxo realmente alcançável

### 4.1 Fluxo pretendido

```text
responsável/aluno/unidade confiável
  -> matrícula DRAFT com ownership completo
  -> convite administrativo seguro
  -> progresso retomável
  -> cadastro
  -> documentos obrigatórios
  -> contrato versionado e aceite probatório
  -> revisão administrativa
  -> turma da mesma unidade
  -> ativação transacional
  -> obrigação/cobrança idempotente
  -> acompanhamento no portal
```

### 4.2 Fluxo moderno alcançável no bootstrap atual

```text
CRM autenticado -> DRAFT parcial
                           X não há rota admin montada para criar convite

token previamente provisionado -> formulário público -> DOCUMENTS
                                                   X REVIEW bloqueado

gestor autenticado -> confirmação direta DRAFT -> ACTIVE
                                            X sem gates digitais
                                            X sem turma
                                            X sem financeiro
```

O fluxo legado `/public/enrollments` é alcançável, mas grava `j12_alunos`/`j12_matriculas_publicas`; ele não é uma entrada equivalente para o agregado moderno `enrollments`.

## 5. Matriz final de prontidão

### 5.1 Classificação das 19 etapas esperadas

| # | Etapa funcional | Classificação | Evidência/limite real |
|---:|---|---|---|
| 1 | Criar ou reutilizar Enrollment DRAFT | **PARCIAL** | Núcleo idempotente funciona; CRM montado cria DRAFT, mas sem ownership completo do responsável/progresso. |
| 2 | Identificar responsável | **PARCIAL** | Pessoas resolve/cria responsável em serviço não montado; CRM não o conecta ao Enrollment. |
| 3 | Identificar ou criar aluno | **IMPLEMENTADA E MONTADA** pelo CRM | Conversão CRM resolve/cria aluno e DRAFT; não completa sozinha a jornada digital. |
| 4 | Vincular responsável-aluno | **IMPLEMENTADA, MAS NÃO MONTADA** | Serviço Pessoas cria relacionamento; entrada HTTP correspondente não está no bootstrap. |
| 5 | Selecionar unidade confiável | **IMPLEMENTADA E MONTADA** nas entradas modernas | ActorContext nas rotas Enrollment; CRM usa unidade persistida do lead. Não vale para o legado público. |
| 6 | Selecionar/atribuir turma | **IMPLEMENTADA, MAS NÃO MONTADA** | Service/repository existem; não há rota Enrollment nem integração com o fluxo digital. |
| 7 | Selecionar template de contrato | **BLOQUEADA** | Seleção canônica por unidade é o blocker explícito do serviço. |
| 8 | Gerar contrato digital | **FUNDAÇÃO PREPARADA / BLOQUEADA** | Entity e migration existem; faltam repository/composição produtivos e o serviço falha fechado. |
| 9 | Criar convite digital | **IMPLEMENTADA, MAS NÃO MONTADA** | Service/controller/router/composition admin existem; bootstrap não registra a rota. |
| 10 | Enviar/disponibilizar convite | **AUSENTE** | Token bruto só é devolvido no comando administrativo; não há canal de entrega integrado. |
| 11 | Acessar por token | **IMPLEMENTADA E MONTADA** | Prefixo público `/api/enrollments/digital-invitations/public`; depende de convite previamente provisionado. |
| 12 | Preencher formulário | **PARCIAL** | Rotas e persistência reais; ownership/progresso não são produzidos pela jornada montada e REVIEW é bloqueado. |
| 13 | Aceitar/assinar | **BLOQUEADA** | Evidência eletrônica foi modelada, mas não há runtime operacional; assinatura externa/ICP não existe. |
| 14 | Enviar documentos | **PARCIAL** | Upload real e montado; faltam scan, retenção, regra obrigatória integrada e revisão admin montada. |
| 15 | Confirmar matrícula | **IMPLEMENTADA E MONTADA** | DRAFT -> ACTIVE funciona diretamente, sem os gates digitais. |
| 16 | Ativar Enrollment com readiness | **BLOQUEADA** | Orquestrador/executor existem fail-closed; a confirmação simples os contorna. |
| 17 | Gerar cobrança | **AUSENTE no fluxo** | Fundação financeira existe; confirmação não chama writer/listener. |
| 18 | Integrar financeiro | **FUNDAÇÃO PREPARADA** | Obrigações/bridges e serviços isolados existem; não há orquestração ponta a ponta. |
| 19 | Consultar no portal do responsável | **LEGADA E ISOLADA** | Portal opera sobre estruturas legadas, sem visão da matrícula digital moderna. |

### 5.2 Matriz técnica condensada

| Etapa | Estado | Persistência real quando alcançada | Proteção multiunidade | Principal lacuna |
|---|---|---:|---|---|
| Origem moderna pelo CRM | Parcial, montada | Sim | Unidade do lead persistido; gestor global | Não cria ownership completo do responsável |
| Pré-matrícula Pessoas | Implementada, não montada | Sim, se chamada | Contexto resolvido pela composição | Não conecta responsável ao `Enrollment`; serviço paralelo antigo está defasado |
| `DRAFT` moderno | Funcional | Sim | Serviço/repositório usam `unitId` | Constraint de DRAFT não inclui unidade; `unit_id` ainda é nullable |
| Convite administrativo | Implementado, não montado | Sim, se chamado | ActorContext/role guard na composição | Nenhuma rota no bootstrap; distribuição segura ausente |
| Resolução pública do convite | Montada | Leitura | Token -> convite -> matrícula/unidade | Bearer token reutilizável; limiter não distribuído |
| Formulário retomável | Parcial, montado | Sim | Ownership transitivo por convite/matrícula | Depende de relações/progresso sem produtor canônico |
| Documentos digitais | Parcial, montado | Sim | Escopo por matrícula e relacionamento | Sem antivírus, criptografia, retenção e revisão admin montada |
| Contrato e aceite | Bloqueado de propósito | Não no runtime | Modelo prevê unidade/ownership | Seleção canônica de template ausente; sem repository/rota/composição operacional |
| Revisão administrativa | Implementada, não montada | Sim, se chamada | Serviços exigem contexto | Sem controller/rota; formulário não chega a `REVIEW` |
| Vínculo de turma | Implementado, não montado | Sim, se chamado | Não foi encontrada validação explícita de mesma unidade | Não participa da ativação; índice permite múltiplas turmas ativas diferentes |
| Confirmação simples | Montada | Sim | ActorContext nas rotas montadas | Ativa sem gates e sem transação que cubra concorrência |
| Ativação digital completa | Bloqueada de propósito, não montada | Não | Readiness prevê contexto | Writer/downstreams/transação produtiva ausentes |
| Financeiro moderno | Fundação, não integrado | Não pela confirmação | Ownership transitivo | Sem listener/outbox/writer conectado ao evento |
| Portal do responsável | Legado paralelo | Sim no legado | Regras próprias do portal legado | Não acompanha o agregado digital moderno |

## 6. Mapa de componentes e exposição do domínio

O domínio separa entities, policies, services, repositories, controllers, routes e compositions. Há boa cobertura de responsabilidades isoladas, porém a simples presença de um arquivo não implica exposição produtiva.

| Camada | Componentes encontrados | Leitura operacional |
|---|---|---|
| Entities/enums | Enrollment, convite, progresso, documento, contrato/aceite e revisão administrativa | Enrollment/convite/form/documento são usados em caminhos reais; contrato/revisão são fundações |
| Value objects/schemas/validators | Barrel de value objects vazio; não há diretório dedicado de schemas/validators no domínio | Validação está dispersa em entities, services, controllers, policies e allowlists |
| Application services/use cases | DRAFT/confirmação, aluno, convite, formulário, documento, contrato, revisão, ativação, turma, financeiro, agenda/notificação | Mistura serviços operacionais, não montados e fail-closed; não há um use case canônico ponta a ponta |
| Facade/events | `EnrollmentFacade`, eventos DRAFT/confirmed e dispatcher interno | Facade participa do caminho moderno; dispatcher não integra downstream financeiro |
| Repositories/storage | MySQL/memory para Enrollment, convite, progresso, documento, revisão e turma; filesystem/memory para arquivo | Persistência existe por capacidade, mas contrato não tem repository produtivo |
| Controllers/routes | Admin, “public” autenticado, internal, convite admin/público, formulário e documentos | Somente o subconjunto confirmado no bootstrap é alcançável |
| Compositions | Contexto de rota, público digital, convite admin, revisão e turma | Algumas são testadas, mas não consumidas por `server.js` |
| Migrations | Enrollment, ownership, membership, convite, progresso, documentos, contrato, revisão, turma e financeiro | Artefatos versionados; aplicação real não verificada |
| Tests | Domain, application, repository, controller, route, integration, migration e frontend | Boa cobertura isolada; E2E canônico ausente |
| Exports | Barrels por camada e boundary do domínio | Incompletos para várias entities/services/controllers digitais |
| Bootstrap | `backend/src/server.js` | Fonte de verdade para “montada” nesta auditoria |

Exemplos importantes:

- `backend/src/domains/enrollments/domain/value-objects/index.js` não define validadores canônicos; validações estão distribuídas entre entities, serviços, controllers e allowlists;
- `backend/src/domains/enrollments/domain/entities/index.js` não exporta todas as entities digitais existentes;
- `backend/src/domains/enrollments/application/services/index.js` não exporta todos os serviços digitais, inclusive os de contrato/documentos;
- `backend/src/domains/enrollments/presentation/controllers/index.js` não exporta os controllers de formulário/documentos;
- várias compositions importam implementações diretamente, mas não são consumidas pelo bootstrap.

Isso é risco de integração e discoverability, não prova isolada de defeito funcional.

## 7. Rotas efetivamente montadas

### 7.1 Matrícula administrativa autenticada

Montadas em `/admin/enrollments` e `/api/admin/enrollments`:

- `GET /students/search`;
- `GET /status`;
- `GET /current-draft`;
- `GET /current-active`;
- `POST /:enrollmentId/confirm`.

A cadeia usa autenticação, autorização gerencial e ActorContext multiunidade antes de `backend/src/domains/enrollments/presentation/controllers/enrollment-admin.controller.js`. Seletores de unidade fornecidos pelo cliente não substituem o contexto confiável.

### 7.2 Matrícula autenticada sob o nome “public”

Montadas em `/enrollments` e `/api/enrollments`:

- `GET /status`;
- `GET /current-draft`;
- `GET /current-active`;
- `POST /:enrollmentId/confirm`.

Apesar do nome de arquivo `enrollment-public.routes.js`, essas rotas exigem autenticação, autorização gerencial e ActorContext; não são públicas anônimas.

### 7.3 Convite público por token

Montado **somente** sob `/api/enrollments/digital-invitations/public`:

- `GET /:token`;
- `GET /:token/form`;
- `PATCH /:token/responsible`;
- `PATCH /:token/student`;
- `PATCH /:token/address`;
- `PATCH /:token/additional-information`;
- `POST /:token/advance`;
- `GET /:token/review`;
- `POST /:token/documents`;
- `GET /:token/documents`;
- `DELETE /:token/documents/:id`;
- `GET /:token/documents/:id/download`.

Essas rotas usam o token opaco como credencial. Não usam sessão nem ActorContext, por desenho.

### 7.4 Entrada CRM

`backend/src/domains/crm/presentation/routes/crm-internal.routes.js` expõe `POST /internal/crm/leads/:leadId/draft-enrollment` e o alias `/api/internal/crm/...` via montagem do bootstrap. A unidade vem do lead persistido e o comando exige gestor global; não é a mesma cadeia de membership/ActorContext das rotas administrativas de Enrollment.

### 7.5 Entrada pública legada

Montadas em `/public` e `/api/public`:

- `GET /enrollments/next-number`;
- `POST /enrollments`.

O controller legado persiste aluno/matrícula pública nas estruturas `j12_*`, com status `experimental`. Não cria o agregado moderno `enrollments`.

## 8. Rotas existentes, mas não montadas

Não há registro no `backend/src/server.js` para as seguintes factories:

- `backend/src/domains/enrollments/presentation/routes/enrollment-invitation-admin.routes.js`, que define criar, renovar, revogar e consultar convite atual sob `/admin/enrollments/:enrollmentId/digital-invitations...`;
- `backend/src/domains/enrollments/presentation/routes/enrollment-internal.routes.js`, que define consultas e confirmação sob `/internal/enrollments`;
- `backend/src/domains/pessoas/presentation/routes/pre-enrollment-internal.routes.js`, que define `POST /internal/pre-enrollments`.

Também não foram encontradas rotas produtivas para template/contrato/aceite digital, revisão administrativa digital, ativação transacional digital ou vínculo de turma pelo domínio Enrollment.

### 8.1 Matriz completa de rotas e bootstrap

| Rota relativa | Método | Arquivo de router | Controller | Autenticação | Autorização | ActorContext | Exposição | Montada? | Prefixo real | Status funcional | Dependências | Risco principal |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `/students/search`, `/status`, `/current-draft`, `/current-active` | GET | `enrollment-admin.routes.js` | `EnrollmentAdminController` | `requireAuth` | gestor do sistema | Sim | Privada | **Sim** | `/admin/enrollments` e `/api/admin/enrollments` | Leitura operacional | membership, repository e unidade confiável | Banco/migration de ownership não verificados |
| `/:enrollmentId/confirm` | POST | `enrollment-admin.routes.js` | `EnrollmentAdminController` | `requireAuth` | gestor do sistema | Sim | Privada | **Sim** | `/admin/enrollments` e `/api/admin/enrollments` | Confirmação simples operacional | DRAFT na unidade | Ativa sem gates digitais |
| `/status`, `/current-draft`, `/current-active` | GET | `enrollment-public.routes.js` | `EnrollmentPublicController` | `requireAuth` | gestor do sistema | Sim | Privada, apesar do nome | **Sim** | `/enrollments` e `/api/enrollments` | Leitura operacional | membership, repository | Nome “public” pode induzir erro documental |
| `/:enrollmentId/confirm` | POST | `enrollment-public.routes.js` | `EnrollmentPublicController` | `requireAuth` | gestor do sistema | Sim | Privada | **Sim** | `/enrollments` e `/api/enrollments` | Confirmação simples operacional | DRAFT na unidade | Mesmo bypass de readiness |
| `/:enrollmentId/digital-invitations`, `/renew`, `/revoke`, `/current` | POST/GET | `enrollment-invitation-admin.routes.js` | `EnrollmentInvitationAdminController` | Exigida pela factory | role guard | Exigido pela factory | Privada | **Não** | Nenhum prefixo registrado | Implementada, inalcançável por HTTP real | composition, DRAFT, repository e context middlewares injetados | Confundir testes da factory com rota operacional |
| `/:token` | GET | `enrollment-invitation-public.routes.js` | `EnrollmentInvitationPublicController` | Não; token bearer | Token válido | Não | Pública | **Sim** | `/api/enrollments/digital-invitations/public` | Resolve convite/DRAFT | convite ACTIVE e não expirado | Replay e limiter local |
| `/:token/form`, seções, `/advance`, `/review` | GET/PATCH/POST | `enrollment-invitation-public.routes.js` | `DigitalEnrollmentFormController` | Não; token bearer | Ownership resolvido pelo token | Não | Pública | **Sim** | `/api/enrollments/digital-invitations/public` | Parcial até DOCUMENTS | DRAFT com responsável/aluno/relação/progresso | Pré-requisitos sem produtor e REVIEW bloqueado |
| `/:token/documents`, `/:id`, `/:id/download` | POST/GET/DELETE | `enrollment-invitation-public.routes.js` | `DigitalEnrollmentDocumentController` | Não; token bearer | Matrícula + relacionamento do token | Não | Pública | **Sim** | `/api/enrollments/digital-invitations/public` | Upload/list/download/delete reais | progresso, repository e filesystem | PII, malware, retenção e replay |
| `/status`, `/current-draft`, `/current-active`, `/:id/confirm` | GET/POST | `enrollment-internal.routes.js` | `EnrollmentInternalController` | `requireAuth` | gestor do sistema | Não | Privada interna | **Não** | `/internal/enrollments` pretendido | Implementada, não exposta | repository/facade | Cadeia sem ActorContext e risco de montagem indevida |
| `/leads/:leadId/draft-enrollment` | POST | `crm-internal.routes.js` | `CrmLeadEnrollmentConversionController` | `requireAuth` | gestor global | Não; contexto do lead | Privada interna | **Sim** | `/internal/crm` e `/api/internal/crm` | DRAFT parcial operacional | lead persistido, People e Enrollment | Não cria ownership completo do responsável |
| `/` | POST | `pre-enrollment-internal.routes.js` | `PreEnrollmentController` | `requireAuth` | gestor global | Contexto próprio da composition | Privada interna | **Não** | `/internal/pre-enrollments` pretendido | Serviço implementado, rota não exposta | People, relações e Enrollment boundary | Resultado do responsável não é anexado ao Enrollment |
| contrato/template/aceite | — | Ausente | Ausente | — | — | — | — | **Não** | Nenhum | Bloqueado/ausente | selector, repositories e composition inexistentes | Declarar fundação como produto pronto |
| `/enrollments/next-number`, `/enrollments` | GET/POST | `backend/src/routes/public.routes.js` | Controller público legado | Não | Pública + limiter global | Não | Pública | **Sim** | `/public` e `/api/public` | Legada e operacional | tabelas `j12_*` | Unidade/turma vindas do cliente e modelo paralelo |

Nomes de router/controller na matriz correspondem aos arquivos em `backend/src/domains/enrollments/presentation`; a coluna “montada” foi confirmada exclusivamente em `backend/src/server.js`. Uma rota sem prefixo registrado permanece “não montada”, mesmo que seus testes de factory passem.

## 9. Enrollment DRAFT

`backend/src/domains/enrollments/application/services/enrollment-application.service.js` exige unidade confiável e usa `createDraftIfNotExists`. `backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment.repository.js` usa lock nomeado com unidade e, em conflito, relê o DRAFT no mesmo escopo.

`backend/src/domains/enrollments/application/services/student-enrollment-application.service.js` resolve o estado do aluno, reutiliza DRAFT e bloqueia `ACTIVE`/conflito. Quando chamado por uma composição adequada, o núcleo DRAFT é persistente e idempotente no nível de aplicação.

Há, porém, divergência física: a migration `backend/src/database/migrations/20260629190607_add_active_draft_unique_constraint_to_enrollments.js` protege o DRAFT ativo por aluno/perfil sem incluir `unit_id`. Isso pode impedir DRAFTs legítimos em unidades diferentes e não corresponde ao lock/retry unit-scoped do repository.

Além disso, a entrada CRM fornece os IDs do aluno e a unidade, mas não os IDs de pessoa/perfil/relacionamento do responsável que `backend/src/domains/enrollments/infrastructure/digital-enrollment-form.gateway.js` exige. Logo, “DRAFT criado” não significa “DRAFT apto a abrir o formulário digital”.

## 10. Confirmação versus ativação digital

As rotas montadas chamam `confirmDraftEnrollment` diretamente. O serviço:

- carrega matrícula na unidade confiável;
- devolve `404` para ausência/cross-unit;
- trata `ACTIVE` como já confirmada;
- aceita somente `DRAFT`;
- consulta se já há matrícula ativa;
- altera o status para `ACTIVE` e grava auditoria de confirmação.

Ele **não exige** responsável vinculado, progresso, documentos, contrato aceito, revisão aprovada, turma ou financeiro. A leitura “não há ativa” e o update também não estão cobertos por uma única transação, e não há constraint física de uma única matrícula `ACTIVE` por aluno/unidade. Existe risco de corrida.

As classes `digital-enrollment-activation-*` e a policy de readiness representam outra trilha: são fundações fail-closed e retornam `DIGITAL_ENROLLMENT_ACTIVATION_NOT_AVAILABLE` sem writer, transaction boundary e downstreams produtivos. Elas não são chamadas pela confirmação montada.

## 11. Convite digital

O convite usa 32 bytes aleatórios codificados em base64url e persiste apenas SHA-256 do token. A entity/repository validam sintaxe, hash, status `ACTIVE`, expiração, matrícula `DRAFT` e unidade. Falhas públicas convergem para resposta genérica, reduzindo enumeração.

A migration `backend/src/database/migrations/20260720120000_create_enrollment_digital_invitations_table.js` prevê hash único e uma coluna gerada/índice para um único convite `ACTIVE` por matrícula. O token bruto é devolvido apenas na criação/renovação.

Lacunas operacionais:

- a rota admin de criação não está montada;
- não há envio/notificação ou canal seguro de distribuição do token;
- `markInvitationUsed` existe, mas não foi encontrado consumidor produtivo;
- concluir/avançar o formulário não consome o convite, que continua reutilizável até expirar ou ser revogado;
- o rate limiter global é em memória e por IP, não distribuído e não específico por token;
- logs estruturados e timestamps existem, mas não há trilha persistente dedicada a cada uso público.

Consequentemente, **ninguém cria convite por HTTP no bootstrap atual**. Se a composition for chamada programaticamente, ela exige Enrollment DRAFT, ActorContext autenticado da mesma unidade e papel administrativo aceito pelo role guard. O acesso público posterior não usa ActorContext: sua autorização é exclusivamente o token válido.

O `unit_id` do convite é `VARCHAR(64)` e não possui FK direta para `j12_unidades`; a matrícula moderna usa `BIGINT` assinado após a migration de ownership. É uma incompatibilidade histórica a normalizar antes da abertura produtiva.

## 12. Contrato digital e aceite

`backend/src/domains/enrollments/application/services/digital-enrollment-contract.service.js` está deliberadamente bloqueado por `DIGITAL_ENROLLMENT_CONTRACT_TEMPLATE_SELECTION_NOT_CANONICAL`. Criar, publicar, obter ou aceitar não constitui capacidade operacional.

A fundação modela:

- template por unidade, nome e versão, com HTML sanitizado, hash de conteúdo, schema, vigência e publicação;
- contrato com snapshot/hash do conteúdo e relacionamento responsável;
- aceite com data, método, termos/consentimentos, convite, request/correlation ID e hashes de IP/user-agent.

A migration `backend/src/database/migrations/20260725160000_create_digital_enrollment_contract_foundation.js` cria o modelo relacional e FKs transitivas, mas `digital_enrollment_contract_templates.unit_id` é `VARCHAR(64)` e não tem FK para a unidade canônica `BIGINT`. Não há repository MySQL, controller, rotas nem composition produtiva para esse fluxo. A confirmação montada não consulta contrato ou aceite.

## 13. Formulário retomável

O frontend `src/routes/matricula.$token.tsx` implementa um wizard público de seis etapas. O backend permite apenas campos allowlisted:

- responsável: nome, e-mail e telefone;
- aluno: nome e data de nascimento;
- endereço: CEP, logradouro, número, bairro, cidade, UF e complemento;
- informações adicionais: atualmente nenhum campo gravável;
- avanço: somente `targetStep`.

Cada escrita exige `revision` inteiro positivo, com concorrência otimista. `backend/src/domains/enrollments/infrastructure/digital-enrollment-transaction.runner.js` cobre as atualizações de cadastro/progresso em transação. Escritas alteram `people` e `digital_enrollment_progress`, não confirmam a matrícula.

O gateway exige matrícula DRAFT com IDs exatos de responsável, perfil, relacionamento e aluno, além de uma linha de progresso. `ensureProgress` existe, porém não foi encontrado chamador produtivo que o execute ao criar DRAFT/convite. Assim, as rotas estão montadas, mas o pré-requisito não nasce do fluxo montado atual.

O avanço funciona até `DOCUMENTS`. `DOCUMENTS -> REVIEW` falha fechado porque a composition pública não injeta política/provedor de documentos nem serviço de contrato, e o gateway também bloqueia esse alvo sem o pipeline completo.

## 14. Documentos digitais

Upload, listagem, download e exclusão estão montados no fluxo público. Os tipos aceitos são CPF, RG, certidão de nascimento, comprovante de residência, foto e outro. Há limite de 10 MiB, allowlist de MIME/extensão e verificação de assinatura para PDF, JPEG, PNG e WEBP.

Metadados são persistidos por `backend/src/domains/enrollments/infrastructure/repositories/mysql-digital-enrollment-document.repository.js`. O provider padrão `backend/src/domains/enrollments/infrastructure/storage/filesystem-document-storage.provider.js` grava em `data/digital-enrollment-documents`, com chave UUID, modo restritivo e defesa contra path traversal. Listar/baixar/excluir revalida token, matrícula, relacionamento e ID do documento.

Limites:

- não há antivírus, sandbox, quarentena ou sanitização de PDF/imagem além da assinatura mágica;
- não há evidência de criptografia em repouso;
- não há política implementada de retenção, expurgo, legal hold ou atendimento LGPD;
- aprovação/rejeição existem em service/repository, mas não há rota administrativa montada;
- documentos `APPROVED` são imutáveis, enquanto `PENDING`/`REJECTED` podem ser removidos;
- a remoção do metadado precede a remoção física, podendo deixar arquivo órfão se o storage falhar;
- a tabela não guarda `unit_id`; o isolamento é transitivo por matrícula/relacionamento.

### 14.1 Revisão administrativa

Entities, policies, services, workflow, repository MySQL, transaction runner e composition existem em `backend/src/domains/enrollments`. A migration `backend/src/database/migrations/20260727150000_create_digital_enrollment_administrative_review.js` prevê estado atual único por matrícula, histórico de decisões e comandos idempotentes.

Não há controller/rota montada para submissão, aprovação, rejeição ou correção. O formulário público também não consegue chegar a `REVIEW`. Portanto, os testes da fundação não tornam a revisão operacional.

## 15. Turma

`backend/src/domains/enrollments/application/services/enrollment-class-link.service.js` implementa atribuição, transferência e reativação com transação, autorização, matrícula ativa, turma ativa e capacidade. A composition e os repositories existem e são testados, mas não há rota Enrollment montada e o serviço não é chamado na confirmação.

No fluxo moderno não existe tela/endpoint que escolha turma; quando chamado diretamente, o service recebe `classId` do ator administrativo autorizado. Já `src/routes/matricula.tsx` permite seleção enviada pelo cliente, porém pertence ao fluxo legado isolado e não cria `enrollment_class_links`.

Não foi encontrada verificação explícita de que `Enrollment.unitId` corresponda à unidade de `j12_turmas`. O índice `ux_enrollment_class_links_active` usa `(enrollment_id, class_id, status)`: impede duplicar o mesmo par/status, mas permite duas turmas diferentes com status `ACTIVE` para a mesma matrícula. A aplicação tenta impedir isso, porém falta invariante física equivalente.

Há ainda dois artefatos históricos, `20260701103000_add_enrollment_class_links_table.js` e `20260701120000_add_enrollment_class_links_table.js`, mais a reconciliação `20260713101500_reconcile_enrollment_class_links_indexes.js`. A ordem deve ser ensaiada; nenhuma aplicação em ambiente foi verificada nesta auditoria.

## 16. Financeiro

Confirmar matrícula não cria obrigação, cobrança, parcela ou PIX. `backend/src/domains/enrollments/application/services/enrollment-financial.service.js` prepara uma obrigação sem escrita por padrão; persistência requer writer e opção explícitos. A facade padrão não injeta writer financeiro nesse caminho.

Após confirmar, a facade emite `EnrollmentConfirmed`, mas `backend/src/domains/enrollments/application/events/enrollment-internal-event-dispatcher.js` apenas registra/retem eventos opcionalmente. Não há listener, fila ou outbox conectado ao financeiro; falha de dispatch ocorre depois da ativação e não a reverte.

As migrations de `enrollment_financial_obligations` e `enrollment_financial_bridges` fornecem FKs/índices e idempotência local — por exemplo, unicidade de `(enrollment_id, obligation_type)` —, mas não há idempotência ponta a ponta entre confirmação e cobrança. O financeiro/PIX legado permanece operacional em outro modelo e não comprova integração com o Enrollment moderno.

Não foi encontrado listener n8n, síncrono ou assíncrono, que consuma `EnrollmentConfirmed` e conclua essa integração.

## 17. Portal do responsável

O portal autenticado usa `backend/src/routes/responsaveis.routes.js` e estruturas legadas de alunos, contratos, documentos e financeiro. Sua prontidão frente ao fluxo moderno é:

| Capacidade | Estado |
|---|---|
| Visualizar Enrollment moderno | Ausente; a visão atual é de aluno legado |
| Continuar pré-matrícula moderna | Ausente no portal; existe apenas a tela pública isolada por token |
| Acessar convites digitais | Ausente como listagem autenticada |
| Aceitar contrato digital moderno | Ausente; contratos do portal são legados |
| Enviar documentos digitais | Parcial fora do portal pelo token; upload do portal usa modelo legado |
| Acompanhar status digital/revisão | Ausente |
| Consultar cobranças/pagar/PIX | Operacional no legado |
| Recibos digitais vinculados à matrícula moderna | Não identificado |

O frontend público aplica `no-store`, `no-referrer` e `noindex`, mas não substitui uma jornada autenticada nem conecta contrato/financeiro modernos.

## 18. Banco, migrations e invariantes

Esta matriz descreve arquivos versionados, não o estado de um banco real.

| Tabela | Finalidade | PK | FKs principais | Unique indexes | `unitId`/tipo físico | Ownership | Soft delete/status | Risco atual |
|---|---|---|---|---|---|---|---|---|
| `people` | Pessoa canônica | `id VARCHAR(64)` | Nenhuma no SQL-base | Identidade normalizada em migration posterior | Não possui | Derivado de relações/agregados | `active`; sem soft delete no SQL-base | PII sem ownership direto; deduplicação depende de migrations posteriores |
| `person_profiles` | Papel da pessoa | `id VARCHAR(64)` | SQL-base não declara FK para `people` | Pessoa/tipo em integridade posterior | Não possui | Transitivo pela pessoa/relação | `status` | Integridade distribuída entre app e migrations posteriores |
| `person_relationships` | Responsável-aluno | `id VARCHAR(64)` | SQL-base não declara FKs das pessoas | Relação ativa em integridade posterior | Não possui | Transitivo | `status` | Relação sem unidade direta; produtor canônico incompleto |
| `j12_unidades` | Unidade canônica | `id BIGINT` assinado | — | PK/índices do módulo de unidades | É a fonte canônica | Direto | Estado próprio do legado | Consumidores digitais usam tipos divergentes |
| `user_unit_memberships` | Identidade autenticável por unidade | `id VARCHAR(64)` | auth identity, criador/revogador e `unit_id -> j12_unidades.id` | identidade+unidade; default ativo gerado único | `BIGINT NOT NULL` | Direto | `status`, revogação; sem soft delete | Aplicação no banco não verificada |
| `enrollments` | Agregado da matrícula | `id VARCHAR(64)` | aluno pessoa/perfil; responsável pessoa/perfil/relação posteriores; unidade posterior | DRAFT ativo por aluno/perfil, **sem unidade** | `BIGINT NULL`, FK para `j12_unidades` | Direto após migration | `status`, `deleted_at` | Sem ACTIVE único; unidade nullable; DRAFT incompatível com escopo por unidade |
| `enrollment_digital_invitations` | Credencial pública | `id VARCHAR(64)` | Enrollment; atores de auditoria quando disponíveis | `token_hash`; Enrollment com convite ACTIVE gerado | `VARCHAR(64) NOT NULL`, sem FK de unidade | Direto lógico + Enrollment | `ACTIVE/REVOKED/USED`, expiração | Tipo incompatível, sem FK e consumo não conectado |
| `digital_enrollment_progress` | Etapa/revisão retomável | `id VARCHAR(64)` | Enrollment, relacionamento, convite atualizador | um registro por Enrollment | Sem coluna | Transitivo | `status`, etapa, `revision` | Sem criação no fluxo montado |
| `digital_enrollment_documents` | Metadados de upload | `id VARCHAR(64)` | Enrollment, progress por Enrollment, relacionamento | Enrollment+SHA-256; storage key | Sem coluna | Transitivo | `PENDING/APPROVED/REJECTED` | Sem retenção/expurgo/scan e sem unidade física |
| templates de contrato | Modelo versionado | `id VARCHAR(64)` | publicador auth identity; **sem FK de unidade** | unidade+nome+versão | `VARCHAR(64) NOT NULL` | Direto lógico | `DRAFT/PUBLISHED/ARCHIVED`, vigência | Incompatível com `BIGINT`; seleção bloqueada |
| contratos/aceites | Snapshot e evidência | `id VARCHAR(64)` | Enrollment, template, relação, convite | Enrollment+template+versão; um aceite por contrato | Sem coluna | Transitivo | contrato possui status; aceite é evidência | Runtime/repositories ausentes; aplicação da migration não verificada |
| revisão administrativa | Estado, decisões e comandos | IDs/`command_id` `VARCHAR(64)` | Enrollment, relação, review | um review por Enrollment; command PK idempotente | Sem coluna | Transitivo | status em review/decisão | Não consta no catálogo de dependências; não montada |
| `enrollment_class_links` | Turma atual/histórico | `id VARCHAR(64)` | Enrollment e `j12_turmas` | Enrollment+turma+status | Sem coluna | Transitivo | `status` e histórico | Permite duas turmas ACTIVE diferentes; mesma unidade não comprovada |
| obrigações/bridges financeiros | Preparação e ligação com cobrança | obrigação `id VARCHAR(64)`; bridge usa `obligation_id` | Enrollment; obrigação; cobrança; parcela; aluno legado | Enrollment+tipo; charge única; installment única | Sem coluna | Transitivo | `PREPARED`/`LINKED` etc. | Sem listener/outbox/orquestração; tabelas reais não verificadas |

Dependências catalogadas relevantes:

- People precede Enrollment;
- Enrollment e constraint de DRAFT precedem convite;
- People + convite precedem progresso;
- progresso precede documentos;
- identidade autenticável + progresso precedem contrato;
- Enrollment + classes precedem class links;
- obrigação financeira precede bridge;
- ownership de unidade é uma migration posterior à tabela Enrollment.

A migration de revisão administrativa ainda não consta no catálogo `MIGRATION_DEPENDENCIES`, enquanto suas FKs dependem de Enrollment e relacionamentos. Isso aumenta o risco de ordem em instalações novas.

## 19. Testes existentes e o que eles comprovam

Não foram executados testes nesta auditoria. A leitura encontrou cobertura relevante para:

- DRAFT, ownership e repository: `backend/src/domains/enrollments/application/tests/enrollment-application.service.test.js`, `student-enrollment-application.service.test.js`, `enrollment-unit-ownership.application.test.js` e `infrastructure/repositories/mysql-enrollment.repository.test.js`;
- isolamento de rotas/contexto: `backend/src/domains/enrollments/presentation/routes/enrollment-unit-isolation.integration.test.js` e `enrollment-context.routes.test.js`;
- convite: entity/service/repository/controller/route/composition e migration;
- formulário/progresso: service, gateway, transaction runner, controller, migration e testes frontend;
- documentos: policy/service/migration e caminhos públicos;
- contrato: entity/service/migration, com testes que confirmam o bloqueio fail-closed;
- revisão e ativação: services/repositories/transactions/policies, incluindo testes de indisponibilidade sem adapters;
- turma: atribuição, transferência, repository, transaction e composition;
- financeiro: preparação sem escrita e repositories/migrations das fundações;
- CRM: conversão, idempotência, auditoria e observabilidade.

Esses testes comprovam contratos isolados no código testado. Eles não comprovam montagem no bootstrap, aplicação das migrations, storage/limiter distribuídos ou a jornada completa em ambiente real.

### 19.1 Matriz de cobertura por etapa

| Etapa | Testes/camadas encontrados | O que cobrem | Lacuna | Risco residual |
|---|---|---|---|---|
| Pessoas/relacionamento/DRAFT | unit/application/repository e CRM | Reuso, conflitos, criação e idempotência local | Entrada canônica transacional completa | DRAFT inutilizável pelo formulário |
| Contexto multiunidade | entity/application/route/integration | ActorContext e isolamento das rotas montadas | Banco real, tipos legados e entradas paralelas | Cross-unit por caminho não canônico |
| Convite admin/público | entity/service/repository/controller/router/composition/migration | Hash, expiração, revogação, roles e respostas seguras | Bootstrap admin, entrega e consumo one-time | Replay/vazamento |
| Formulário/progresso | entity/service/gateway/transaction/controller/frontend/migration | Allowlists, revision, writes e ownership | Jornada que provisiona pré-condições; REVIEW real | Fluxo interrompido |
| Documentos | entity/policy/service/controller/migration | Tipos, limites, ownership e estados | Repository MySQL/FS integrado em E2E, malware e retenção | Exposição de PII/arquivo hostil |
| Contrato/aceite | entity/service/migration | Snapshot/hash/evidência modelados e bloqueio fail-closed | Repository, controller, route, selector e E2E | Aceite inexistente operacionalmente |
| Revisão/ativação | policy/service/repository/transaction/composition | Decisões, idempotência e indisponibilidade segura | HTTP real e ativação com adapters/downstreams | Confirmação simples contorna gates |
| Turma | service/repository/transaction/composition | Atribuição/transferência/capacidade em mocks | Same-unit, constraint física e rota/E2E | Vínculos incompatíveis |
| Financeiro | service/repository/migration | Preparação no-write e idempotência local | Evento/listener/outbox/gateway/rollback E2E | ACTIVE sem cobrança/duplicidade |
| Portal/E2E | frontend legado e jornadas administrativas | Partes do portal/fluxo administrativo | Jornada digital moderna completa em duas unidades | Falha de integração descoberta em produção |

### 19.2 Lacunas de teste

Não foi identificado um E2E canônico que execute, com banco real e duas unidades:

`criar pessoas/relacionamento/DRAFT -> gerar convite -> preencher -> enviar/aprovar documentos -> publicar/aceitar contrato -> revisar -> vincular turma -> ativar -> gerar cobrança -> visualizar no portal`.

Também faltam evidências integradas para:

- montagem real das rotas administrativas de convite;
- corrida de duas confirmações e constraint física de uma ACTIVE;
- DRAFT do mesmo aluno em unidades distintas;
- vínculo de turma cruzando unidade e duas turmas ACTIVE diferentes;
- ordem/aplicação integral das migrations em banco vazio e banco legado;
- abuso de token com múltiplas instâncias/IPs e consumo one-time;
- malware, conteúdo malformado, retenção e expurgo de documentos;
- entrega segura do convite;
- outbox/retry/compensação financeira;
- portal moderno e isolamento ponta a ponta.

`e2e/sprint-23-11/journeys.spec.cjs` cobre jornadas administrativas combinadas, mas não substitui o E2E digital canônico acima.

## 20. Fluxos legados e paralelos

Quatro trilhas não devem ser tratadas como uma só:

1. `src/routes/matricula.tsx` + `/public/enrollments`: formulário legado que grava estruturas `j12_*` e aceita dados de turma/unidade próprios;
2. `backend/src/domains/pessoas/pre-matricula`: módulo isolado com tabela/workflow próprios e README que o posiciona como fundação;
3. `backend/src/domains/pessoas/application/services/enrollment-application.service.js`: orquestração antiga consumida pelo use case Pessoas, sem unidade no input atual exigido pelo Enrollment moderno e sem rota montada;
4. conversão CRM moderna: cria/reutiliza DRAFT moderno, mas não completa ownership do responsável/progresso.

O portal do responsável e o financeiro/PIX também usam majoritariamente a trilha legada. Reaproveitar qualquer uma dessas implementações exige decisão explícita de migração, mapeamento de IDs, ownership e compatibilidade; não é seguro conectá-las implicitamente.

| Trilha | Isolada? | Montada/chamada? | Classificação de evolução |
|---|---:|---|---|
| `/public/enrollments` + `src/routes/matricula.tsx` | Sim, do agregado moderno | Montada e chamada | Exige migração; não reutilizar como se fosse Enrollment moderno |
| `pessoas/pre-matricula` | Sim | Sem rota produtiva identificada | Fundação potencialmente migrável após decisão arquitetural |
| service/use case antigo de Pessoas | Parcialmente duplicado | Sem consumidor HTTP produtivo identificado | Não deve ser reutilizado sem adequar unidade e ownership |
| portal/financeiro `j12_*` | Sim do digital moderno | Montado e operacional no legado | Manter compatibilidade até haver migração explícita; não remover agora |
| CRM -> DRAFT moderno | Não; usa Enrollment | Montado e chamado | Deve ser completado ou incorporado ao comando canônico |

## 21. Segurança, privacidade e LGPD

### Controles positivos identificados

- alta entropia e hash do token;
- respostas públicas genéricas e headers contra cache/referrer/indexação;
- ActorContext multiunidade nas rotas administrativas montadas;
- unidade derivada de fonte persistida no CRM;
- allowlists, revisão otimista e transação no formulário;
- escopo matrícula/relacionamento em documentos;
- limite, assinatura de arquivo e defesa de path traversal;
- snapshot/hash previstos para contrato e aceite.

### Riscos pendentes

- token bearer reutilizável e potencialmente exposto por canal de entrega, proxy ou logs externos;
- limiter em memória por processo/IP, sem coordenação distribuída;
- dados de menores e documentos locais sem evidência de criptografia, antivírus e política de retenção;
- bearer token pode sobrescrever PII allowlisted sem histórico de alteração campo a campo;
- consentimentos e base legal não estão operacionalizados no fluxo bloqueado de contrato;
- ausência de processo documentado de acesso, correção, portabilidade e eliminação;
- ausência de observabilidade/auditoria persistente para todos os acessos ao documento e ao token;
- unidade protegida em parte por relações transitivas, com tipos/FKs inconsistentes em convite/template.

Esta é uma análise técnica, não um parecer jurídico. Base legal, termos, guarda, descarte e direitos dos titulares precisam de validação jurídica antes do go-live.

## 22. Bloqueadores de go-live

1. não há comando montado que crie ownership completo + DRAFT + progresso em uma transação;
2. criação/renovação/revogação de convite não está montada;
3. contrato/aceite está fail-closed;
4. documentos não têm regra obrigatória integrada nem revisão administrativa montada;
5. turma não está no pipeline e não possui proteção física/same-unit suficiente;
6. ativação digital transacional não está disponível;
7. confirmação simples contorna todos os gates;
8. financeiro e portal modernos não estão integrados;
9. invariantes e tipos de unidade precisam de reconciliação/migração segura.

## 23. Riscos principais

| Risco | Severidade | Efeito |
|---|---|---|
| Ativação prematura pela rota montada | Crítica | Matrícula ACTIVE sem evidências obrigatórias |
| Corrida sem unicidade física de ACTIVE | Alta | Duas matrículas ativas para o mesmo aluno |
| Ownership incompleto no DRAFT | Alta | Formulário público inacessível ou inconsistente |
| Tipos/FKs de unidade divergentes | Alta | Isolamento dependente só da aplicação e migrations difíceis |
| Token não consumido e limiter local | Alta | Reuso/abuso de credencial pública |
| Documento sensível sem ciclo de vida | Alta | Exposição regulatória e operacional |
| Turma cruzada/múltiplos vínculos ativos | Alta | Vazamento multiunidade e conflito operacional |
| Evento financeiro não conectado | Alta | ACTIVE sem cobrança ou divergência contábil |
| Paralelismo legado/moderno | Média-alta | Duplicidade, IDs incompatíveis e suporte confuso |

## 24. Dependências para evolução segura

A sequência depende primeiro de uma decisão de migração/backfill para dados legados e de um ensaio das migrations em banco representativo. People e unidades devem estar íntegros antes de ownership do Enrollment; Enrollment antes de convite; convite e relacionamento antes de progresso; progresso antes de documentos/contrato; contrato e documentos antes de revisão; revisão e turma antes de ativação; ativação antes da integração financeira; e todos esses contratos antes do portal moderno.

Também são dependências externas ao código: canal seguro de entrega do convite, storage com ciclo de vida e scan, termos/base legal validados, semântica de cobrança, estratégia de outbox/retry, observabilidade e plano de convivência/migração do legado.

## 25. Conclusão

O J12 Sports Hub possui **fundação avançada, porém fluxo digital incompleto**. Convite público, formulário e documentos são implementações reais e parcialmente montadas; contrato, revisão, turma, ativação segura e financeiro não estão conectados ao mesmo caminho. A confirmação simples atualmente montada não deve ser interpretada como ativação digital pronta.

A ordem recomendada começa por invariantes físicas e ownership, porque montar mais rotas antes de corrigir DRAFT/ACTIVE/unidade/turma amplia o risco multiunidade. Só depois deve ser criado o comando canônico, liberados convite/contrato/revisão e substituída a confirmação direta por uma ativação transacional. Go-live deve ocorrer apenas após financeiro, portal, E2E de duas unidades, observabilidade e validação jurídica/operacional.

## 26. Sequência recomendada de próximas sprints

Os nomes abaixo são propostas. “Camadas prováveis” indica áreas de implementação futuras, não afirma que novos arquivos já existam.

| Sprint | Objetivo e camadas prováveis | Pré-requisitos | Maior risco | Critério de aceite | Fora de escopo |
|---|---|---|---|---|---|
| **29.3B — Invariantes físicas multiunidade** | Reconciliar ownership/tipos/FKs; DRAFT por unidade; uma ACTIVE; class link único. Camadas: migrations, repositories, preflight. | Estratégia de backfill/legado aprovada | Bloqueio ou perda em dados existentes | Ensaio em cópia; rollback; testes de duas unidades/concorrência | Rotas e UX |
| **29.3C — Abertura canônica transacional** | Um comando autenticado cria/reutiliza responsável, aluno, relação, DRAFT e progresso. Camadas: Pessoas, Enrollment, composition. | 29.3B | Duplicar identidades | Repetição idempotente produz um agregado completo na unidade correta | Convite/contrato |
| **29.3D — Convite administrativo operacional** | Montar rotas com ActorContext/roles; criar progresso; auditoria e entrega segura. | 29.3C; canal de entrega definido | Vazamento/replay de token | Criar/renovar/revogar/consumir com isolamento e rate limit distribuído | Formulário novo |
| **29.3E — Contrato e aceite canônicos** | Seleção de template por unidade, repository, publicação, snapshot e aceite probatório. | 29.3B/29.3D; termos aprovados | Evidência inválida ou template errado | Aceite imutável verifica hash/versão/unidade e replay | Assinatura ICP-Brasil, se não exigida |
| **29.3F — Documentos e revisão** | Política obrigatória, scan/quarentena, retenção e endpoints admin de revisão. | 29.3D/29.3E; política jurídica | Arquivo malicioso/PII | DOCUMENTS só avança com requisitos; decisões auditáveis por unidade | Ativação/financeiro |
| **29.3G — Turma e ativação digital** | Validar mesma unidade/capacidade e substituir confirmação direta por readiness transacional. | 29.3B–F | Deadlock/ativação parcial | ACTIVE somente com aceite, docs, revisão e uma turma válida; rota antiga fechada/migrada | Cobrança externa |
| **29.3H — Integração financeira confiável** | Outbox/evento idempotente, obrigação/bridge/cobrança, retry e compensação. | 29.3G; semântica contábil definida | ACTIVE sem cobrança ou cobrança duplicada | Falhas recuperáveis, sem duplicidade, com reconciliação | Portal completo |
| **29.3I — Portal moderno do responsável** | Exibir/continuar matrícula, contrato, docs, status, cobranças e recibos com vínculo autenticado. | 29.3D–H | Misturar dados legado/moderno | Responsável vê apenas relações autorizadas e mesma unidade | Desativar legado |
| **29.3J — E2E, observabilidade e rollout** | E2E canônico de duas unidades, carga/abuso, dashboards, rehearsal e rollback. | Todas anteriores | Falsa segurança em mocks | Jornada real completa; alertas/SLOs; checklist jurídico e operacional aprovado | Novas features |
