# Sprint 29.3B — Invariantes físicas multiunidade do Enrollment DRAFT

**Data:** 2026-07-29

**Branch:** `sprint-23`

**Natureza:** fundação de domínio e persistência. A migration foi criada e testada com doubles; não foi aplicada a banco ou ambiente real.

## 1. Problema e escopo

A auditoria da Sprint 29.3A identificou que o DRAFT moderno já era consultado por unidade, mas a unicidade física antiga considerava somente aluno Pessoa/Perfil e o agregado não exigia ownership completo do responsável. Isso permitia divergência entre o guard da aplicação e a constraint do MySQL, além de impedir DRAFTs independentes do mesmo aluno em unidades diferentes.

Esta sprint altera somente Enrollment, seu produtor canônico em Pessoas, migration, repository, serviços, facade e testes diretamente relacionados. Nenhuma rota foi criada ou montada. Contrato, convite, financeiro e portal não foram implementados ou integrados.

Documento de origem: [Sprint 29.3A](./SPRINT_29_3A_AUDITORIA_FLUXO_MATRICULA_DIGITAL.md). A decisão complementa a [ADR 0007](../ADR/ADR-0007-ENROLLMENT-NAO-ACEITA-UNIDADE-DO-CLIENTE.md) sem reescrevê-la.

## 2. Identidade funcional

A identidade lógica de um Enrollment corrente é:

`unitId + studentPersonId + studentProfileId`

O estado físico corrente abrange `DRAFT` e `ACTIVE`. Assim, para a mesma chave, pode existir no máximo um registro não excluído em um desses estados. Essa regra elimina DRAFT duplicado, ACTIVE duplicado e o conflito simultâneo DRAFT mais ACTIVE.

Motivos:

- `unitId` integra a identidade porque o domínio e todas as leituras operacionais modernas são multiunidade;
- Pessoa e Perfil do aluno formam o vínculo canônico já usado pelos guards, queries e migration anterior;
- `responsiblePersonId`, `responsibleProfileId` e `responsibleRelationshipId` são ownership obrigatório, mas não identidade do DRAFT: uma troca legítima de responsável exige revisão, não outro DRAFT concorrente;
- `studentId` legado não pertence ao agregado moderno;
- data inicial, origem, modalidade e turma não compõem a identidade atual: são ausentes, contextuais ou mutáveis no agregado existente;
- status seleciona o conjunto corrente, mas não permite um DRAFT e um ACTIVE simultâneos para a mesma chave.

Consequências:

- o mesmo responsável pode manter DRAFTs distintos para filhos distintos;
- o mesmo aluno pode ter DRAFTs independentes em unidades diferentes, conforme o comportamento multiunidade atual;
- retries da mesma combinação retornam o mesmo DRAFT somente se todo o ownership persistido também coincidir;
- divergência de responsável ou relacionamento nunca é reutilizada silenciosamente.

## 3. Compatibilidade física e migration

Antes e depois desta sprint, `j12_unidades.id` e `enrollments.unit_id` são `BIGINT` assinado. `enrollments.unit_id` permanece nullable somente para permitir leitura e diagnóstico do legado. Novas criações modernas exigem unidade canônica na factory e no repository.

A FK `enrollments.unit_id -> j12_unidades.id` e o índice de busca por unidade já pertencem à migration `20260729150000_add_enrollment_unit_foreign_key.js`. A nova migration os verifica como pré-condição em vez de duplicar DDL. Também exige as FKs canônicas de aluno, responsável, perfis e relacionamento.

A migration criada é `20260729180000_enforce_enrollment_multiunit_invariants.js`. Ela:

- valida tabelas, colunas, tipos, nullability canônica de `j12_unidades.id`, FKs e a estrutura do índice DRAFT anterior;
- adiciona `active_draft_unit_id`, gerada somente para DRAFT não excluído;
- substitui `ux_enrollments_active_draft_student_profile` pela composição `active_draft_unit_id, active_draft_student_person_id, active_draft_student_profile_id`;
- adiciona `current_enrollment_unit_id`, `current_enrollment_student_person_id` e `current_enrollment_student_profile_id`, geradas para DRAFT ou ACTIVE não excluído;
- cria `ux_enrollments_current_unit_student_profile` sobre as três colunas correntes;
- não usa índice parcial, trigger, backfill ou escrita corretiva;
- possui `down` fail-closed quando restaurar o índice global antigo colidiria com DRAFTs legítimos de unidades diferentes.

A ordem foi registrada no catálogo de dependências. A migration depende das migrations de unicidade DRAFT anterior, integridade do pré-cadastro, colunas de ownership digital e FK canônica de unidade.

## 4. Legado e diagnóstico

As consultas read-only classificam:

1. registros modernos com unidade válida;
2. legados com `unit_id` nulo;
3. schema/tipo físico incompatível;
4. unidade ou ownership órfãos;
5. conflito entre estados correntes;
6. grupos DRAFT duplicados na mesma unidade;
7. grupos ACTIVE duplicados na mesma unidade;
8. DRAFTs de mesma identidade em unidades diferentes, que são válidos no `up` e bloqueiam um `down` inseguro.

Legados sem unidade são relatados e continuam hidratáveis, mas não podem ser reutilizados, confirmados ou usados como fonte implícita de unidade. Dados modernos incompletos, órfãos ou conflitantes fazem a migration falhar antes de qualquer DDL. Não há escolha da primeira unidade, consulta a `j12_alunos` nem inferência por aluno ou responsável.

