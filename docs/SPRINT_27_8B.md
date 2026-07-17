# Sprint 27.8B — Fonte BI Agregada e Read-Only de Agenda

## Objetivo e origem

A Sprint 27.8 bloqueou com segurança o Preview de Agenda porque os endpoints operacionais
existentes são escopados a aluno, matrícula, turma ou série. A Sprint 27.8B cria a fonte
global necessária sem enumerar entidades, sem N+1 e sem expor linhas operacionais.

O endpoint criado é `GET /admin/bi/agenda` (também disponível sob o prefixo compatível
`/api/admin/bi/agenda`). Não foi criado endpoint de escrita nem realizada alteração de
frontend, schema, migration, índice ou regra operacional.

## Auditoria do domínio

### Arquitetura encontrada

O domínio operacional está em `backend/src/domains/agenda` e separa facade, services,
validators, DTOs, controller, routes e `MySqlAgendaRepository`. O domínio BI segue a
sequência controller → service → repository analítico → banco e publica contratos
versionados.

Os endpoints operacionais preservados são:

- `GET /admin/agenda/students/:studentPersonId/:studentProfileId/summary`;
- `GET /admin/agenda/enrollments/:enrollmentId/summary`;
- `GET /admin/agenda/classes/:classId/schedules`;
- `GET /admin/agenda/recurrences/:seriesId`.

### Schema real

- `enrollment_agenda_items`: regra semanal inicial com `day_of_week`,
  `start_time`, `end_time`, `recurrence_type`, `timezone`, `status` e
  `source`. Não possui data de ocorrência.
- `agenda_recurrence_series`: série com `start_date`, `end_date`,
  `frequency`, `interval_value`, `interval_unit`, dias, horários, timezone,
  `class_id`, status e dados de cancelamento.
- `agenda_recurrence_exceptions`: exceção por `series_id`,
  `occurrence_date`, `occurrence_start_time` e `exception_type`.
- `agenda_recurrence_history`: trilha de auditoria operacional. Não é consultada
  pela fonte BI.
- `j12_turmas`: fornece `unidade_id` por meio de `class_id`.

Não há campo de tenant/organização no modelo de Agenda. Não há soft-delete nas tabelas de
séries e exceções. O soft-delete de matrícula não é usado porque as métricas não agregam
matrículas.

### Statuses, tipos e semântica

- série: `ACTIVE` e `CANCELLED`;
- exceção: `CANCELLED` e `MODIFIED`;
- timezone default e canônico: `America/Sao_Paulo`;
- recorrência: frequência, intervalo, unidade do intervalo e dias são persistidos.

Não foi encontrado status canônico de conclusão, tipo de reposição, tipo de evento
externo ou entidade persistida de conflito. Cancelar uma série preenche status
`CANCELLED` e `cancelled_at`; cancelar/modificar uma ocorrência cria uma exceção
datada.

## Contrato 21.12

O payload contém:

- `contractVersion: "21.12"`;
- `readOnly: true`;
- `generatedAt`;
- `filters.current`, incluindo período inclusivo, timezone e unidade;
- KPIs agregados;
- distribuição agregada de tipos de exceção;
- evolução diária agregada;
- metadata, warnings e source técnico;
- nenhuma linha operacional.

### KPIs disponíveis

- séries recorrentes com intervalo efetivo sobreposto ao período;
- séries ativas sobrepostas ao período;
- séries canceladas no período por `cancelled_at`;
- ocorrências canceladas no período;
- ocorrências modificadas no período;
- taxa de cancelamento entre exceções datadas.

### KPIs indisponíveis

São retornados com `available: false`, `value: null` e motivo explícito:

- total de compromissos;
- compromissos concluídos;
- compromissos futuros;
- reposições;
- conflitos;
- duração total agendada.

As séries representam regras e as ocorrências não são materializadas integralmente. A
fonte não converte templates em eventos nem inventa semântica operacional.

## Filtros e isolamento

São reutilizados `normalizeBiQuery` e `resolveBiPeriod`:

- `period`;
- `startDate` e `endDate` para `CUSTOM`;
- `unitId`.

Datas, ordem do intervalo e identificadores inválidos são rejeitados pelos validadores
canônicos. A arquitetura atual não define limite máximo adicional de período e esta
sprint não inventa um.

O router BI exige `requireAuth` e `canManageSystem`. Essa permissão possui escopo
sistêmico e, portanto, autoriza todas as unidades existentes; `unitId` é um filtro de
restrição, aplicado no SQL por `j12_turmas.unidade_id`. Não existe escopo de tenant ou
lista de unidades por usuário no modelo atual.

## SQL, segurança e performance

O repository executa exatamente duas consultas em paralelo:

1. agregação das séries por sobreposição, status e data de cancelamento;
2. agregação diária das exceções no período.

As consultas:

- são parametrizadas;
- contêm apenas `SELECT`;
- têm quantidade fixa;
- agregam no MySQL;
- não usam `SELECT *`;
- não carregam a tabela em memória;
- não executam loops nem N+1;
- não selecionam nomes, observações, descrições, telefone, e-mail, CPF, endereço ou
  payload operacional.

Existem índices em status e `class_id` das séries e em `series_id` das exceções.
`start_date`, `end_date`, `cancelled_at` e `occurrence_date` não possuem índices
dedicados. Em volume alto, as consultas podem realizar varreduras. Nenhuma migration foi
criada; recomenda-se uma Sprint 27.8B1 para medir com `EXPLAIN` no ambiente real e
propor índices mediante autorização explícita.

## Testes

Foram adicionados testes para:

- versão, read-only, filtros, timezone, KPIs, metadata e warnings;
- ausência de PII e linhas operacionais;
- valores vazios, nulos, `NaN` e `Infinity`;
- período default/customizado e filtro inválido;
- duas queries fixas, paralelas, agregadas e parametrizadas;
- filtro de unidade e período no SQL;
- ausência de comandos de escrita e `SELECT *`;
- sucesso, erro controlado e encaminhamento seguro no controller;
- autenticação, autorização e método GET pelo teste do router;
- regressão das operações de Agenda existentes.

## Limitações e próximo passo

A fonte mede séries e exceções persistidas; não é um calendário expandido. Séries sem
`class_id` aparecem no agregado global, mas não pertencem a uma unidade e são
naturalmente excluídas quando `unitId` é informado. A ausência de índices de data é o
principal risco residual.

A Sprint 27.8C poderá consumir este contrato no Preview Read-Only de Agenda sem acessar
endpoints operacionais ou introduzir agregação no frontend.
