# Sprint 0.4 — plano de aplicação controlada e correção multiunidade

Este relatório é resultado de inspeção estática, catálogo local e testes com fakes. Nenhum comando deste trabalho foi direcionado ao banco real e nenhuma função up exportada por uma migration foi chamada fora de fixtures injetadas.

## Cadeia mínima de DRAFT

Ordem topológica calculada pelo catálogo canônico:

1. 20260712183000_create_people_domain_tables — dependência técnica já registrada por baseline.
2. 20260629134546_create_enrollments_table — dependência técnica já registrada por baseline.
3. 20260629190607_add_active_draft_unique_constraint_to_enrollments — proteção histórica já registrada por baseline.
4. 20260712184500_create_auth_runtime_tables — dependência técnica transitiva de auth_identities.
5. 20260717220000_add_people_normalized_identity_columns — obrigatória para identidade normalizada.
6. 20260719200000_add_pre_enrollment_integrity_constraints — obrigatória para perfis/relacionamentos.
7. 20260724120000_create_auth_identities_table — obrigatória para identidade do ator.
8. 20260724123000_create_user_unit_memberships_table — obrigatória para contexto de unidade.
9. 20260803120000_prepare_enrollment_draft_ownership — obrigatória para responsável do DRAFT.
10. 20260729120000_add_enrollment_unit_ownership_to_enrollments — obrigatória para ownership por unidade.
11. 20260729150000_add_enrollment_unit_foreign_key — obrigatória para integridade da unidade.
12. 20260803123000_reconcile_enrollment_multiunit_invariants — obrigatória para abertura idempotente por unidade.
13. 20260729180000_enforce_enrollment_multiunit_invariants — fechamento formal histórico por baseline após a reconciliação, não por reaplicação.

Os itens 9 e 10 são independentes entre si, mas ambos precedem a reconciliação. A ordem acima é a ordem efetiva e determinística do catálogo.

## Migrations obrigatórias

Para o incremento DRAFT: people normalizado, integridade de profiles/relationships, auth runtime e identities, memberships, ownership de responsável, ownership/FK de unidade e reconciliação multiunidade. As três foundations já registradas continuam sendo pré-condições formais e físicas.

## Migrations adiáveis

- 20260720120000_create_enrollment_digital_invitations_table — somente convite digital.
- 20260803130000_reconcile_enrollment_digital_invitation_unit_type — correção explícita do convite, imediatamente depois da foundation de convite.
- 20260724150000_create_digital_enrollment_progress — fluxo posterior ao convite.
- 20260725120000_create_digital_enrollment_documents — documentos.
- 20260725160000_create_digital_enrollment_contract_foundation — contrato.
- 20260727150000_create_digital_enrollment_administrative_review — revisão.
- 20260729210000_add_people_digital_enrollment_fields — campos posteriores do fluxo digital.

## Auditoria das migrations da cadeia

### 20260712183000_create_people_domain_tables

- Arquivo: backend/src/database/migrations/20260712183000_create_people_domain_tables.sql.
- Dependências: nenhuma. Tabelas: people, person_profiles, person_relationships e pre_matriculas.
- Colunas/índices/FKs/generated: identidade e contato de people; tipo/status de profile; pares person/related person e flags do relacionamento; índices simples declarados; sem FKs e sem generated columns nesta foundation.
- Destrutividade/lock/dados: cria tabelas; lock de metadados; não transforma dados. Compatível quando as tabelas preexistentes têm o contrato manifesto.
- Idempotência/rollback: CREATE TABLE IF NOT EXISTS; sem DOWN automático.
- Pré/pós: schema MySQL/InnoDB disponível; após, as quatro tabelas e seus índices devem coincidir com o manifest.

### 20260629134546_create_enrollments_table

- Arquivo: backend/src/database/migrations/20260629134546_create_enrollments_table.sql.
- Dependências: people foundation. Tabela: enrollments.
- Colunas/índices/FKs/generated: id, student_person_id, student_profile_id, status, datas e soft delete; FKs para people/person_profiles; cinco índices; sem generated columns.
- Destrutividade/lock/dados: CREATE TABLE; DOWN contém DROP TABLE e é destrutivo. Sem backfill.
- Idempotência/rollback: criação idempotente; rollback existe no arquivo, mas não é aceitável com dados.
- Pré/pós: tabelas de pessoas presentes; contrato base de Enrollment presente.

