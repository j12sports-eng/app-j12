# Enrollment Persistence Discovery

Documento da Sprint 9.16 para mapear a infraestrutura existente antes de
implementar persistencia de Matricula.

Esta sprint nao implementa repository concreto, SQL, Prisma, migration,
endpoint, controller, rota, API, frontend, contrato ou financeiro.

## Resumo Executivo

Nao existe uma tabela definitiva de Matricula para o Aggregate Root
`Enrollment`.

Existem estruturas relacionadas, mas nenhuma e base segura para persistir a
Matricula do dominio novo:

- `j12_alunos`: cadastro operacional legado de aluno, com numero/status/snapshot
  de matricula misturados ao aluno.
- `j12_matricula_numeros`: registry de numeros de matricula, nao Matricula.
- `j12_matriculas_publicas`: protocolo/snapshot de matricula publica, nao
  jornada operacional definitiva.
- `public_enrollments`: tabela SQLite legada da matricula publica.
- `enrollment_numbers`: registry SQLite legado de numeros.
- `pre_matriculas`: solicitacao de pre-matricula, nao Matricula ativa ou draft.

Recomendacao para a Sprint 9.17: criar um repository concreto novo para o
dominio `enrollments`, persistindo em nova tabela MySQL propria chamada
`enrollments`, ligada a `people.id` e `person_profiles.id`. O legado pode ser
consultado/adaptado apenas para compatibilidade e numero de matricula, nunca
como tabela principal do Aggregate Root.

## Infraestrutura De Banco Encontrada

Tecnologia operacional atual:

- MySQL via `mysql2/promise`.
- Pool em `backend/src/config/db.js`.
- SQL direto.
- `ensureSchema()` cria/ajusta varias tabelas em runtime.
- `backend/sql/schema.sql` contem schema minimo legado.
- `server/database.mjs` usa SQLite (`node:sqlite`) e `data/j12.sqlite`; deve ser
  tratado como legado separado.

Nao foi encontrado:

- Prisma;
- `schema.prisma`;
- dependencia `@prisma/*`;
- migrations versionadas de Matricula;
- adapter concreto do dominio `enrollments`;
- repository concreto de `Enrollment`.

## 1. Existe Tabela De Matricula?

Nao existe tabela definitiva de Matricula para o dominio `enrollments`.

### Tabelas Relacionadas Encontradas

| Tabela | Localizacao | Uso atual | Pode ser Matricula definitiva? |
| --- | --- | --- | --- |
| `j12_alunos` | `backend/src/config/db.js`, `backend/sql/schema.sql` | Cadastro legado/operacional de aluno. Guarda `numero_matricula`, `matricula_em`, `status`, `turma_id`, `plano_id`, `matricula_snapshot_json`. | Nao. Mistura Pessoa/Aluno/Matricula/snapshot e usa `aluno.id` legado. |
| `j12_matricula_numeros` | `backend/src/config/db.js` | Reserva, reuso e sincronizacao de numero de matricula por `aluno_id`. | Nao. E registry de numeros. |
| `j12_matriculas_publicas` | `backend/src/config/db.js`, `backend/src/controllers/public-enrollments.controller.js` | Guarda protocolo publico, numero, `aluno_id`, status `recebida` e payload JSON. | Nao. E entrada publica/snapshot. |
| `public_enrollments` | `server/database.mjs` | SQLite legado para matricula publica. | Nao. Pertence ao servidor legado SQLite. |
| `enrollment_numbers` | `server/database.mjs` | Registry SQLite legado de numeros. | Nao. E apenas controle de numeracao. |
| `pre_matriculas` | `backend/src/domains/pessoas/pre-matricula/*` | Pre-matricula isolada com status de solicitacao. | Nao. Representa solicitacao inicial, nao Matricula. |

### Onde A Matricula Devera Ser Persistida

A Matricula do dominio novo deve ser persistida em uma nova tabela MySQL propria:

```text
enrollments
```

Essa tabela deve pertencer ao dominio:

```text
backend/src/domains/enrollments
```

Ela deve ser acessada apenas por um repository concreto futuro do dominio
`enrollments`, mantendo o fluxo de `pessoas` isolado de SQL e banco.

## 2. Existe Model Prisma?

Nao.

Buscas por `PrismaClient`, `schema.prisma`, `@prisma` e `prisma` nao
encontraram implementacao Prisma no backend. A documentacao de banco existente
tambem registra que o projeto usa MySQL com `mysql2` e SQL direto.

