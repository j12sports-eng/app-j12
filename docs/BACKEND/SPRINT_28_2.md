# Sprint 28.2 — Integridade e Concorrência da Pré-Matrícula

## 1. Objetivo

Fortalecer a integridade do fluxo canônico de pré-matrícula (`Enrollment DRAFT`) antes de qualquer convite ou endpoint público, preservando integralmente a Sprint 28.1.

## 2. Contexto e baseline

- Branch inicial: `sprint-23`.
- HEAD inicial: `4981929 feat(enrollments): consolida pre-matricula como enrollment draft`.
- Worktree inicial: limpa.
- Banco auditado: Percona Server 5.7.44-48, compatível com generated columns e índices compostos.
- A Sprint 28.1 está registrada no HEAD e o documento `SPRINT_28_1.md` foi relido integralmente.

## 3. Auditoria inicial (registrada antes da implementação)

Foram auditados os serviços, repositories e testes de Pessoa, perfil, aluno, relacionamento e pré-matrícula; aggregate, facade, application services, repository e migrations de Enrollment; migration/diagnóstico/gate de identidade; pool MySQL; autenticação; controllers; rotas internas; tratamento de erros; observabilidade e montagem em `server.js`.

### Resultado somente leitura do banco em 2026-07-19

- `people`: 0 registros.
- CPF normalizado em memória: 0 grupos duplicados.
- E-mails/telefones/celulares compartilhados: 0 grupos no conjunto vazio (contatos não são identidade forte nem candidatos a índice único).
- `person_profiles`: 0 grupos duplicados por `person_id + profile_type`.
- `person_relationships`: 0 grupos ativos duplicados por `person_id + related_person_id + relationship_type`.
- `enrollments`: 0 grupos DRAFT correntes duplicados.
- A auditoria executou apenas `SELECT`; nenhuma escrita ou DDL foi executada.

### Schema e índices observados

- `person_profiles` não possui `unit_id`; contém `person_id`, `profile_type` e `status`.
- `person_relationships` não possui `unit_id`; contém as duas partes, tipo, atributos descritivos/mutáveis e `status`.
- Perfis e relacionamentos possuem apenas índices simples não únicos.
- Enrollment possui generated columns e o índice único `ux_enrollments_active_draft_student_profile`, íntegro.
- As quatro colunas e os quatro índices não únicos da identidade normalizada em `people` ainda não existem.

## 4. Arquitetura encontrada

`PreEnrollmentApplicationService` coordena os serviços canônicos de Pessoas e a `EnrollmentFacade`. A aplicação já consulta antes de criar e converte múltiplos candidatos em conflito assistido. O reforço necessário é físico e deve recuperar o registro vencedor após `ER_DUP_ENTRY`.

O query runner geral de `db.js` obtém e libera uma conexão por chamada. Portanto, o `GET_LOCK`, as consultas/escritas protegidas e o `RELEASE_LOCK` atuais podem ocorrer em conexões diferentes. O pool expõe `getConnection()` e connections com `execute()`/`release()`, que é o mecanismo canônico a reutilizar.

## 5. Migrations avaliadas

### Identidade normalizada

Migration existente: `20260717220000_add_people_normalized_identity_columns.js`.

Situação: **não aplicada**. `status` confirmou todas as colunas e índices ausentes, backfill ainda não executado e nenhum índice único de CPF ativo.

Classificação: cenário A com uma lacuna operacional mínima. A migration está correta para seu contrato aprovado: colunas nullable e índices de busca não únicos. Ela não deve criar unicidade de CPF porque `person-cpf-uniqueness-gate.js` registra decisões executivas ainda não aprovadas (CPF opcional, estrangeiros, inativos, mudança/histórico e impacto operacional). A Sprint adicionará preflight bloqueante para CPF duplicado, mas não ampliará o contrato para unicidade física sem essas decisões.

### DRAFT de Enrollment

Migration `20260629190607_add_active_draft_unique_constraint_to_enrollments.js`: aplicada e íntegra; generated columns e índice único compatíveis; nenhuma duplicidade encontrada.

### Perfis e vínculos

Não existe migration de unicidade suficiente. É seguro preparar uma nova migration aditiva porque as chaves são comprováveis no domínio e a auditoria atual não encontrou duplicidades. A migration não será aplicada automaticamente nesta Sprint.

## 6. Critérios reais de unicidade

### Perfil

