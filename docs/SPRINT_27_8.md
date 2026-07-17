# Sprint 27.8 — Auditoria do Preview de Agenda

## Status e objetivo

Sprint bloqueada com segurança. O objetivo era integrar um Preview de Agenda somente se houvesse uma fonte global, agregada, read-only e sem dados pessoais. Essa fonte não existe no estado atual do repositório.

## Estado inicial

- Branch `sprint-23` sincronizada com `origin/sprint-23`.
- Worktree inicialmente limpo.
- Typecheck e lint do Centro de Comando aprovados.
- Builds client e SSR aprovados.

## Auditoria

O frontend administrativo está em `src/features/agenda`, com API, tipos, hooks, calendário e página em `/admin/agenda`. O backend está em `backend/src/domains/agenda`, com router, controller, facade, services, repository MySQL e testes de leitura, recorrência, conflitos e reagendamento.

### Fontes existentes

Os GETs administrativos são:

- `/admin/agenda/students/:studentPersonId/:studentProfileId/summary`;
- `/admin/agenda/enrollments/:enrollmentId/summary`;
- `/admin/agenda/classes/:classId/schedules`;
- `/admin/agenda/recurrences/:seriesId`.

As três primeiras respostas são escopadas por aluno, matrícula ou turma. A última consulta uma série específica. Os summaries retornam contagens apenas daquele escopo e arrays detalhados de schedules. Não existe endpoint BI de Agenda, summary global, paginação com total global ou consulta agregada por período/unidade.

### Segurança e contrato

O router administrativo usa `requireAuth` e `canManageSystem`. O repository aplica vínculos ativos e consultas parametrizadas para os escopos individuais. Os contratos podem conter IDs de aluno, matrícula, professor, turma e quadra, nomes operacionais, observações, horários, recorrências e status detalhados.

`scheduleCount` e `classCount` não são totais do sistema; são derivados somente dos schedules retornados para um aluno ou outro escopo específico. O parâmetro `limit` restringe esses resultados.

## Decisão de bloqueio

Não é possível obter métricas globais sem enumerar alunos, matrículas, turmas ou séries e somar várias respostas. Isso criaria N+1, usaria respostas limitadas como totais, carregaria payload operacional e poderia expor dados pessoais. Portanto nenhum preview, provider, normalizador, rota ou registro foi criado.

## Indicadores indisponíveis

Não há fonte canônica para total de compromissos, aulas, eventos, reposições, cancelamentos, concluídos, próximos compromissos, distribuição por tipo/unidade, conflitos, indisponibilidades ou janelas livres.

## Componentes e estados

Os componentes compartilhados e estados do Centro de Comando não foram conectados porque não existe contrato real que possa alimentá-los. Criar uma interface vazia ou baseada em estimativas violaria a regra de não inventar KPIs.

## Performance e privacidade

Nenhuma listagem foi consumida, nenhum N+1 foi criado e nenhuma resposta parcial foi agregada no frontend. Nenhum dado pessoal ou operacional foi projetado. Nenhuma operação de criação, edição, exclusão, reagendamento, recorrência, presença ou financeiro foi chamada ou adicionada.

## Testes e validação

Não foram criados testes novos porque o bloqueio é comprovado pelos contratos, rotas e testes existentes do domínio. O baseline foi validado com typecheck, lint e builds client/SSR. Após a documentação, as validações do projeto e a suíte existente do Centro de Comando devem permanecer aprovadas.

## Próximo passo recomendado

Uma sprint backend separada deve definir e aprovar semanticamente as métricas globais de Agenda. A futura fonte deve:

- ser GET e explicitamente read-only;
- agregar no banco por período e unidade;
- retornar somente métricas e dimensões sem PII;
- aplicar autenticação, autorização e isolamento de tenant/unidade;
- tratar timezone e tipos canônicos de Agenda;
- evitar N+1 e respostas limitadas;
- possuir testes de contrato, segurança, performance e ausência de dados operacionais.

Somente depois dessa fonte existir o `AgendaCommandCenterPreview` deverá ser registrado.
