# Sprint 9.21 - Enrollment Repository Infrastructure

## Objetivo

Criar a infraestrutura inicial do repository concreto de Matricula para o
dominio `enrollments`, sem integrar a persistencia ao fluxo real de criacao de
matricula.

## Repository Criado

Arquivos criados:

```text
backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment.repository.js
backend/src/domains/enrollments/infrastructure/repositories/index.js
```

Arquivos atualizados:

```text
backend/src/domains/enrollments/infrastructure/index.js
backend/src/domains/enrollments/index.js
```

Classe criada:

```js
MySqlEnrollmentRepository
```

## Padrao De Conexao

Foi reutilizado o padrao real ja usado por repositories MySQL atuais:

- constructor com `queryRunner` opcional;
- `this.query = queryRunner || getDefaultQueryRunner()`;
- carregamento preguicoso de `backend/src/config/db.js`;
- nenhum novo pool ou conexao foi criado;
- nenhum `ensureTable()` foi criado, porque a tabela deve vir da migration
  versionada da Sprint 9.20.

## Metodo Implementado

Implementado somente:

```js
create(enrollment)
```

O metodo:

- valida os campos minimos antes do INSERT;
- gera `id` com `randomUUID()` quando ausente, seguindo o padrao de repositories
  existentes;
- executa `INSERT INTO enrollments`;
- busca a linha criada por `id` para retornar uma estrutura equivalente ao row
  mapping do repository;
- aceita `Enrollment` ou objeto plano compativel.

Nenhum outro metodo do contrato foi implementado nesta sprint.

## Mapeamento Entidade/Tabela

Mapeamento definido:

- `Enrollment.id -> enrollments.id`;
- `Enrollment.studentPersonId -> enrollments.student_person_id`;
- `Enrollment.studentProfileId -> enrollments.student_profile_id`;
- `Enrollment.status -> enrollments.status`;
- `Enrollment.startDate -> enrollments.start_date`;
- `Enrollment.endDate -> enrollments.end_date`;
- `Enrollment.createdAt -> enrollments.created_at`;
- `Enrollment.updatedAt -> enrollments.updated_at`;
- `Enrollment.deletedAt -> enrollments.deleted_at`.

Observacao: a entidade atual ainda nao declara `deletedAt`; o repository aceita
esse campo de forma opcional para compatibilidade com a tabela e com o contrato
de persistencia.

## Limitacoes

A migration `20260629134546_create_enrollments_table.sql` ainda nao foi
executada. Por isso:

- nenhum smoke test contra banco real foi executado;
- nenhuma tabela foi criada;
- nenhum dado foi persistido;
- validacao ficou restrita a sintaxe, build e teste isolado com mock de
  `queryRunner`.

## Itens Nao Implementados

Nao foi implementado nesta sprint:

- execucao da migration;
- alteracao real no banco;
- metodos alem de `create()`;
- persistencia real no fluxo atual;
- integracao com `EnrollmentApplicationService`;
- integracao com `CreateEnrollmentUseCase`;
- integracao com o application service de `pessoas`;
- UnitOfWork;
- transacao multi-repository;
- EventBus;
- contrato;
- financeiro;
- turma;
- plano;
- endpoint;
- controller;
- rota;
- API;
- frontend;
- alteracao em `/public/enrollments`;
- alteracao em legado.

## Auditoria

Executado:

```bash
node --check backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment.repository.js
node --check backend/src/domains/enrollments/infrastructure/repositories/index.js
node --check backend/src/domains/enrollments/infrastructure/index.js
node --check backend/src/domains/enrollments/index.js
npm run build
```

Tambem foi executado teste isolado com `queryRunner` mockado, sem banco real.

Resultado:

- repository concreto criado apenas no dominio `enrollments`;
- `node --check` aprovado nos JS criados/alterados;
- `npm run build` aprovado;
- teste isolado com `queryRunner` mockado aprovado;
- nenhuma migration executada;
- nenhum banco alterado;
- nenhum controller, endpoint, rota, API ou frontend alterado;
- nenhum legado alterado;
- `/public/enrollments` nao alterado;
- `CreateEnrollmentUseCase` nao conhece o repository;
- fluxo atual nao usa `MySqlEnrollmentRepository`.

## Proximos Passos

1. Aplicar a migration em homologacao quando houver aprovacao operacional.
2. Validar `create()` contra banco homologado com a tabela criada.
3. Implementar os demais metodos do contrato em sprints futuras.
4. Planejar integracao controlada com application service somente depois de
   validar transacao, rollback e idempotencia.