Chave: `person_id + profile_type`, sem unidade e sem status. O serviço atual procura todos os perfis desse tipo e considera mais de um um conflito; logo permitir um perfil inativo e outro ativo com a mesma chave contrariaria o contrato existente.

### Relacionamento

Chave do vínculo corrente: `person_id + related_person_id + relationship_type`, somente quando `status = 'active'`.

- direção é preservada;
- tipos diferentes entre as mesmas pessoas são permitidos;
- vínculos históricos/inativos são permitidos;
- label, prioridade, flags, datas e outros campos mutáveis não pertencem à identidade estrutural.

Como MySQL 5.7 não possui índice único parcial, serão usadas generated columns nullable para o vínculo ativo, seguindo o padrão já aprovado no DRAFT de Enrollment.

## 7. Decisões de implementação

1. Criar auditoria determinística e estritamente read-only, reutilizando o diagnóstico de identidade existente e acrescentando vínculos/DRAFT/schema readiness.
2. Adicionar preflight de CPF duplicado à migration existente antes de qualquer DDL/backfill; não criar índice único de CPF.
3. Criar uma migration idempotente para unicidade de perfil e vínculo ativo, com `up`, `down`, `status`, guards e sem correção automática de dados.
4. Tratar duplicate key nos services, reler o vencedor e retornar reutilização idempotente.
5. Corrigir o named lock com conexão dedicada e a menor extensão opcional no repository.
6. Criar adapters HTTP internos testáveis e fail-closed, sem rota pública.

## 8. Bloqueio HTTP comprovado

`requireAuth` produz usuário sem `unitId` e o schema não possui vínculo canônico usuário–unidade. O CRM só consegue obter unidade porque ela vem do Lead persistido e registra que a política atual é global. A pré-matrícula não possui recurso prévio equivalente.

Consequentemente, `unitId` não pode ser extraído com segurança do contexto autenticado hoje. O adapter será preparado para aceitar somente um contexto de unidade autenticado/injetado, mas **não será montado em `server.js`** enquanto a origem canônica desse claim não existir. Montá-lo usando body, header, query ou parâmetro violaria isolamento por unidade; montá-lo permanentemente indisponível criaria uma falsa integração.

## 9. Escopo preservado

Não serão criados token, convite, rota pública, frontend, pagamento, cobrança, contrato, ativação, turma, comunicação externa ou transação compartilhada ampla. O módulo legado de pré-matrícula não será removido.

## 10. Rollback planejado

- Auditoria e adapters: remoção dos arquivos/exports, sem efeito em dados.
- Named lock: reversão do código restaura o comportamento anterior; nenhuma alteração de schema.
- Migration de integridade: `down` remove primeiro os índices, depois apenas as generated columns adicionadas; dados de negócio não são apagados.
- Migration de identidade: o `down` existente continua bloqueado quando houver valores normalizados, exigindo rollback operacional explícito.

## 11. Arquivos, testes e resultados

### Arquivos criados

- `backend/src/database/audits/pre-enrollment-integrity.audit.js`
- `backend/src/database/migrations/20260719200000_add_pre_enrollment_integrity_constraints.js`
- `backend/src/database/migrations/tests/pre-enrollment-integrity.migration.test.js`
- `backend/src/domains/pessoas/pre-enrollment-integrity-audit.js`
- `backend/src/domains/pessoas/pre-enrollment-integrity-audit.test.js`
- `backend/src/domains/pessoas/presentation/controllers/pre-enrollment.controller.js`
- `backend/src/domains/pessoas/presentation/routes/pre-enrollment-internal.routes.js`
- `backend/src/domains/pessoas/presentation/tests/pre-enrollment-internal.routes.test.js`
- `docs/BACKEND/SPRINT_28_2.md`

### Arquivos alterados

- migration runner: catálogo, ordem e dependência da nova migration;
- migration existente de identidade normalizada e seus testes;
- repository MySQL de Enrollment e seus testes de named lock;
- application services e testes de perfis e relacionamentos;
- DDL de criação para `person_profiles` e `person_relationships`, tanto nos repositories quanto nos arquivos SQL canônicos.

A migration histórica de criação do domínio Pessoas não foi reescrita, preservando seu checksum. A nova migration aditiva entrega o delta de integridade para bancos existentes.

### Implementação concluída