### 20260629190607_add_active_draft_unique_constraint_to_enrollments

- Arquivo: backend/src/database/migrations/20260629190607_add_active_draft_unique_constraint_to_enrollments.js.
- Dependências: enrollments foundation. Tabela: enrollments.
- Colunas/índices/FKs/generated: active_draft_student_person_id e active_draft_student_profile_id VIRTUAL; unique ux_enrollments_active_draft_student_profile.
- Destrutividade/lock/dados: ALTER TABLE com lock; aborta para DRAFTs duplicados; não faz DML. DOWN remove índice/colunas.
- Idempotência/rollback: up/status idempotentes; rollback físico existe, mas perde a proteção e não é automático no Manager.
- Pré/pós: colunas base compatíveis e zero grupos DRAFT duplicados; unique global presente.

### 20260712184500_create_auth_runtime_tables

- Arquivo: backend/src/database/migrations/20260712184500_create_auth_runtime_tables.sql.
- Dependências: nenhuma. Tabelas: j12_usuarios, users, user_sessions e password_reset_tokens.
- Colunas/índices/FKs/generated: credenciais, roles, vínculos legados, sessões/tokens; uniques de email/login e índices de consulta; sem FK/generated.
- Destrutividade/lock/dados: apenas criação no UP; locks de metadados; sem DML.
- Idempotência/rollback: CREATE TABLE IF NOT EXISTS; sem DOWN automático por conter identidades/sessões.
- Pré/pós: nenhuma dependência de domínio; quatro tabelas exatamente manifestadas.

### 20260717220000_add_people_normalized_identity_columns

- Arquivo: backend/src/database/migrations/20260717220000_add_people_normalized_identity_columns.js.
- Dependências: people foundation. Tabela: people.
- Colunas/índices/FKs/generated: cpf_normalized, email_normalized, telefone_normalized, celular_normalized nullable e quatro índices não únicos; sem FK/generated.
- Destrutividade/lock/dados: ALTER TABLE e backfill paginado previsto pelo código; bloqueia CPF normalizado duplicado; não inventa/trunca identidade.
- Idempotência/rollback: reexecução segura; down só remove estrutura vazia e bloqueia se houver dados.
- Pré/pós: people compatível e sem unique não aprovado; colunas/tipos/índices manifestados e valores normalizados válidos.

### 20260719200000_add_pre_enrollment_integrity_constraints

- Arquivo: backend/src/database/migrations/20260719200000_add_pre_enrollment_integrity_constraints.js.
- Dependências: people foundation. Tabelas: person_profiles e person_relationships.
- Colunas/índices/FKs/generated: unique person_id/profile_type; três generated columns de relacionamento ativo e unique composto exato.
- Destrutividade/lock/dados: ALTER TABLE com lock; aborta para duplicidades; não apaga/backfilla dados.
- Idempotência/rollback: idempotente; down remove apenas artefatos de integridade de sua propriedade.
- Pré/pós: tabelas e colunas base compatíveis, sem duplicidades; uniques/generated exatos.

### 20260724120000_create_auth_identities_table

- Arquivo: backend/src/database/migrations/20260724120000_create_auth_identities_table.js.
- Dependências: auth runtime. Tabela: auth_identities.
- Colunas/índices/FKs/generated: id, source/source_user_id, status, disabled/created/updated; unique source+source_user_id e índices source/status; sem FK/generated.
- Destrutividade/lock/dados: CREATE TABLE; down somente se tabela vazia, depois DROP TABLE.
- Idempotência/rollback: valida/adota schema compatível; rollback fail-closed para dados.
- Pré/pós: auth runtime presente; contrato integral do manifest presente.

### 20260724123000_create_user_unit_memberships_table

