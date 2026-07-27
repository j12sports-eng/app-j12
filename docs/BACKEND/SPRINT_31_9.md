# Sprint 31.9

Implementação da persistência MySQL da Revisão Administrativa da Matrícula Digital.

## Objetivo

Registrar a implementação da infraestrutura responsável por persistir:

- revisão administrativa;
- histórico imutável de decisões;
- idempotência durável;
- transaction runner MySQL;
- migration das três tabelas.

## Arquivos criados

- mysql-digital-enrollment-administrative-review.repository.js
- mysql-digital-enrollment-administrative-review.repository.test.js
- mysql-digital-enrollment-administrative-review.transaction-runner.js
- mysql-digital-enrollment-administrative-review.transaction-runner.test.js
- 20260727150000_create_digital_enrollment_administrative_review.js
- 20260727150000_create_digital_enrollment_administrative_review.test.js

## Arquivos alterados

- infrastructure/repositories/index.js

## Banco

A migration cria:

- digital_enrollment_administrative_reviews
- digital_enrollment_administrative_review_decisions
- digital_enrollment_administrative_review_commands

A migration ainda não foi executada.

## Testes

Repository ............. 31
Transaction Runner ..... 14
Migration .............. 17
Application ............ 90

Total:
152 testes
152 aprovados
0 falhas

## Fora do escopo

- execução da migration
- integração com controllers
- endpoints
- frontend
- ativação definitiva
- financeiro
- notificações
