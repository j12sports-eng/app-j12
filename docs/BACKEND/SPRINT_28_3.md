# Sprint 28.3 — Contexto Autenticado de Unidade e Preparação do Rollout

## 1. Objetivo

Determinar, com evidência de código e banco, se existe uma origem canônica para a unidade autenticada; montar a rota interna de pré-matrícula somente se houver vínculo persistido e autorização fail-closed; e preparar o rollout operacional das migrations da Sprint 28.2 sem executá-las.

## 2. Contexto

A pré-matrícula permanece representada exclusivamente por `Enrollment DRAFT`. As Sprints 28.1 e 28.2 já entregaram a orquestração de Pessoas, Perfis, Alunos, Relacionamentos e Enrollment, além das constraints preparadas, recuperação concorrente, named lock por conexão dedicada e adapters HTTP internos ainda não montados.

## 3. Branch, commit e worktree iniciais

- branch: `sprint-23`;
- HEAD: `35ddce990c9d95375e7b47725404c6dcc8d6d153`;
- commit da Sprint 28.2: `35ddce9 feat(enrollments): reforca integridade da pre-matricula`;
- worktree inicial: limpo.

## 4. Auditoria obrigatória executada antes da implementação

Foram lidos e pesquisados:

- `docs/BACKEND/SPRINT_28_2.md`;
- controller, router e testes HTTP internos da pré-matrícula;
- entrypoints `backend/server.js` e `backend/src/server.js`;
- `backend/auth.js`, middleware wrapper, rotas de autenticação e schema runtime;
- serviços e tabelas `users`, `j12_usuarios`, `user_sessions`;
- rotas e schema de unidades;
- guards `requireAuth`, `requireRole` e `canManageSystem`;
- rotas administrativas, internas e o resolvedor de unidade do CRM;
- catálogo `AppError`, observabilidade HTTP, logger estruturado e auditoria de segurança;
- migrations, migration runner, documentação de backup e rollback;
- política executiva e gate de CPF.

Também foram pesquisados no backend todos os usos relevantes de `unitId`, `unit_id`, tenants, organizações, empresas, filiais, `req.user`, `req.auth`, memberships, roles, permissions, forbidden e unauthorized.

## 5. Arquitetura de autenticação encontrada

`requireAuth` extrai exclusivamente o Bearer token oficial, valida JWT ou sessão persistida, relê o usuário em `users` ou `j12_usuarios`, sanitiza a entidade e popula simultaneamente `req.user` e `req.auth`. Esta é a localização oficial do usuário autenticado.

O JWT emitido por `createSession` contém `sub`, origem, papel/perfil e vínculos de aluno/professor/responsável. Não contém `unitId`. Mesmo para JWT, a resolução atual relê o usuário persistido; portanto a identidade canônica é o registro ativo encontrado pelo token, não valores do payload HTTP.

Não existe serviço de sessão ou domínio Auth migrado que acrescente contexto de unidade. `backend/src/domains/auth` é apenas um boundary reservado.

## 6. Modelo real de unidade

A entidade operacional usada pelas rotas atuais é `j12_unidades`, com identificador numérico, nome, endereço, cidade, estado, telefone e status. O banco também contém a tabela legada `unidades`, sem relação comprovada com autenticação.

A auditoria de `INFORMATION_SCHEMA` confirmou Percona Server 5.7 e as tabelas:

- `j12_unidades`;
- `unidades`;
- `users`;
- `j12_usuarios`;
- `user_sessions`.

## 7. Modelo real de vínculo usuário–unidade

**Não existe no schema auditado.**

- `users` não possui `unit_id` ou `unidade_id`;
- `j12_usuarios` não possui `unit_id` ou `unidade_id`;
- `user_sessions` contém somente token, usuário e timestamps;
- não existe `user_units`, `unit_users`, membership equivalente ou FK entre usuário e unidade;
- a auditoria de chaves estrangeiras retornou zero vínculos entre essas tabelas.

Logo, não é possível provar unidade única, múltiplas unidades, vínculo ativo, permissão por unidade ou isolamento entre unidades.

## 8. Origem canônica de `userId`

A origem canônica é `req.user.id`/`req.auth.id` produzida por `requireAuth` após validação do token e releitura persistida. Body, query e headers arbitrários não participam dessa resolução.

## 9. Origem canônica de `unitId`

**Ausente.** Não há claim oficial, estado de sessão, seleção validada ou vínculo persistido. O `unitId` presente em alguns recursos de negócio, como Lead do CRM, identifica o recurso e não autoriza o usuário naquela unidade.

O CRM documenta sua política atual como `GLOBAL_SYSTEM_MANAGEMENT`: usuários de gestão obtêm a unidade do Lead persistido. Isso não é reutilizável para criar uma pré-matrícula, pois ainda não existe recurso anterior do qual derivar a unidade.