## 3. Existe Repository Legado?

Nao existe repository legado de Matricula definitiva.

Componentes encontrados:

| Componente | Localizacao | Responsabilidade | Reutilizacao recomendada |
| --- | --- | --- | --- |
| `EnrollmentRepository` JSDoc | `backend/src/domains/enrollments/application/repositories/enrollment.repository.js` | Contrato futuro: `create`, `findById`, `findByStudentPersonId`, `update`, `delete`. | Reutilizar como contrato base. Precisa implementacao concreta. |
| `IEnrollmentRepository` JSDoc | `backend/src/domains/pessoas/application/interfaces/ienrollment.repository.js` | Interface conceitual antiga com `findById`, `findByNumber`, `create`. | Nao usar como contrato principal; esta no dominio `pessoas` e e menos alinhada ao Aggregate novo. |
| `PrematriculaRepository` | `backend/src/domains/pessoas/pre-matricula/prematricula.repository.js` | CRUD de `pre_matriculas`. | Nao reutilizar para Matricula; pode inspirar padrao de query runner e mapper. |
| `public-enrollments.controller.js` | `backend/src/controllers/public-enrollments.controller.js` | Fluxo legado: reserva numero, cria `j12_alunos`, grava `j12_matriculas_publicas`. | Nao reutilizar como repository. Pode orientar compatibilidade com numero publico. |
| `persistAluno()` | `backend/src/controllers/alunos.controller.js` | Persiste aluno legado e snapshots em varias tabelas `j12_alunos_*`. | Nao reutilizar para Matricula; acoplado a controller/legado e `aluno.id`. |

## 4. Campos Minimos Ja Existentes

### No Dominio `enrollments`

`Enrollment` e `EnrollmentFactory.createDraft()` ja trabalham em memoria com:

- `id`;
- `studentPersonId`;
- `studentProfileId`;
- `status`;
- `startDate`;
- `endDate`;
- `createdAt`;
- `updatedAt`.

Campos obrigatorios para `createDraft()`:

- `studentPersonId`;
- `studentProfileId`;
- `startDate`.

Status inicial:

- `DRAFT`.

### No Fluxo Atual De Pessoas

O fluxo de application ja entrega dados seguros para persistencia futura:

- `responsiblePerson`;
- `responsibleProfile`;
- `studentPerson`;
- `studentProfile`;
- `responsibleStudentRelationship`;
- `draftEnrollment` em memoria.

O `studentPersonId` vem de `aluno.personId`, `aluno.person_id` ou da nova Pessoa
criada. `aluno.id` nao e usado como identidade segura.

### No Payload Atual

`CreateEnrollmentRequest`/validator reconhecem:

- `matricula.numeroMatricula`;
- `matricula.dataMatricula`;
- `matricula.statusInicial`;
- `matricula.modalidadeIds`;
- `matricula.unidadeIds`;
- `matricula.turmaIds`;
- `matricula.horarioIds`;
- `matricula.planoId`.

Na Sprint 9.15, o draft em memoria usa explicitamente `matricula.startDate`
para nao inventar data.

### No Legado MySQL

`j12_alunos` contem dados aproveitaveis para migracao/compatibilidade:

- `id`;
- `numero_matricula`;
- `status`;
- `matricula_em`;
- `turma_id`;
- `unidade_id`;
- `modalidade_id`;
- `plano_id`;
- `responsavel_id`;
- `matricula_snapshot_json`.

`j12_matricula_numeros` contem:

- `numero`;
- `aluno_id`;
- `aluno_nome`;
- `status`;
- `last_assigned_at`;
- `released_at`.

`j12_matriculas_publicas` contem:

- `id`;
- `protocolo`;
- `numero_matricula`;
- `aluno_id`;
- `nome_aluno`;
- `nome_responsavel`;
- `email_responsavel`;
- `status`;
- `payload_json`;
- `created_at`;
- `synced_at`.

## 5. Campos Ainda Faltam

Faltam na persistencia definitiva de Matricula:

- tabela `enrollments`;
- colunas `student_person_id` e `student_profile_id`;
- coluna `status` com enum/mapeamento canonico do dominio;
- coluna `start_date`;
- decisao entre `enrollment_date` e `start_date`;
- `enrollment_number` e regra de unicidade;
- `responsible_relationship_id`;
- `unit_id` ou estrutura para multiplas unidades;
- `modality_id` ou tabela auxiliar para multiplas modalidades;
- `class_id`/`turma_id` ou tabela auxiliar para multiplas turmas;
- `schedule_id` ou tabela auxiliar para horarios;
- `plan_id`;
- `origin`;
- `metadata_json`;
- `idempotency_key`;
- `created_at`;
- `updated_at`;
- indices por aluno/perfil/status/numero;
- regra de uma Matricula ativa por `student_profile_id`, se aprovada;
- mapper `Enrollment <-> row`;
- validator de persistencia;
- repository concreto;
- testes/smoke de concorrencia para numero de matricula.

## 6. Dependencias Que Impedem A Persistencia Agora

Principais impedimentos:

- nao existe tabela definitiva de Matricula;
- nao existe migration ou SQL aprovado para `enrollments`;
- nao existe repository concreto no dominio `enrollments`;
- `j12_alunos` usa `aluno.id`, enquanto o fluxo novo exige
  `studentPersonId`/`studentProfileId`;
- `j12_matriculas_publicas` representa captacao publica e snapshot, nao
  Aggregate Root;
- `pre_matriculas` representa solicitacao inicial e tem outro ciclo de status;
- status legados (`ativo`, `experimental`, `reservado`, `recebida`,
  `PENDENTE`) ainda nao estao mapeados para `EnrollmentStatus`;
- a regra de `startDate` versus `dataMatricula` ainda precisa decisao formal;
- cardinalidade de unidade/modalidade/turma/horario ainda precisa contrato
  definitivo;
- plano/contrato/financeiro estao acoplados a `j12_alunos.aluno_id`, nao a
  `Enrollment.id`;
- nao ha estrategia transacional aprovada para persistir Pessoa, Perfil,
  Relacionamento e Matricula como unidade logica.

## 7. Estrategia Recomendada

Resposta explicita:

- Reutilizar: apenas contratos de dominio, `EnrollmentFactory`,
  `EnrollmentApplicationService`, `DatabaseContext`/padrao de query runner e,
  com cautela, o registry `j12_matricula_numeros` para numeracao futura.
- Adaptar: mappers/padroes de `PrematriculaRepository` e repositories de
  Pessoas como referencia de implementacao, sem reaproveitar tabela.
- Substituir: o uso de `j12_alunos` como lugar conceitual de Matricula deve ser
  substituido por `enrollments`.
- Criar novo: repository concreto `EnrollmentRepository` e tabela `enrollments`
  no dominio `backend/src/domains/enrollments`.

Justificativa:

`Enrollment` e um Aggregate Root proprio. Persisti-lo em `j12_alunos`,
`j12_matriculas_publicas` ou `pre_matriculas` quebraria a regra de identidade
segura, manteria dependencia de `aluno.id` legado e misturaria dados de Pessoa,
Aluno, captacao, snapshot, financeiro e status operacional.

## Relacionamentos Avaliados

### Pessoa

Base segura existente:

- `people.id`;
- `PersonApplicationService`;
- `PersonRepository`;
- `StudentApplicationService`.

Recomendacao: `enrollments.student_person_id` deve referenciar logicamente
`people.id`.

### Perfil

Base segura existente:

- `person_profiles.id`;
- `profile_type = aluno`;
- `ProfileApplicationService.createStudentProfile()`.

Recomendacao: `enrollments.student_profile_id` deve ser obrigatorio e deve
apontar para perfil `aluno`.

### Responsavel

Base segura existente:

- `person_relationships.id`;
- `relationship_type = responsible`;
- flags de responsavel legal/financeiro/comunicacao/busca/emergencia.

Recomendacao: persistir `responsible_relationship_id` quando o relacionamento
for exigido para ativacao ou cobranca.

### Turma

Base legado existente:

- `j12_turmas`;
- `j12_alunos.turma_id`;
- `j12_turmas.aluno_ids_json`.

Risco: turmas ainda estao no legado e usam IDs/tabelas `j12_*`, nao contrato do
dominio novo. A Matricula deve guardar apenas referencia, sem alterar turma na
Sprint 9.17.

### Plano

Base legado existente:

- `j12_planos`;
- `j12_alunos.plano_id`;
- `j12_financeiro_cobrancas.plano_id`;
- `j12_mensalidades.plano_id`.