## 5. Domínio e aplicação

`Enrollment` hidrata os três campos de ownership do responsável como nullable para manter leitura histórica. `EnrollmentFactory.createDraft`, usada por novas operações modernas, exige unidade, responsável Pessoa/Perfil, relacionamento e aluno Pessoa/Perfil. A serialização expõe esses campos e `unitId` de forma coerente.

O application service aceita unidade do ActorContext quando o contexto existe; esse valor sempre substitui um seletor hostil no input. O input direto continua disponível somente como integração interna confiável já existente. O produtor canônico de Pessoas encaminha os IDs que acabou de resolver, sem adotar unidade de aluno, responsável ou DRAFT anterior.

O adapter MySQL valida, antes do INSERT e novamente dentro da transação idempotente:

- existência da unidade canônica;
- responsável e aluno ativos;
- perfil ativo `responsavel` pertencente ao responsável;
- perfil ativo `aluno` pertencente ao aluno;
- relacionamento ativo, na direção responsável para aluno, com os mesmos IDs.

O schema atual de People não associa Pessoa/Perfil a uma unidade. Portanto, o que pode ser comprovado hoje é a validade global desses registros e a unidade canônica confiável da operação; não se afirma um membership de Pessoa que o modelo não representa. A Sprint 29.3C deve decidir a política de elegibilidade por unidade antes de expor uma nova entrada digital.

## 6. Repository, confirmação e concorrência

INSERT, leitura de DRAFT, leitura de ACTIVE, conflito e transição de confirmação usam `unit_id` quando aplicável. O reuso exige correspondência exata da chave e dos campos de ownership. Um DRAFT legado, de outra unidade ou com responsável divergente falha fechado.

A criação atômica mantém o named lock do MySQL, agora derivado de unidade mais Pessoa/Perfil do aluno, e executa validação, busca, INSERT ou recuperação dentro de uma transação na mesma conexão. Falha operacional provoca `ROLLBACK`; o lock é liberado no `finally`. O índice físico torna a proteção válida entre múltiplas instâncias, sem depender de lock em memória.

`ER_DUP_ENTRY` só é recuperado como idempotência quando a mensagem identifica `ux_enrollments_active_draft_student_profile`; a linha recuperada ainda precisa ter unidade e ownership idênticos. Na confirmação, somente `ux_enrollments_current_unit_student_profile` é traduzido para conflito ACTIVE controlado; outros erros continuam visíveis.

A confirmação continua simples e interna: valida ActorContext, unidade persistida, estado DRAFT e ausência de ACTIVE da mesma unidade, e faz update condicional por id, unidade e estado esperado. Duas confirmações do mesmo DRAFT não criam dois registros: a primeira transiciona e a segunda recebe resultado idempotente `alreadyConfirmed`. Isso ainda não representa ativação digital completa e não exige contrato, turma, revisão, cobrança ou documentos nesta sprint.

## 7. Compatibilidade, riscos e limites

- Facade e serviços encaminham ActorContext sem alterar controllers ou montar rotas.
- O pré-cadastro de Pessoas já resolve responsável, perfis, aluno e relacionamento; agora encaminha todo o ownership ao Enrollment.
- A entrada CRM montada possui somente aluno e unidade do lead. Ela não inventa responsável nem relacionamento e, por isso, passa a falhar fechado na criação moderna até que um fluxo canônico forneça ownership completo. Essa restrição é intencional e deve ser resolvida na 29.3C, não por fallback.
- Fixtures e repositories in-memory diretamente afetados foram alinhados com o contrato moderno; hidratação legada continua permissiva.
- A migration é um artefato versionado não aplicado. O estado e o volume reais das categorias de diagnóstico permanecem não verificados.
- Named locks reduzem trabalho concorrente, mas a garantia final é o índice único do banco. Indisponibilidade de lock, falha de release e rollback continuam falhando fechado.

## 8. Testes

Foram criados ou ampliados testes de entity, factory, application service, student boundary, pré-cadastro de Pessoas, repository e migration para cobrir:

- exigência e serialização de unidade e ownership;
- ActorContext hostil;
- DRAFT de outra unidade não reutilizado;
- DRAFTs independentes entre unidades;
- dois alunos do mesmo responsável;
- reuso da mesma chave;
- ACTIVE na mesma unidade e em unidade distinta;
- INSERT e queries com unidade;
- validação de relacionamento;
- concorrência na criação e confirmação;
- tratamento seletivo de `ER_DUP_ENTRY`;
- lock não adquirido, rollback e release;
- schema, FK, índices, diagnósticos e fail-fast da migration;
- hidratação legada sem autorização operacional.

Os comandos e totais executados são registrados no relatório final da sprint, para não confundir artefato de teste com migration aplicada.

## 9. Pré-requisitos para a Sprint 29.3C

1. revisar os diagnósticos em ambiente autorizado antes de aplicar a migration;
2. tratar manualmente ownership órfão, incompleto ou conflito corrente;
3. definir como a entrada CRM obterá responsável e relacionamento canônicos;
4. definir elegibilidade de Pessoas por unidade, já que o schema atual não oferece esse vínculo;
5. aplicar e verificar as migrations somente por processo operacional autorizado;
6. abrir o fluxo digital apenas por boundary que entregue ActorContext e ownership completos;
7. manter confirmação simples separada da futura ativação digital com readiness.