- A auditoria de integridade reutiliza o diagnóstico read-only de identidade, aceita somente `SELECT`, ordena IDs/contagens de forma determinística e não retorna CPF, e-mail ou telefone em claro.
- A migration de identidade agora executa preflight paginado de CPF normalizado antes de qualquer DDL, backfill ou índice e interrompe com `PEOPLE_IDENTITY_DUPLICATES_FOUND` quando necessário.
- A nova migration cria `ux_person_profiles_person_type` e, para vínculos ativos, generated columns nullable mais `ux_person_relationships_active_structure`. O `up` recusa duplicidades antes de alterar o schema; `status` valida formato compatível; `down` não remove dados de negócio.
- Os services de perfil e relacionamento tratam `ER_DUP_ENTRY`, fazem releitura do vencedor e devolvem reutilização idempotente. Tipos de relacionamento diferentes e vínculos históricos continuam permitidos.
- O repository de Enrollment obtém uma conexão dedicada. `GET_LOCK`, leitura/criação protegida e `RELEASE_LOCK` usam essa mesma conexão; lock e conexão são liberados em `finally`, inclusive em falhas e timeout.
- O controller e o router internos rejeitam contexto de autorização no body, aplicam allowlist, autenticam e autorizam fail-closed, retornam somente IDs/estado e sanitizam erros. Eles permanecem deliberadamente sem montagem no servidor até existir um claim canônico de unidade no contexto autenticado.

## 12. Testes e validações executados

Foram executadas as suítes da Sprint 28.2, Sprint 28.1, Pessoas, Enrollment, CRM afetado e migration runner:

- Pessoas/Sprints 28.1 e 28.2: 119/119;
- Enrollment: 106/106;
- CRM afetado: 25/25;
- migrations e migration runner: 60/60;
- total de regressão, sem sobreposição: **310/310 testes aprovados**;
- releitura final do teste de auditoria após o último ajuste de readiness: 2/2.

Validações finais:

- ESLint nos arquivos JavaScript criados/alterados: aprovado, 0 erros;
- `npm run typecheck`: aprovado;
- `npm run build`: aprovado;
- `npm run ci:secrets`: aprovado, 2.308 arquivos verificados e 0 achados;
- `git diff --check`: aprovado.

O lint exploratório dos domínios completos também encontrou 231 divergências de formatação preexistentes em arquivos fora do diff. Elas não foram alteradas para evitar uma refatoração ampla e não representam regressão desta Sprint.

## 13. Estado operacional das migrations

Nenhum `up` foi executado nesta Sprint.

- identidade normalizada: não aplicada; colunas e índices continuam ausentes;
- integridade de perfis/relacionamentos: não aplicada; auditoria atual permite aplicação porque encontrou zero grupos duplicados;
- unicidade de DRAFT: já estava aplicada e permanece íntegra.

Antes de aplicar em qualquer ambiente, executar a auditoria read-only e o `status` de cada migration. Qualquer grupo duplicado bloqueia o `up`; não há correção ou merge automático.

## 14. Segurança

- autorização por usuário/unidade permanece fail-closed;
- `userId` e `unitId` são aceitos apenas do contexto autenticado;
- body, query e headers não podem elevar contexto;
- auditoria e erros não expõem PII;
- nenhuma rota pública, ativação, cobrança, contrato, convite ou mensagem foi criada;
- nenhum segredo foi incluído;
- queries dinâmicas permanecem limitadas a identificadores internos allowlisted pela migration.

## 15. Bloqueios e riscos residuais

1. O modelo de autenticação atual não fornece `unitId` canônico nem relação usuário–unidade. Por isso o adapter HTTP está testado, porém não montado em produção.
2. As duas migrations preparadas ainda exigem janela operacional, backup, auditoria imediatamente anterior e execução explícita.
3. CPF único continua bloqueado pelas decisões documentadas no gate existente; esta Sprint não inventou a política.
4. O fluxo completo ainda não compartilha uma transação entre os domínios. A defesa desta Sprint é por constraints, recuperação idempotente e lock dedicado, conforme o escopo aprovado.
5. O banco auditado estava vazio; a auditoria deve ser repetida contra cada ambiente real antes do rollout.

## 16. Próximos passos recomendados para a Sprint 28.3

1. Definir e implementar a origem canônica do claim de unidade autenticada, com testes de isolamento, antes de montar `pre-enrollment-internal.routes.js`.
2. Aprovar runbook, backup e janela para aplicar primeiro identidade normalizada e depois integridade de perfis/relacionamentos, sempre condicionados à auditoria limpa.
3. Decidir formalmente as regras pendentes do gate de unicidade de CPF.
4. Após o rollout interno e observabilidade, planejar convite/token público como uma camada separada, sem alterar o aggregate canônico `Enrollment DRAFT`.
