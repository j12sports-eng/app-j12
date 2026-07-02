# Sprint 9.41 - Pessoas Integrado a EnrollmentFacade

## Objetivo

Substituir o uso direto dos services do dominio de matriculas dentro do modulo
de Pessoas pela `EnrollmentFacade`, mantendo o comportamento funcional atual.

## Arquivos

```text
backend/src/domains/pessoas/application/services/enrollment-application.service.js
docs/BACKEND/SPRINT_9_41.md
```

## Dependencia Direta Encontrada

O service de Pessoas importava diretamente:

```text
EnrollmentApplicationService do dominio enrollments
```

Essa dependencia era usada para:

```text
criar draft Enrollment em memoria
criar ou reutilizar draft persistido
localizar draft persistido atual
executar fallback de leitura + criacao
```

## Alteracao

O service de Pessoas agora importa e utiliza:

```text
EnrollmentFacade
```

As chamadas foram redirecionadas para a fachada:

```text
createDraftEnrollment()
createDraftEnrollmentIdempotently()
findCurrentDraftEnrollment()
findDraftEnrollment()
createDraftEnrollmentAndPersist()
```

## Compatibilidade

O fluxo atual foi preservado:

```text
1. tenta createDraftEnrollmentIdempotently() quando disponivel;
2. se necessario, mantem fallback por leitura de draft atual;
3. se nao houver draft persistido, cria via createDraftEnrollmentAndPersist();
4. em erro de persistencia, continua com draft em memoria e warning.
```

## Decisao Arquitetural

Pessoas passa a depender da `EnrollmentFacade` para operacoes do dominio de
matriculas. A composicao do repository concreto continua restrita ao ponto de
wiring existente no service de Pessoas, apenas para fornecer dependencia para a
fachada quando a persistencia esta habilitada.

A regra de negocio permanece nos services do dominio `enrollments`; Pessoas nao
duplicou regras de status, guard, resumo consolidado ou confirmacao.

## Smoke Test

Smoke test valida:

```text
PESSOAS_USING_ENROLLMENT_FACADE=true
DIRECT_SERVICE_DEPENDENCIES_REMOVED=true
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
schema
migrations
financeiro
mensalidades
turmas
legado
```
