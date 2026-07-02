# Sprint 9.26 - Integracao Da Leitura Real De DraftEnrollment

## Objetivo

Completar o ciclo basico de persistencia do `draftEnrollment`, permitindo que
um rascunho ja salvo em `enrollments` seja recuperado antes de criar outro
registro.

## Implementacao

Arquivos alterados:

```text
backend/src/domains/enrollments/application/repositories/enrollment.repository.js
backend/src/domains/enrollments/application/services/enrollment-application.service.js
backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment.repository.js
backend/src/domains/pessoas/application/services/enrollment-application.service.js
```

O fluxo do orquestrador de `pessoas` agora:

1. resolve os dados seguros do aluno e perfil;
2. tenta recuperar um `DRAFT` persistido para `studentPersonId` e
   `studentProfileId`;
3. se encontrar, usa o draft persistido e retorna `metadata.step =
   "readDraftEnrollment"`;
4. se nao encontrar, mantem o comportamento da Sprint 9.25 e persiste um novo
   draft;
5. se a leitura falhar, registra log, retorna warning e usa fallback em memoria
   sem criar novo registro inseguro.

## Metodos Adicionados

No `MySqlEnrollmentRepository`:

- `findDraftByStudent({ studentPersonId, studentProfileId })`;
- `findDraftByStudentPersonId(studentPersonId)`;
- `findDraftByStudentProfileId(studentProfileId)`.

No `EnrollmentApplicationService` do dominio `enrollments`:

- `findDraftEnrollment({ studentPersonId, studentProfileId })`.

Todas as consultas usam parametros e filtram:

```text
status = DRAFT
deleted_at IS NULL
```

## Fallback E Seguranca

Quando nao existe draft persistido:

- o fluxo atual continua funcionando;
- um novo draft e persistido pelo caminho ja criado na Sprint 9.25;
- nenhum erro e lancado.

Quando a leitura falha:

- o erro e registrado em log;
- o fluxo de pessoas nao quebra;
- o retorno inclui warning `DRAFT_ENROLLMENT_READ_FAILED`;
- o service usa draft em memoria para evitar duplicidade insegura.

## Smoke Tests

Foi executado smoke test real com transacao manual e rollback:

- criou Pessoa/Perfil de aluno de teste;
- criou previamente um registro `DRAFT` em `enrollments`;
- executou o orquestrador de `pessoas`;
- confirmou que o draft existente foi recuperado;
- confirmou que nenhum segundo draft foi criado para o mesmo aluno/perfil;
- validou o fallback quando nao havia draft existente;
- fez rollback para nao deixar massa de teste.

Resultado:

```text
ENROLLMENTS_TABLE_EXISTS=true
DRAFT_ENROLLMENT_READ_ENABLED=true
DRAFT_ENROLLMENT_FOUND=true
DRAFT_ENROLLMENT_FALLBACK_OK=true
```

## Auditoria

Executado:

```bash
node --check backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment.repository.js
node --check backend/src/domains/enrollments/application/services/enrollment-application.service.js
node --check backend/src/domains/pessoas/application/services/enrollment-application.service.js
cmd /c npm run build
```

Resultado:

- `node --check`: aprovado;
- `cmd /c npm run build`: aprovado;
- smoke test: aprovado;
- `CreateEnrollmentUseCase` continua sem conhecer repository concreto;
- nenhuma controller, rota, API publica ou frontend foi alterado;
- `/public/enrollments` nao foi alterado;
- financeiro, mensalidades, turmas, legado e contratos publicos nao foram
  alterados;
- estrutura da tabela `enrollments` nao foi modificada.

## Limitacoes

Esta sprint nao cria endpoints de consulta e nao altera o contrato externo da
API. A leitura foi integrada apenas ao fluxo de aplicacao existente.

## Proximos Passos

1. Avaliar uma estrategia explicita de idempotencia por aluno/perfil.
2. Planejar transacao multi-repository em sprint propria.
3. Adicionar observabilidade consolidada para falhas de leitura/persistencia de
   Matricula.
