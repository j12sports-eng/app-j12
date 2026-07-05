# Dominio Agenda

Fronteira backend para descoberta, validacao, recorrencia, reagendamento e
persistencia controlada de eventos planejados da Agenda.

## Objetivo

Centralizar compromissos, presencas, aulas, eventos, turmas, recorrencias e
futuras reservas sem acoplar consumidores externos a SQL, rotas legadas ou
repositories concretos.

## Estrutura

- `application/facades`: ponto de entrada interno via `AgendaFacade`.
- `application/services`: regras de aplicacao, conflitos, recorrencias e
  efeitos opcionais de notificacao.
- `application/repositories`: contrato esperado do repository.
- `infrastructure/repositories`: adapter MySQL.
- `presentation/controllers`: contrato HTTP administrativo.
- `presentation/routes`: rotas Express protegidas por `requireAuth` e
  `canManageSystem`.

## Persistencia

- `enrollment_agenda_items`: agenda planejada inicial de matriculas.
- `agenda_recurrence_series`: series recorrentes.
- `agenda_recurrence_exceptions`: exclusoes/edicoes de ocorrencias.
- `agenda_recurrence_history`: historico de alteracoes de recorrencia.

A criacao inicial continua idempotente por matricula, turma, recorrencia, dia e
horario. Recorrencias usam chaves estaveis de serie/ocorrencia e mantem
historico.

## Contratos de producao

- Rotas administrativas em `/admin/agenda` e `/api/admin/agenda`.
- Acesso somente para `admin` e `coordenador`.
- Validacao de conflitos centralizada em `AgendaConflictValidationService`.
- Reagendamento usa validacao antes de persistir.
- Notificacoes sao efeito colateral opcional: so sao enfileiradas quando a
  chamada informa destinatarios explicitos.
- Nenhum fluxo de Agenda cria financeiro ou presenca automaticamente.

## Frontend

- Tela administrativa em `/admin/agenda`.
- Rota carregada sob demanda via `React.lazy`.
- React Query preserva dados anteriores em refetch, evita refetch em foco de
  janela e usa `staleTime` para leituras administrativas.
- Calendario projeta recorrencias na janela visivel quando nao ha limite maximo
  de ocorrencias, evitando varreduras longas no navegador.

## Banco

O repositorio atual nao contem `schema.prisma` nem cliente Prisma. A camada de
producao da Agenda esta no adapter MySQL (`MySqlAgendaRepository`) e em
migrations manuais versionadas em `backend/src/database/migrations`.
