# Sprint 9.43 - Preparacao de Integracao Matriculas e Turmas

## Objetivo

Preparar a integracao interna entre o dominio de matriculas e o modulo de
Turmas sem criar vinculo automatico ainda.

## Mapeamento do Modulo de Turmas

Arquivos atuais encontrados:

```text
backend/src/routes/turmas.routes.js
backend/src/config/db.js
src/lib/turmas-store.ts
src/routes/turmas.tsx
src/components/turmas/*
backend/src/domains/pessoas/application/interfaces/iclass.service.js
```

O backend de Turmas atual esta em rotas Express legadas:

```text
backend/src/routes/turmas.routes.js
```

Persistencia atual:

```text
tabela: j12_turmas
identificador: j12_turmas.id
status: j12_turmas.status
status conhecidos: ativa, inativa
capacidade: j12_turmas.capacidade
alunos vinculados no legado: j12_turmas.aluno_ids_json
```

Tambem existe vinculo legado do aluno com turma:

```text
j12_alunos.turma_id
j12_alunos.turma_principal
```

## Tabela Matricula-Turma

Nao foi encontrada uma tabela dedicada e segura para vincular o novo dominio
`enrollments` a Turmas.

Conclusao:

```text
sera necessaria migration futura para uma tabela de relacionamento
matricula/turma antes de persistir vinculos reais.
```

Nome conceitual sugerido para futura migration:

```text
enrollment_class_links
```

## Contrato Criado

Arquivo:

```text
backend/src/domains/enrollments/application/contracts/enrollment-class-link.contract.js
```

Metodo:

```js
prepareEnrollmentClassLink({
  enrollmentId,
  classId,
  requestedBy,
  enrollmentStatus,
  classStatus,
  metadata,
})
```

Tambem foi exposto pela `EnrollmentFacade`:

```js
facade.prepareEnrollmentClassLink(...)
```

## Comportamento

O contrato:

```text
valida enrollmentId, classId e requestedBy
normaliza classId/turmaId
exige classId numerico compativel com j12_turmas.id
retorna requiredEnrollmentStatus=ACTIVE
retorna allowedClassStatuses=[ativa]
marca linkCreated=false
marca persisted=false
marca financialSideEffects=false
marca requiresMigration=true
```

Ele nao:

```text
consulta Turmas
altera j12_turmas
altera j12_alunos
cria tabela
executa migration
gera mensalidade
aciona Financeiro
aciona Agenda
aciona Notificacoes
aciona App
```

## Regras Minimas Futuras

Para persistir vinculo real em sprint futura:

```text
matricula deve estar ACTIVE
turma deve existir em j12_turmas
turma deve estar ativa
capacidade deve ser validada
vinculo deve ser idempotente
historico/auditoria deve registrar requestedBy e timestamps
Financeiro deve continuar desacoplado do vinculo
```

## Arquivos Alterados

```text
backend/src/domains/enrollments/application/contracts/enrollment-class-link.contract.js
backend/src/domains/enrollments/application/contracts/index.js
backend/src/domains/enrollments/application/facades/enrollment.facade.js
backend/src/domains/enrollments/application/index.js
backend/src/domains/enrollments/index.js
docs/BACKEND/SPRINT_9_43.md
```

## Validacoes

Validacoes previstas:

```text
cmd /c npm run build
node --check nos arquivos alterados
smoke test interno
```

Smoke esperado:

```text
ENROLLMENT_CLASS_INTEGRATION_PREPARED=true
CLASS_MODULE_MAPPED=true
CLASS_LINK_CONTRACT_DOCUMENTED=true
NO_CLASS_LINK_CREATED=true
NO_FINANCIAL_SIDE_EFFECTS=true
OFFICIAL_FLOW_STILL_WORKING=true
NO_TEST_DATA_LEFT=true
```

## Fora Do Escopo

Nao foram alterados:

```text
frontend
API publica
controllers
rotas
financeiro
mensalidades
agenda
notificacoes
app
legado
schema
migrations
```