Risco: plano esta acoplado ao financeiro legado. A Matricula pode guardar
`plan_id`, mas validacao e cobranca devem continuar fora de escopo.

### Contrato

Base legado existente:

- `student_contracts` com `aluno_id`;
- docs de contratos;
- rotas legadas de contratos.

Risco: contrato referencia aluno legado, nao `Enrollment.id`. Nao integrar na
persistencia inicial de Matricula.

### Financeiro

Base legado existente:

- `j12_financeiro_cobrancas`;
- `j12_mensalidades`;
- `j12_pagamentos`;
- `financial_payments`;
- services financeiros por `aluno_id`, `plano_id`, `turma`.

Risco: financeiro usa `aluno_id` legado. Nao criar cobranca ao persistir
Matricula.

## Arquivos Encontrados

Principais arquivos analisados:

- `backend/src/domains/enrollments/domain/entities/enrollment.entity.js`;
- `backend/src/domains/enrollments/domain/factories/enrollment.factory.js`;
- `backend/src/domains/enrollments/domain/enums/enrollment-status.enum.js`;
- `backend/src/domains/enrollments/application/services/enrollment-application.service.js`;
- `backend/src/domains/enrollments/application/repositories/enrollment.repository.js`;
- `backend/src/domains/pessoas/application/services/enrollment-application.service.js`;
- `backend/src/domains/pessoas/application/use-cases/create-enrollment.use-case.js`;
- `backend/src/domains/pessoas/application/interfaces/ienrollment.repository.js`;
- `backend/src/domains/pessoas/application/contracts/enrollment.contract.js`;
- `backend/src/domains/pessoas/pre-matricula/prematricula.repository.js`;
- `backend/src/domains/pessoas/pre-matricula/pre_matriculas.sql`;
- `backend/src/config/db.js`;
- `backend/sql/schema.sql`;
- `backend/src/controllers/public-enrollments.controller.js`;
- `backend/src/controllers/alunos.controller.js`;
- `backend/src/services/financeiro.service.js`;
- `server/database.mjs`;
- `docs/BANCO/MODELO.md`;
- `docs/BANCO/TABELAS.md`;
- `docs/BACKEND/ENROLLMENT_DOMAIN_CONTRACT.md`.

## Plano Tecnico Para Sprint 9.17

Plano recomendado, sem executar nesta sprint:

1. Criar schema SQL da tabela `enrollments` no dominio `enrollments`.
2. Criar `EnrollmentMapper` para converter `Enrollment` em row e row em
   entidade.
3. Criar repository concreto com query runner injetavel, sem controller/rota.
4. Persistir apenas o draft `Enrollment` usando:
   - `student_person_id`;
   - `student_profile_id`;
   - `status`;
   - `start_date`;
   - timestamps.
5. Nao criar contrato, financeiro, turma automatica ou endpoint.
6. Decidir formalmente se `matricula.dataMatricula` e `startDate` sao o mesmo
   conceito antes de usar fallback.
7. Tratar `enrollment_number` como etapa separada ou usar
   `j12_matricula_numeros` apenas depois de regra transacional/idempotente
   aprovada.

## Auditoria Executada

Buscas executadas:

- referencias a `Enrollment`, `EnrollmentRepository`, `EnrollmentModel`,
  `EnrollmentService`, `EnrollmentUseCase`, `EnrollmentEntity`,
  `EnrollmentStatus`;
- referencias a `matricula`, `Matricula`, `pre_matriculas`,
  `public_enrollments`, `j12_matricula_numeros`, `j12_matriculas_publicas`;
- referencias a Prisma, `schema.prisma`, migrations, SQL, repositories,
  adapters e models;
- relacionamentos com Pessoa, Perfil, Turma, Plano, Contrato e Financeiro.

Resultado:

- nenhuma funcionalidade foi modificada;
- nenhum JS foi alterado nesta sprint;
- nenhum banco, SQL, migration, Prisma, repository concreto, endpoint,
  controller, rota, API, frontend, contrato ou financeiro foi criado;
- a unica alteracao da sprint foi este documento;
- `node --check` nao se aplica porque nenhum JS foi criado/alterado;
- `cmd /c npm run build` executado com sucesso.

## Observacao De Worktree

O workspace ja continha alteracoes e arquivos nao rastreados de sprints
anteriores e de outros escopos antes desta analise. Esta sprint ficou restrita
a documentacao de descoberta.
