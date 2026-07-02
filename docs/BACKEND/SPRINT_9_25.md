# Sprint 9.25 - Integracao Da Persistencia Real De DraftEnrollment

## Objetivo

Integrar a persistencia real do `draftEnrollment` ao fluxo de criacao de
Pessoas, usando a infraestrutura do dominio `enrollments` e a tabela criada na
Sprint 9.24.

## Alteracao Implementada

Arquivo alterado:

```text
backend/src/domains/pessoas/application/services/enrollment-application.service.js
```

O orquestrador de `pessoas` passou a usar:

```js
EnrollmentDomainApplicationService.createDraftEnrollmentAndPersist()
```

com:

```js
MySqlEnrollmentRepository
```

A integracao acontece depois do fluxo seguro atual:

1. cria Pessoa do responsavel;
2. cria Perfil do responsavel;
3. resolve/cria Pessoa do aluno;
4. cria Perfil do aluno;
5. cria Relacionamento responsavel-aluno;
6. persiste `draftEnrollment` em `enrollments`.

Quando a persistencia e concluida, o retorno usa:

```text
metadata.step = "persistDraftEnrollment"
```

## Compatibilidade

O metodo `createDraftEnrollment()` foi preservado como criacao em memoria para
compatibilidade com chamadas existentes.

O novo caminho persistente fica no fluxo principal de `createEnrollment()`,
usando um metodo interno assíncrono que reaproveita a mesma resolucao de dados
do draft. O `CreateEnrollmentUseCase` continua dependendo apenas do
`EnrollmentApplicationService` de `pessoas`.

## Seguranca Em Falha De Persistencia

Se `MySqlEnrollmentRepository.create()` falhar:

- o erro e registrado em log pelo service;
- o fluxo de criacao de Pessoa nao e quebrado;
- o retorno preserva um `draftEnrollment` em memoria;
- e retornado warning `DRAFT_ENROLLMENT_PERSISTENCE_FAILED`;
- `metadata.step` nao e marcado como `persistDraftEnrollment`.

Nao foi introduzido UnitOfWork nesta sprint. Quando houver transacao externa
aplicavel, o repository continua aceitando `queryRunner`, o que permite rollback
controlado em testes e em evolucoes futuras.

## Persistencia

A persistencia grava apenas o registro inicial de Matricula:

- status inicial `DRAFT`;
- `student_person_id`;
- `student_profile_id`;
- `start_date`;
- timestamps padrao da tabela.

Nao foram criadas regras adicionais, Matricula final, financeiro, mensalidades,
turmas ou contratos.

## Smoke Test

Foi executado smoke test real com transacao manual:

- verificou `ENROLLMENTS_TABLE_EXISTS=true`;
- criou Pessoa do responsavel;
- criou Perfil do responsavel;
- criou Pessoa do aluno;
- criou Perfil do aluno;
- criou Relacionamento responsavel-aluno;
- persistiu `draftEnrollment` via `MySqlEnrollmentRepository`;
- validou a linha em `enrollments`;
- fez rollback da transacao para nao deixar massa de teste.

Resultado:

```text
ENROLLMENTS_TABLE_EXISTS=true
DRAFT_ENROLLMENT_PERSISTENCE_ENABLED=true
DRAFT_ENROLLMENT_PERSISTED=true
```

## Auditoria

Executado:

```bash
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
- legado, financeiro, mensalidades, turmas e contratos nao foram alterados.

## Arquivos Nao Alterados

Nao houve alteracao em:

- controllers;
- rotas;
- API publica;
- frontend;
- `/public/enrollments`;
- financeiro;
- mensalidades;
- turmas;
- legado;
- contratos existentes;
- estrutura da tabela `enrollments`.

## Proximos Passos

1. Avaliar UnitOfWork/transacao multi-repository em sprint propria.
2. Validar comportamento em homologacao com payloads reais da API atual.
3. Planejar observabilidade para falhas de persistencia de Matricula.
4. Manter `CreateEnrollmentUseCase` isolado de repositories concretos.
