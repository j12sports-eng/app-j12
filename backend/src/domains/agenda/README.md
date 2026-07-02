# Dominio Agenda

Fronteira backend para descoberta de horarios derivados de Turmas e criacao
controlada da agenda planejada inicial de uma Matricula `ACTIVE`.

## Objetivo

Centralizar compromissos, presencas, aulas, eventos, turmas e futuras reservas
sem acoplar consumidores externos a SQL, rotas legadas ou repositories
concretos.

## Estrutura atual

- `application/facades`: ponto de entrada interno via `AgendaFacade`.
- `application/services`: regras de aplicacao da Agenda.
- `application/repositories`: contrato esperado do repository.
- `infrastructure/repositories`: adapter MySQL.

## Estado atual

A Agenda possui camada application/infrastructure e a tabela
`enrollment_agenda_items` para agenda planejada inicial de Matriculas. A criacao
e idempotente por matricula, turma, recorrencia semanal, dia e horario.

Presencas, reposicoes, cancelamentos, notificacoes, financeiro, controllers e
rotas publicas permanecem fora deste dominio nesta etapa.
