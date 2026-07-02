# Sprint 9.23 - Integrar Persistencia Ao Orquestrador De Pessoas

## Objetivo

Avaliar a integracao da persistencia de Matricula ao orquestrador de `pessoas`,
usando o dominio `enrollments`, `EnrollmentDomainApplicationService` e
`MySqlEnrollmentRepository` somente se a tabela `enrollments` existir no banco
configurado.

## Verificacao Da Tabela

Foi executada verificacao somente leitura com `tableExists("enrollments")`, via
`backend/src/config/db.js`.

Resultado:

```text
ENROLLMENTS_TABLE_EXISTS=false
```

A migration existe no workspace:

```text
backend/src/database/migrations/20260629134546_create_enrollments_table.sql
```

Mas a tabela `enrollments` ainda nao existe no banco configurado. Por isso, a
persistencia real nao foi integrada ao fluxo de `pessoas`.

## Decisao De Implementacao

Como a tabela nao existe, a Sprint 9.23 manteve o comportamento seguro da
Sprint 9.15:

- cria Pessoa do responsavel;
- cria Perfil do responsavel;
- resolve/cria Pessoa do aluno;
- cria Perfil do aluno;
- cria Relacionamento responsavel-aluno;
- cria `draftEnrollment` apenas em memoria quando houver `matricula.startDate`;
- nao instancia `MySqlEnrollmentRepository`;
- nao chama `createDraftEnrollmentAndPersist()`;
- nao executa migration;
- nao altera banco.

## Alteracao No Orquestrador

Arquivo alterado:

```text
backend/src/domains/pessoas/application/services/enrollment-application.service.js
```

Foi adicionado warning explicito quando o draft e criado em memoria, mas a
persistencia esta bloqueada pela ausencia da tabela:

```text
DRAFT_ENROLLMENT_PERSISTENCE_TABLE_MISSING
```

Mensagem:

```text
Draft Enrollment was not persisted because the enrollments table is not available.
```

O `metadata.step` permanece `createDraftEnrollment`, porque nenhuma persistencia
foi executada. O step `persistDraftEnrollment` nao foi usado nesta sprint por
falta de base segura.

## Itens Nao Implementados

Nao foi implementado nesta sprint:

- execucao automatica de migration;
- alteracao de banco;
- wiring de `MySqlEnrollmentRepository` no fluxo real;
- chamada a `createDraftEnrollmentAndPersist()` no orquestrador de `pessoas`;
- alteracao em `CreateEnrollmentUseCase`;
- endpoint;
- controller;
- rota;
- API;
- frontend;
- EventBus;
- contrato;
- financeiro;
- turma;
- plano;
- legado;
- alteracao em `/public/enrollments`.

## Auditoria

Executado:

```bash
node --check backend/src/domains/pessoas/application/services/enrollment-application.service.js
npm run build
```

Smoke tests:

- tabela existente: nao executado contra banco real porque `enrollments` nao
  existe no banco configurado;
- tabela ausente: criou `draftEnrollment` em memoria e retornou warning
  `DRAFT_ENROLLMENT_PERSISTENCE_TABLE_MISSING`;
- payload invalido sem `matricula.startDate`: manteve `draftEnrollment` como
  `null` e retornou warning de `DRAFT_ENROLLMENT_START_DATE_MISSING`.

Resultado:

- `node --check` aprovado;
- `npm run build` aprovado;
- smoke test com tabela ausente aprovado;
- smoke test invalido aprovado;
- smoke test com tabela existente nao aplicavel sem executar migration.

## Confirmacoes

- `CreateEnrollmentUseCase` continua sem conhecer repository;
- `CreateEnrollmentUseCase` nao conhece `MySqlEnrollmentRepository`;
- nenhum controller, rota, API ou frontend foi alterado;
- nenhum legado foi alterado;
- `/public/enrollments` nao foi alterado;
- nenhum SQL de migration foi executado;
- nenhum banco foi alterado.

## Proximos Passos

1. Executar a migration `20260629134546_create_enrollments_table.sql` de forma
   manual e operacionalmente aprovada.
2. Confirmar novamente `tableExists("enrollments")`.
3. Somente depois disso, planejar a integracao real com
   `createDraftEnrollmentAndPersist()` e `MySqlEnrollmentRepository`.
4. Antes do wiring real, definir estrategia de consistencia entre Pessoa,
   Perfil, Relacionamento e Matricula.