- Arquivo: backend/src/database/migrations/20260724123000_create_user_unit_memberships_table.js.
- Dependências: auth_identities. Tabela: user_unit_memberships.
- Colunas/índices/FKs/generated: unit_id BIGINT signed, identity/role/status/default/auditoria; active_default_key generated; uniques identity+unit e default ativo; FKs para auth_identities e j12_unidades.
- Destrutividade/lock/dados: CREATE TABLE; down só aceita tabela vazia; risco de FK se tipo/parent divergirem.
- Idempotência/rollback: valida estrutura preexistente; rollback fail-closed para dados.
- Pré/pós: auth_identities e j12_unidades.id BIGINT signed; tabela, generated, índices e FKs exatos.

### 20260803120000_prepare_enrollment_draft_ownership

- Arquivo: backend/src/database/migrations/20260803120000_prepare_enrollment_draft_ownership.js.
- Dependências: enrollments foundation e pre-enrollment integrity. Tabela: enrollments.
- Colunas/índices/FKs/generated: três VARCHAR(64) nullable — responsible_person_id, responsible_profile_id, responsible_relationship_id —, um índice por coluna e FKs para people/profiles/relationships; sem generated.
- Destrutividade/lock/dados: somente ADD; valida órfãos antes de cada FK; sem DML. ALTER/FK pode bloquear tabela.
- Idempotência/rollback: valida antes de adotar e reexecuta sem DDL; down sempre fail-closed porque as colunas podem conter dados.
- Pré/pós: quatro tabelas requeridas; zero órfãos; os nove artefatos devem existir com composição exata.

### 20260729120000_add_enrollment_unit_ownership_to_enrollments

- Arquivo: backend/src/database/migrations/20260729120000_add_enrollment_unit_ownership_to_enrollments.js.
- Dependências: enrollments foundation. Tabela: enrollments.
- Colunas/índices/FKs/generated: unit_id BIGINT signed nullable; índice não único unit/student/profile/status/deleted_at; sem FK/generated nesta etapa.
- Destrutividade/lock/dados: ADD COLUMN/INDEX com lock; sem NOT NULL, backfill ou DML.
- Idempotência/rollback: valida tipo/ordem; down remove somente se nenhum índice, FK ou generated desconhecido depender da coluna.
- Pré/pós: enrollments base compatível; coluna signed BIGINT e índice exato.

### 20260729150000_add_enrollment_unit_foreign_key

- Arquivo: backend/src/database/migrations/20260729150000_add_enrollment_unit_foreign_key.js.
- Dependências: unit ownership. Tabelas: enrollments e j12_unidades.
- Colunas/índices/FKs/generated: não cria coluna; FK enrollments.unit_id para j12_unidades.id; reutiliza índice de suporte.
- Destrutividade/lock/dados: ADD CONSTRAINT pode escanear/bloquear e aborta para órfãos/tipos incompatíveis; sem DML.
- Idempotência/rollback: aceita FK equivalente; down remove apenas a FK canônica.
- Pré/pós: ambos os lados BIGINT signed e compatíveis, zero órfãos; FK canônica presente.

### 20260803123000_reconcile_enrollment_multiunit_invariants

- Arquivo: backend/src/database/migrations/20260803123000_reconcile_enrollment_multiunit_invariants.js.
- Dependências: active DRAFT, unit FK e draft ownership. Tabela: enrollments.
- Colunas/índices/FKs/generated: active_draft_unit_id, current_enrollment_unit_id, current_enrollment_student_person_id e current_enrollment_student_profile_id generated; unique DRAFT com unit_id e unique current DRAFT/ACTIVE com unit_id.
- Destrutividade/lock/dados: pode remover somente o índice legado de composição exata e recriá-lo; adiciona artefatos, nunca apaga dados. Diagnostica duplicidades, ownership incompleto e órfãos antes do DDL. ALTER pode causar lock/commit implícito.
- Idempotência/rollback: pre/postflight estritos e segunda execução sem DDL; down sempre fail-closed.
- Pré/pós: tipos/FKs de responsável, aluno e unidade canônicos; apenas índice legado exato ou índice final; quatro generated e dois uniques finais com expressões/composição exatas.

### 20260729180000_enforce_enrollment_multiunit_invariants