## 10. Usuários com múltiplas unidades

O sistema não modela esse caso. Resolver implicitamente a primeira unidade, uma unidade global, body, query ou header seria inseguro. Até existir membership persistida e seleção validada, qualquer ambiguidade deve resultar em bloqueio.

## 11. Autorizações e papéis

O modelo disponível é global e baseado em papel:

- `requireRole` compara o papel autenticado;
- `canManageSystem` aceita `admin` ou `coordenador`;
- não existe permission service granular nem papel contextual por unidade.

Para pré-matrícula, `canManageSystem` pode comprovar autorização funcional global, mas não autorização sobre uma unidade específica.

## 12. Decisão de montagem da rota

Aplica-se o **cenário D — suporte insuficiente**.

A rota `/internal/pre-enrollments` permanecerá desmontada. Os adapters da Sprint 28.2 continuam fail-closed: sem unidade no contexto autenticado, o controller devolve `PRE_ENROLLMENT_UNIT_SCOPE_REQUIRED`. Não será adicionado fallback por body, query, header, primeira unidade, papel administrativo ou recurso não relacionado.

Componente ausente: modelo persistido e aprovado de membership usuário–unidade, incluindo status do vínculo, status da unidade, papel/permissões contextuais e estratégia explícita de seleção para múltiplas unidades.

## 13. Auditoria operacional

O middleware global já registra request ID, correlation ID, método, path, duração, status e usuário sanitizado. O logger estruturado mascara token, authorization, cookie, password e secrets. Como a rota não será montada, não haverá evento de uso da rota em runtime. Criar auditoria específica desacoplada de uma rota ativa seria infraestrutura paralela e não produziria evidência operacional útil.

## 14. Estado read-only das migrations em 2026-07-19

Nenhum `up` foi executado.

- auditoria de identidade/perfis/relacionamentos/DRAFT: zero duplicidades e somente `SELECT`;
- identidade normalizada: migration ainda não aplicada, quatro colunas e quatro índices ausentes;
- integridade de perfis/relacionamentos: migration ainda não aplicada, generated columns e índices únicos ausentes;
- DRAFT de Enrollment: índice único existente e saudável.

## 15. Decisão preliminar sobre CPF

A política executiva oficial aprova CPF como identificador forte opcional e global quando válido, mas condiciona a unicidade física aos gates técnicos. A restrição única não será ativada nesta Sprint porque a migration normalizada não foi aplicada, writers legados ainda precisam de comprovação de sincronização, rollback operacional não foi validado e revisões LGPD/especializadas permanecem registradas.

Alternativas a detalhar:

1. unicidade global de CPF normalizado — compatível com DEC-19, condicionada a todos os gates;
2. unicidade por unidade — incompatível com a identidade global aprovada e inviável enquanto Pessoas não possui escopo de unidade;
3. ausência permanente de constraint — preserva flexibilidade, mas deixa concorrência dependente somente da aplicação;
4. rollout global posterior — alternativa recomendada após normalização, saneamento, sincronização de writers e aprovação operacional.

## 16. Escopo seguro autorizado para implementação

Esta Sprint poderá:

- reforçar testes de bloqueio contra body, query, header e mass assignment;
- criar teste de regressão que impeça montagem acidental da rota enquanto o vínculo não existir;
- produzir runbook completo das migrations;
- consolidar a decisão arquitetural de CPF e os requisitos do futuro membership.

Não será criado contrato de membership, claim JWT, middleware de unidade, tabela, migration ou bypass administrativo sem aprovação arquitetural.

## 17. Arquivos criados

- `backend/src/domains/pessoas/presentation/tests/pre-enrollment-unit-context-readiness.test.js`;
- `docs/BACKEND/SPRINT_28_3.md`;
- `docs/DEPLOY/PRE_ENROLLMENT_INTEGRITY_MIGRATIONS_RUNBOOK.md`.

## 18. Arquivos alterados

Nenhum arquivo runtime foi alterado. Em especial, `backend/src/server.js`, `backend/auth.js`, o controller e o router da Sprint 28.2 permanecem intactos. Isso evita simular isolamento por unidade sem membership persistida.

## 19. Testes

Foi criada uma suíte específica com sete casos:

1. contrato oficial de usuário autenticado sem claim de unidade;
2. body, query e headers arbitrários incapazes de construir unidade autenticada;
3. campos reservados fora da allowlist;
4. autorização global incapaz de substituir autorização por unidade;
5. contexto mínimo e imutável em fixture explícita;
6. rota interna ausente do composition root;
7. schema runtime sem membership usuário–unidade.

