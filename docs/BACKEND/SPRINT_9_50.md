# Sprint 9.50 - Integracao de Matriculas com Turmas

## Objetivo

Preparar a primeira integracao segura entre o dominio de Matriculas
(`enrollments`) e o modulo de Turmas, permitindo planejar o vinculo de uma
matricula `ACTIVE` a uma turma sem alterar frontend, API publica, Financeiro ou
schema.

## Mapeamento do Modulo de Turmas

Arquivos e pontos encontrados:

```text
backend/src/routes/turmas.routes.js
backend/src/config/db.js
backend/src/domains/pessoas/application/interfaces/iclass.service.js
docs/BACKEND/SPRINT_9_43.md
```

O backend de Turmas ainda esta implementado diretamente em rota Express legada:

```text
backend/src/routes/turmas.routes.js
```

Nao foi encontrado service/repository concreto de Turmas que possa ser chamado
com baixo acoplamento pelo dominio de Matriculas. O arquivo
`iclass.service.js` define apenas typedefs:

```text
findClassById(classId)
prepareClassAssignment(payload)
```

## Schema Real Mapeado

Tabela real de turmas:

```text
j12_turmas
```

Chave primaria:

```text
j12_turmas.id BIGINT AUTO_INCREMENT
```

Status:

```text
j12_turmas.status VARCHAR(30) DEFAULT 'ativa'
```

Status tratados pelo backend atual:

```text
ativa
inativa
```

Capacidade:

```text
j12_turmas.capacidade INT NULL
```

Vinculos legados atuais:

```text
j12_alunos.turma_id
j12_alunos.turma_principal
j12_turmas.aluno_ids_json
```

Esses vinculos pertencem ao cadastro operacional legado `j12_alunos`, nao ao
novo agregado `enrollments`.

## Estrutura Ausente

Nao foi encontrada tabela dedicada para relacionar:

```text
enrollments.id <-> j12_turmas.id
```

Nao foi encontrada estrutura confiavel para:

```text
historico de entrada/saida de matricula em turma
auditoria de vinculo por enrollment
unicidade enrollment/turma
status do vinculo enrollment/turma
capacidade calculada a partir de vinculos de enrollment
```

## Decisao Tecnica

Contrato/documentacao preparatoria.

Nao foi criado vinculo real nesta sprint.

Motivo:

```text
CLASS_LINK_BLOCKED_BY_SCHEMA_OR_MODULE_GAP=true
```

Persistir agora exigiria escolher entre atualizar `j12_alunos.turma_id` ou
`j12_turmas.aluno_ids_json`, o que misturaria o novo dominio `enrollments` com
o modelo legado de aluno e nao garantiria historico, auditoria, idempotencia e
unicidade do vinculo por matricula.

## Contrato Atualizado

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

O contrato agora declara:

```text
contractVersion=sprint-9.50
requiredEnrollmentStatus=ACTIVE
allowedClassStatuses=[ativa]
blockedBySchemaOrModuleGap=true
requiresMigration=true
requiresDedicatedLinkTable=true
linkCreated=false
persisted=false
financialSideEffects=false
```

## Validacoes Aplicadas

O contrato valida:

```text
enrollmentId obrigatorio
classId/turmaId obrigatorio
requestedBy obrigatorio
classId numerico compativel com j12_turmas.id
enrollmentStatus ACTIVE
classStatus ativa
```

Erros controlados adicionados:

```text
ENROLLMENT_CLASS_LINK_INVALID_ENROLLMENT_STATUS
ENROLLMENT_CLASS_LINK_INVALID_CLASS_STATUS
```

Assim, `DRAFT` e turma `inativa` nao entram no plano de vinculo.

## Migration Futura Necessaria

Nome conceitual sugerido:

```text
enrollment_class_links
```

Colunas sugeridas:

```text
id
enrollment_id
class_id
linked_at
linked_by
status
metadata_json
created_at
updated_at
```

Regras futuras recomendadas:

```text
FK enrollment_id -> enrollments.id
referencia logica class_id -> j12_turmas.id enquanto Turmas estiver no legado
unicidade para vinculo ativo por enrollment_id/class_id
historico com status ativo/inativo/cancelado
auditoria linked_by/linked_at
```

## Smoke Tests

Smoke test preparatorio validou:

```text
ENROLLMENT_CLASS_INTEGRATION_PREPARED=true
CLASS_MODULE_MAPPED=true
CLASS_LINK_CONTRACT_DOCUMENTED=true
CLASS_LINK_BLOCKED_BY_SCHEMA_OR_MODULE_GAP=true
NO_CLASS_LINK_CREATED=true
NO_FINANCIAL_SIDE_EFFECTS=true
OFFICIAL_FLOW_STILL_WORKING=true
NO_TEST_DATA_LEFT=true
```

## Validacoes

Validacoes executadas:

```text
node --check backend/src/domains/enrollments/application/contracts/enrollment-class-link.contract.js
node --check backend/src/domains/enrollments/application/facades/enrollment.facade.js
node --check backend/src/domains/enrollments/application/tests/enrollment.facade.test.js
node --test backend/src/domains/enrollments/application/tests/*.test.js
cmd /c npm run build
```

Resultado:

```text
node --check arquivos alterados: aprovado
Smoke test: aprovado
cmd /c npm run build: aprovado
```

## Riscos

- `j12_turmas` ainda pertence ao legado e nao possui repository/service de
  dominio isolado.
- `j12_alunos.turma_id` nao representa um vinculo seguro de `enrollments`.
- `j12_turmas.aluno_ids_json` nao oferece unicidade, historico ou auditoria
  confiavel para matriculas.
- Capacidade existe como campo, mas a ocupacao atual e derivada de alunos
  legados, nao de matriculas confirmadas.

## Proximos Passos

1. Criar migration dedicada `enrollment_class_links`.
2. Criar service/repository de Turmas ou adapter de leitura com contrato claro.
3. Implementar `linkActiveEnrollmentToClass()` com transacao e rollback nos
   testes.
4. Validar capacidade usando fonte unica de ocupacao.
5. Manter Financeiro fora desse fluxo.

## Fora Do Escopo

Nao foram alterados:

```text
frontend
API publica
financeiro
mensalidades
agenda
notificacoes
app
legado
regras financeiras
fluxo publico de criacao de aluno
schema
migrations
```