- Arquivo: backend/src/database/migrations/20260729180000_enforce_enrollment_multiunit_invariants.js, preservado byte a byte.
- Dependências corrigidas: reconciliação versionada. Tabela/artefatos: os mesmos invariants finais descritos acima.
- Destrutividade/lock/dados: possui DDL de índice/generated e diagnósticos seguros, mas não será reaplicada depois que os artefatos forem reconciliados.
- Idempotência/rollback: código up é idempotente; down pode remover artefatos e restaurar unique global, logo é inseguro para identidades cross-unit.
- Pré/pós: a corretiva deve estar APPLIED e o schema presente; depois, esta migration histórica deve ser registrada por baseline controlado para remover somente o drift formal.

## Dependências corrigidas

- O progresso digital deixou de ser dependência artificial do invariant de DRAFT.
- O progresso depende agora de ownership de responsável e da correção do tipo do convite.
- A migration histórica multiunidade depende da nova reconciliação.
- A reconciliação depende explicitamente da proteção DRAFT original, FK de unidade e ownership do responsável.
- A correção do convite depende da foundation de convite.
- Nenhuma migration antiga foi editada para encaixar o grafo.

## Decisão sobre unit_id

O tipo físico canônico do núcleo multiunidade é BIGINT signed: j12_unidades.id, enrollments.unit_id e user_unit_memberships.unit_id. Na aplicação/API o identificador continua sendo string decimal, evitando perda de precisão de BIGINT em Number do JavaScript.

Impactos:

- enrollment_digital_invitations.unit_id VARCHAR(64) será corrigido somente pela migration explícita 20260803130000; ela valida formato, faixa signed BIGINT, órfãos, índice e FK.
- mysql-enrollment.repository.js e mysql-user-unit-membership.repository.js já serializam o valor retornado com String.
- repositories/DTOs devem aceitar apenas representação decimal canônica e nunca converter para Number.
- tabelas digitais de contrato e conversões CRM que ainda declaram unit_id VARCHAR(64) permanecem risco adiado; exigem auditoria/migrations próprias antes de receber FK para j12_unidades.
- alterar tipo diretamente ou editar a migration histórica de convite é proibido.

## Migration corretiva criada

A estratégia escolhida preserva a história: aplicar foundations originais ausentes e usar 20260803123000 somente para reconciliar estado parcial/drift. Ela delega a lógica auditada da migration histórica, envolve-a em validações mais estritas e não mascara artefatos incompatíveis. Uma segunda migration, 20260803130000, corrige o tipo do convite apenas quando o fluxo digital for autorizado.

## apply-one implementado

O comando oferece dry-run e write explícitos. O dry-run nunca cria writer. O write futuro exige migration, banco, token, --write e identificador de backup. O fluxo faz duas coletas antes de criar o writer, usa CanonicalMigrationRunner.applyOne com MigrationExecutor e MySqlMigrationLedger oficiais, exige retorno de um único ID e executa pós-validação.

## Proteções

- catálogo, PENDING, checksum, manifest e dependências;
- bloqueio de UNKNOWN, drift não revisado e ownership ambíguo;
- token de banco/migration/checksum/dependências/snapshot integral;
- revalidação imediata e plano imutável;
- uma migration por chamada;
- FAILED nunca é marcado APPLIED;
- fingerprint das tabelas não afetadas e das três legadas;
- backup externo obrigatório;
- DDL implícito declarado e rollback automático desabilitado.

## Manifests adicionados

Foram publicados manifests completos para auth runtime, people normalized, pre-enrollment integrity, auth identities, memberships, unit ownership, unit FK, ownership de responsável, invariant histórico, reconciliação multiunidade e correção de convite. Tipo, nullability, default, auto increment, generated expression, índices e FKs são comparados conforme aplicável.

## Riscos restantes

- ownership ambíguo entre as duas migrations add_enrollment_class_links_table continua bloqueado e fora da cadeia DRAFT.
- VARCHAR(64) em contratos digitais e conversões CRM ainda diverge do tipo físico canônico.
- ALTER TABLE/índices/FKs podem gerar lock prolongado e commit implícito em MySQL.
- compatibilidade e volume do banco real só poderão ser confirmados em homologação autorizada, com dumps validados.
- o executor JavaScript histórico usa o contrato up exportado por cada migration; cada target deve continuar passando por dry-run, manifest e teste específico antes de homologação.