Também foi executada a suíte oficial completa `npm run ci:test:backend`, que descobre todos os testes `backend/src/**/*.test.js`. Ela cobre as Sprints 28.1, 28.2 e 28.3, Pessoas, Enrollment, CRM, autenticação, autorização, segurança, rotas, bootstrap, observabilidade, migrations e migration runner.

## 20. Resultados

- testes específicos da Sprint 28.3: 7/7;
- suíte backend completa: **1.043/1.043**, zero falhas;
- ESLint no arquivo JavaScript criado: aprovado, zero erros;
- Prettier nos três arquivos criados: aprovado;
- `npm run typecheck`: aprovado;
- `npm run build`: aprovado;
- `npm run ci:secrets`: 2.311 arquivos, zero achados;
- `git diff --check`: aprovado.

## 21. Runbook de migrations

Criado em `docs/DEPLOY/PRE_ENROLLMENT_INTEGRITY_MIGRATIONS_RUNBOOK.md`, contendo owners, evidências, gates, plano/dry-run, preflight por ambiente, backup/restore, homologação, produção, critérios de interrupção, recuperação e monitoramento.

O runbook registra uma limitação crítica: o runner canônico aplica todo o plano pendente e não seleciona uma migration. Se o plano incluir mudanças além das duas aprovadas, o rollout deve ser interrompido em vez de contornar o ledger com execução direta.

## 22. Política de CPF

### Comportamento atual

- `people.id` é a identidade técnica global;
- CPF é identificador forte opcional;
- quando informado em writers modernos, é normalizado e validado;
- CPF duplicado resulta em conflito assistido, sem merge automático;
- e-mail e telefone são contatos compartilháveis;
- migration atual cria somente colunas e índices não únicos.

### Global versus por unidade

A política DEC-19 aprova unicidade global, condicionada aos gates técnicos. Unicidade por unidade não é compatível com o modelo aprovado: Pessoas é global, CPF pertence à Pessoa e `person_profiles`/`person_relationships` não possuem `unit_id`. Além disso, o próprio membership usuário–unidade ainda não existe.

### Responsáveis, alunos e exceções

- DRAFT pode existir sem CPF;
- adulto brasileiro não pode ativar matrícula sem CPF válido;
- menor pode permanecer sem CPF quando houver responsável válido;
- responsável contratual/financeiro exige CPF antes da ativação, sujeito à revisão especializada;
- estrangeiro pode existir sem CPF e nunca recebe CPF fictício;
- legado inválido é preservado com normalizado nulo para revisão;
- pessoa inativa continua reservando CPF.

### Histórico, conflito e LGPD

Alteração e histórico de CPF exigem processo autorizado, auditoria, retenção mínima e revisão LGPD. Duplicidades devem bloquear e ir para revisão humana. Nenhuma exclusão, escolha de vencedor ou merge pode ser automático.

### Decisão desta Sprint

Não criar índice único agora. A alternativa recomendada continua sendo unicidade global posterior, mas somente após migration aplicada, zero duplicidades, writers sincronizados, múltiplos `NULL` validados, rollback ensaiado, impacto aceito e revisões especializadas concluídas.

## 23. Bloqueios

- membership usuário–unidade inexistente;
- unidade ausente do JWT e da sessão;
- autorização disponível apenas em escopo global;
- nenhuma seleção de unidade persistida ou validada.

A evidência foi confirmada tanto no repositório quanto no `INFORMATION_SCHEMA` do banco auditado. Não é apenas ausência de implementação no controller.

## 24. Riscos residuais

1. Rotas administrativas atuais continuam com autorização global por papel; isso não deve ser interpretado como isolamento por unidade.
2. Existem duas entidades de unidade (`j12_unidades` e a legada `unidades`) sem decisão explícita de convergência.
3. As migrations da Sprint 28.2 continuam não aplicadas e o banco auditado está vazio no domínio moderno; cada ambiente exige nova auditoria.
4. O runner pode possuir outras migrations pendentes; o plano deve corresponder exatamente à mudança aprovada.
5. A constraint global de CPF permanece tecnicamente bloqueada apesar da política executiva aprovada.

## 25. Rollback

As alterações desta Sprint são documentação e testes fail-closed. Rollback consiste em removê-los; não há efeito em runtime ou dados. Nenhuma migration, schema, sessão, token, usuário ou unidade foi alterado.

## 26. Recomendação para a Sprint 28.4

Projetar e aprovar explicitamente:

1. entidade canônica de unidade, resolvendo `j12_unidades` versus legado;
2. membership usuário–unidade com status e integridade física;
3. cardinalidade e seleção explícita para múltiplas unidades;
4. papéis/permissões contextuais e política administrativa;
5. repository e resolvedor fail-closed;
6. middleware anexado ao padrão oficial `req.auth` ou contrato aprovado;
7. auditoria e testes reais de isolamento;
8. somente então, montagem de `/internal/pre-enrollments` antes do 404 global.
