# Sprint 11.4 - Integracao Matriculas com ClassFacade

## Objetivo

Integrar o fluxo interno de vinculo `Enrollment ACTIVE -> Turma` com a
`ClassFacade`, usando a fronteira oficial criada para o dominio de Turmas.

A sprint substitui a validacao preparatoria baseada em `classReader` generico
por um caminho oficial via facade. O fallback antigo permanece apenas para
compatibilidade de testes e chamadas internas ainda nao migradas.

## Fluxo

```text
EnrollmentFacade
  -> EnrollmentClassLinkService
  -> ClassFacade
  -> ClassApplicationService
  -> MySqlClassRepository
```

Matriculas nao importa nem instancia repository de Turmas. A dependencia
esperada e `classFacade`, injetada por composicao.

## Como Matriculas usa ClassFacade

O service de vinculo chama:

```js
ClassFacade.findActiveClassById({ classId })
ClassFacade.ensureClassHasAvailableCapacity({ classId })
```

Responsabilidades mantidas em Matriculas:

- validar entrada obrigatoria;
- buscar a matricula por `enrollmentReader`;
- bloquear matricula inexistente;
- bloquear matricula diferente de `ACTIVE`;
- verificar/reutilizar vinculo ativo em `enrollment_class_links`;
- persistir apenas `enrollment_class_links`, quando o repository de vinculo for
  injetado.

Responsabilidades de Turmas:

- validar se a turma existe;
- validar se a turma esta ativa;
- validar capacidade/vagas;
- expor resumo oficial de capacidade.

## Validacoes reais aplicadas

```text
matricula inexistente -> ENROLLMENT_CLASS_LINK_ENROLLMENT_NOT_FOUND
matricula DRAFT -> ENROLLMENT_CLASS_LINK_INVALID_ENROLLMENT_STATUS
matricula ACTIVE -> permitida
turma inexistente -> ENROLLMENT_CLASS_LINK_CLASS_NOT_FOUND
turma inativa -> ENROLLMENT_CLASS_LINK_INVALID_CLASS_STATUS
turma cheia -> ENROLLMENT_CLASS_LINK_CLASS_FULL
capacidade sem configuracao -> ENROLLMENT_CLASS_LINK_CLASS_CAPACITY_UNCONFIGURED
vinculo duplicado em preparacao -> ENROLLMENT_CLASS_LINK_DUPLICATE
vinculo duplicado em persistencia -> reuso do vinculo ativo existente
```

## Vinculo real

O vinculo real esta habilitado quando estas dependencias sao injetadas:

```text
classFacade
classLinkRepository
enrollmentReader
```

Nesse caminho, `linkActiveEnrollmentToClass()` valida a turma pela
`ClassFacade`, verifica se ja existe vinculo ativo e cria ou reutiliza o registro
em `enrollment_class_links`.

`prepareActiveEnrollmentClassLink()` continua sem escrita por contrato. Ela
valida a matricula e, quando `classFacade` estiver disponivel, valida a turma e a
capacidade reais antes de retornar o plano preparado.

## Limitacoes

- Nenhuma rota publica foi alterada.
- Nenhum frontend foi alterado.
- Nenhum schema ou migration foi criado nesta sprint.
- O service de Matriculas ainda aceita `classReader` como fallback legado, mas o
  caminho oficial novo e `classFacade`.
- A regra de capacidade usada pelo caminho oficial e a regra da `ClassFacade`.
  Matriculas nao recalcula capacidade nesse caminho.

## Smoke test

Marcadores do caminho real habilitado por facade:

```text
ENROLLMENT_CLASS_FACADE_INTEGRATION_ENABLED=true
ENROLLMENT_USES_CLASS_FACADE=true
ACTIVE_CLASS_VALIDATED=true
CLASS_CAPACITY_VALIDATED=true
DRAFT_ENROLLMENT_BLOCKED=true
MISSING_CLASS_BLOCKED=true
FULL_CLASS_BLOCKED_IF_AVAILABLE=true
NO_CLASS_REPOSITORY_ACCESSED_DIRECTLY=true
NO_FINANCIAL_SIDE_EFFECTS=true
NO_SCHEDULE_SIDE_EFFECTS=true
NO_NOTIFICATION_SIDE_EFFECTS=true
OFFICIAL_FLOW_STILL_WORKING=true
NO_TEST_DATA_LEFT=true
```

## Validacoes executadas

```bash
node --check backend/src/domains/enrollments/application/services/enrollment-class-link.service.js
node --check backend/src/domains/enrollments/application/facades/enrollment.facade.js
node --check backend/src/domains/enrollments/application/tests/enrollment-class-link.service.test.js
node --check backend/src/domains/enrollments/application/tests/enrollment.facade.test.js
node --test backend/src/domains/enrollments/application/tests/enrollment-class-link.service.test.js
node --test backend/src/domains/enrollments/application/tests/enrollment.facade.test.js
node --test backend/src/domains/classes/application/tests/class.facade.test.js backend/src/domains/classes/application/tests/class-application.service.test.js
cmd /c npm run build
```

## Proximos passos

- Injetar `ClassFacade` na composicao runtime que acionar o vinculo real.
- Manter `classReader` apenas enquanto houver chamadas internas antigas.
- Avaliar, em sprint futura, se a ocupacao oficial de Turmas deve considerar
  tambem `enrollment_class_links` ou apenas os vinculos atuais de `j12_alunos`.
