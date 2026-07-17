# Sprint 27.6 — Auditoria do Preview de Professores

## Status

Bloqueada com segurança. Não existe no repositório uma fonte agregada, read-only e sem dados pessoais capaz de sustentar o Preview de Professores.

## Estado inicial

- Branch `sprint-23`, sincronizada com `origin/sprint-23`.
- Worktree inicialmente limpo.
- Typecheck aprovado.
- Lint do Centro de Comando aprovado.
- Build client e SSR aprovados.

## Auditoria

O domínio `backend/src/domains/professores` ainda é apenas uma estrutura reservada; o fluxo real permanece legado em `backend/src/routes/professores.routes.js`, `src/lib/professores-store.ts` e `src/routes/professores.tsx`.

### Listagem de professores

`GET /professores` exige `requireAuth` e `canManageSystem`, mas retorna a listagem completa de `j12_professores`. O payload inclui nome, e-mail, telefone, CPF, CREF, modalidades, unidades, turmas e dados contratuais/financeiros. Não possui resumo agregado ou filtro de unidade/tenant para essa leitura. Essa fonte foi rejeitada porque carregaria todos os professores e dados pessoais no frontend.

### BI de Turmas

`GET /admin/bi/classes` é read-only, protegido pelo mesmo padrão administrativo e suporta filtro de unidade. Seu contrato `21.5`, porém, fornece KPIs de turmas e uma tabela detalhada contendo `professorName`; não fornece identificadores nem métricas canônicas agregadas de professores.

Contar nomes no frontend foi rejeitado porque exporia dados pessoais, trataria homônimos como uma única pessoa, poderia contar nomes legados sem vínculo canônico e transformaria uma tabela de turmas em um total de professores não garantido pelo contrato.

### Infraestrutura do Centro de Comando

Existem contrato, adapter, provider e hook abstratos para Teachers em `src/features/command-center`. Eles são usados apenas pelos providers de desenvolvimento e não possuem API real associada. Os KPIs abstratos não comprovam disponibilidade de dados e, portanto, não foram apresentados como indicadores reais.

## Indicadores indisponíveis

Não há fonte segura para total de professores, ativos, inativos, novos no período, professores por modalidade/unidade, vinculados a turmas ou sem turma. Também não há fonte real para `activeProfessors`, `allocatedProfessors`, `allocatedHours`, `classesWithoutProfessor`, `pendingContracts` ou `scheduleConflicts`.

## Segurança e performance

Nenhuma listagem completa foi consumida, nenhum dado pessoal foi projetado e nenhuma inferência foi calculada a partir de tabela detalhada. Não foram criados endpoint, repository, migration, schema, DTO, contrato, status, KPI ou operação de escrita. Nenhum preview existente foi alterado.

## Limitação e próximo passo

Uma sprint backend separada deve primeiro auditar e aprovar semanticamente quais métricas de professores são canônicas. Somente depois poderá ser criada, com autorização explícita, uma fonte BI read-only que agregue no banco, omita PII, aplique autenticação/autorização e isolamento de unidade/tenant, e tenha testes de ausência de N+1.

Após essa fonte existir, o frontend poderá conectar `TeachersCommandCenterPreview` ao hook/provider já preparados, reutilizando os componentes, query options e registry atuais.

## Validação

Como não houve implementação de código, não foram criados testes novos. O baseline existente foi validado com typecheck, lint do Centro de Comando e builds client/SSR antes da auditoria.
