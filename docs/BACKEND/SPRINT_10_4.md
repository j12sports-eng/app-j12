# Sprint 10.4 - Vinculo real Matricula <-> Turma

## Objetivo

Implementar o vinculo real entre uma matricula `ACTIVE` e uma turma usando a tabela `enrollment_class_links` preparada na Sprint 10.3.

## Fluxo implementado

```text
EnrollmentFacade.linkActiveEnrollmentToClass()
        -> EnrollmentClassLinkService.linkActiveEnrollmentToClass()
        -> EnrollmentRepository / ClassLinkRepository
        -> enrollment_class_links
```

Controllers, rotas e API publica nao foram alterados. O metodo continua exposto pela facade interna do dominio de Matriculas.

## Validacoes aplicadas

- `enrollmentId`, `classId` e `linkedBy` obrigatorios.
- Matricula precisa existir.
- Matricula precisa estar em status `ACTIVE`.
- Turma precisa existir por meio de `classReader` injetado.
- Turma precisa estar ativa quando o leitor de Turmas expuser status.
- Capacidade e vagas sao validadas quando `capacidade` estiver disponivel.
- Vinculo ativo duplicado para o mesmo `enrollmentId + classId` e reutilizado quando encontrado.
- Erro de unique constraint do banco e tratado no repositorio MySQL com reuso do vinculo existente.

## Estrategia transacional

O service aceita `transactionRunner` para execucao em contexto transacional injetado. Quando usado com repositorios MySQL, o mesmo `queryRunner` transacional pode ser fornecido para:

- leitura da matricula;
- leitura do vinculo existente;
- contagem de vinculos ativos por turma;
- criacao de `enrollment_class_links`.

O smoke test validou escrita real em transacao manual e rollback ao final.

## Idempotencia

A idempotencia foi tratada em duas camadas:

- antes da escrita, o service consulta `findActiveByEnrollmentAndClass`;
- durante a escrita, `MySqlEnrollmentClassLinkRepository.createActiveLinkIfNotExists()` captura duplicidade da unique `ux_enrollment_class_links_active` e retorna o vinculo existente.

Chamadas repetidas para o mesmo par `enrollmentId + classId` retornam o mesmo vinculo ativo ou sao bloqueadas de forma controlada.

## Infraestrutura

O repositorio MySQL de vinculo recebeu:

- alias `createOrReuseActiveLink()` para compatibilidade com chamadas internas anteriores;
- `getClassCapacitySnapshot()` para contar vinculos ativos em `enrollment_class_links` sem ler ou alterar `j12_turmas`;
- contrato atualizado em `application/repositories/enrollment-class-link.repository.js`.

## Smoke test transacional

Foi executado um script temporario local com rollback, removido apos a validacao.

Resultado:

```text
ACTIVE_ENROLLMENT_CLASS_LINK_ENABLED=true
ACTIVE_ENROLLMENT_LINK_CREATED=true
DUPLICATE_LINK_REUSED_OR_BLOCKED=true
DRAFT_ENROLLMENT_LINK_BLOCKED=true
MISSING_ENROLLMENT_HANDLED=true
MISSING_CLASS_HANDLED=true
CLASS_CAPACITY_VALIDATED_IF_AVAILABLE=true
OFFICIAL_FLOW_STILL_WORKING=true
NO_FINANCIAL_SIDE_EFFECTS=true
NO_SCHEDULE_SIDE_EFFECTS=true
NO_NOTIFICATION_SIDE_EFFECTS=true
NO_TEST_DATA_LEFT=true
```

## Validacoes executadas

```bash
node --check backend/src/domains/enrollments/application/services/enrollment-class-link.service.js
node --check backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment-class-link.repository.js
node --check backend/src/domains/enrollments/application/repositories/enrollment-class-link.repository.js
node --check backend/src/domains/enrollments/application/tests/enrollment-class-link.service.test.js
node --check backend/src/domains/enrollments/application/tests/enrollment-class-link.repository.test.js
node --check backend/src/domains/enrollments/application/tests/enrollment.facade.test.js
node --check backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment-class-link.repository.test.js
node --test backend/src/domains/enrollments/application/tests/*.test.js
node --test backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment-class-link.repository.test.js
cmd /c npm run build
```

Todos aprovados.

## Limites

- O dominio de Matriculas nao le SQL de Turmas diretamente no service; a validacao da turma depende de `classReader` injetado.
- O repositorio de vinculo acessa apenas `enrollment_class_links`.
- Nao foi criada rota, controller, API publica ou fluxo de UI para acionar o vinculo.
- Nao houve escrita em financeiro, agenda, notificacoes ou tabelas legadas de aluno.

## Proximos passos

- Sprint 10.5 deve aprofundar capacidade/vagas com contrato mais explicito do modulo de Turmas.
- Sprint 10.6 deve tratar financeiro inicial sem inventar valores ou criar cobrancas fora do contrato aprovado.
