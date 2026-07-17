# Sprint 27.13B — Fonte BI Agregada de CRM

## Resultado

A sprint terminou em bloqueio seguro. O baseline no commit df2ef94 estava limpo, sincronizado e aprovado em typecheck e build client/SSR.

## Auditoria

Não existe domínio CRM em backend/src, endpoint BI, DTO, service, controller, repository, migration, tabela MySQL ou testes CRM. O commit df2ef94 contém somente a documentação do bloqueio da Sprint 27.13, apesar da mensagem de commit indicar integração.

O modelo real mais próximo é a coleção operacional trial-classes. Ela define aulas experimentais, origens de lead e os status Agendada, Confirmada, Compareceu, Não compareceu, Reagendada, Convertida e Cancelada. Não define Oportunidades, pipeline analítico, estágios comerciais versionados ou responsáveis comerciais canônicos.

Essa coleção contém nomes, nascimento, responsável, telefone, WhatsApp, e-mail, professor, observações, histórico e identificadores. Ela é inadequada como fonte BI global e não possui tabela MySQL canônica para consultas agregadas no padrão MySqlBiRepository.

## Decisão

Não foi criado GET /admin/bi/crm. Implementá-lo exigiria inventar tabela/schema, consultar uma coleção operacional ou criar arquitetura paralela. Nenhum KPI, dimensão ou taxa de conversão foi inferido.

Nenhum backend funcional, frontend, Centro de Comando, routeTree, migration ou regra CRM foi alterado.

## Próximo passo

Uma sprint de persistência deve definir uma tabela CRM canônica ou uma projeção analítica segura, incluindo lifecycle, datas de transição, unidade/tenant e índices. Depois disso, uma sprint BI poderá criar consultas COUNT/SUM/GROUP BY parametrizadas, contrato versionado read-only, autenticação/autorização, KPIs comprovados e testes sem PII ou linhas operacionais.
