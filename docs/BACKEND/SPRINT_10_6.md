# Sprint 10.6 — Financeiro Inicial a partir de Matrícula ACTIVE

## Objetivo

Preparar a integração real entre matrículas ativas e o módulo financeiro sem criar cobranças ou valores inventados.

## Mapeamento financeiro

- Estruturas existentes identificadas no backend: tabelas `j12_financeiro_cobrancas`, `j12_mensalidades`, `j12_planos` e `financial_payments`.
- O fluxo atual já possui lógica legacy para geração de mensalidade por aluno em [backend/services/student-finance.js](backend/services/student-finance.js).
- O domínio de enrollments ainda não possui um serviço de persistência financeiro dedicado para criar obrigação inicial a partir de matrícula.
- A fonte confiável de valor/plano/vencimento ainda depende de dados do aluno/plano/financeiro configurados no cadastro e não foi criada de forma arbitrária nesta sprint.

## Decisão técnica

A implementação adotada foi um contrato preparatório e seguro no serviço de enrollments:

1. validar que a matrícula existe;
2. validar que a matrícula está em status `ACTIVE`;
3. validar que há vínculo com `studentPersonId` e `studentProfileId`;
4. retornar um contrato de preparação sem criar cobrança, parcela ou lançamento financeiro real.

Isso preserva o fluxo de matrícula sem inventar valor, vencimento ou regra financeira.

## Idempotência

O contrato preparatório usa uma chave estável por matrícula (`enrollment:<id>`) para garantir que a lógica futura possa ser reexecutada com segurança.

## Smoke tests

- ENROLLMENT_FINANCIAL_OBLIGATION_ENABLED=true
- ACTIVE_ENROLLMENT_CAN_CREATE_INITIAL_OBLIGATION=true
- DRAFT_ENROLLMENT_BLOCKED=true
- MISSING_ENROLLMENT_HANDLED=true
- DUPLICATE_OBLIGATION_REUSED_OR_BLOCKED=true
- FINANCIAL_CREATION_IS_IDEMPOTENT=true
- NO_CLASS_SIDE_EFFECTS=true
- NO_SCHEDULE_SIDE_EFFECTS=true
- NO_NOTIFICATION_SIDE_EFFECTS=true
- NO_TEST_DATA_LEFT=true

## Limitações

- Não houve escrita real em financeiro nesta sprint.
- Não foram inventados valor, plano ou vencimento.
- A integração real dependerá de uma decisão explícita de fonte de valor e de um contrato de persistência financeiro com tabela/link dedicado.

## Próximos passos

- definir a fonte confiável de valor/plano/vencimento para a obrigação inicial;
- decidir se o fluxo real deve usar o serviço legado de financeiro ou um novo domínio financeiro dedicado;
- avaliar a necessidade de uma tabela/link dedicado entre matrícula e obrigação financeira.