## Ordem recomendada para homologação

1. Resolver ou isolar formalmente o ownership ambíguo das class links.
2. Gerar/validar dumps e registrar o backup externo.
3. Executar Doctor, plan e validate somente leitura.
4. Para cada item pendente da cadeia, executar apply-one --dry-run, revisar token/ações e autorizar um único apply-one --write.
5. Ordem: auth runtime; normalized people; pre-enrollment integrity; auth identities; memberships; draft ownership; unit ownership; unit FK; reconciliação multiunidade.
6. Executar Doctor/validate e testes funcionais depois de cada item.
7. Com a corretiva fisicamente presente, usar baseline controlado somente para 20260729180000.
8. Validar abertura idempotente de DRAFT por unidade.
9. Autorizar convite digital em incremento separado: invitation foundation, correção BIGINT/FK, progress e etapas posteriores.

## Testes executados

As suítes cobrem cadeia/topologia, todas as guardas de apply-one, token, backup, revalidação, execução unitária, runner/executor/ledger oficiais com fakes, falha sem APPLIED, pós-validação, manifests, expressão/composição exata, tipo unit_id, idempotência das três migrations novas, substituição condicional de índice, aborto por dados, ausência de DML e limite legado.

## Arquivos criados

- backend/src/database/migration-manager/apply-manager.js
- backend/src/database/migration-manager/apply-one-database-client.js
- backend/src/database/migration-manager/apply-one-errors.js
- backend/src/database/migration-manager/apply-one-token.js
- backend/src/database/migration-manager/draft-chain.js
- backend/src/database/migration-manager/SPRINT-0.4-REPORT.md
- backend/src/database/j12-doctor/manifests/draft-chain.manifests.js
- backend/src/database/migrations/20260803120000_prepare_enrollment_draft_ownership.js
- backend/src/database/migrations/20260803123000_reconcile_enrollment_multiunit_invariants.js
- backend/src/database/migrations/20260803130000_reconcile_enrollment_digital_invitation_unit_type.js
- backend/src/database/migration-manager/tests/sprint-0-4-apply-one.test.js
- backend/src/database/migration-manager/tests/sprint-0-4-cli.test.js
- backend/src/database/migration-manager/tests/sprint-0-4-corrective-migrations.test.js
- backend/src/database/migration-manager/tests/sprint-0-4-draft-chain.test.js
- backend/src/database/migration-manager/tests/sprint-0-4-manifests.test.js
- backend/src/database/migration-manager/tests/sprint-0-4-official-runner.test.js

## Arquivos alterados

- backend/src/database/migration-runner/canonical-migration-runner.js
- backend/src/database/migration-runner/canonical-migration-runner.test.js
- backend/src/database/migration-runner/migration-dependencies.js
- backend/src/database/migrations/tests/digital-enrollment-progress.migration.test.js
- backend/src/database/migrations/tests/enrollment-multiunit-invariants.migration.test.js
- backend/src/database/j12-doctor/checks/schema-manifest-check.js
- backend/src/database/j12-doctor/doctor.js
- backend/src/database/j12-doctor/manifests/index.js
- backend/src/database/j12-doctor/schema-inspector.js (somente formatação)
- backend/src/database/j12-doctor/tests/manifests.test.js
- backend/src/database/migration-manager/cli.js
- backend/src/database/migration-manager/constants.js
- backend/src/database/migration-manager/formatter.js
- backend/src/database/migration-manager/index.js
- backend/src/database/migration-manager/manager.js
- backend/src/database/migration-manager/README.md
- backend/src/database/migration-manager/tests/cli.test.js

## Confirmação de não execução

- nenhuma conexão real foi aberta;
- nenhuma migration foi aplicada;
- nenhum schema foi alterado;
- nenhum dado foi alterado;
- nenhuma tabela legada foi modificada;
- nenhum ledger foi criado ou atualizado.
