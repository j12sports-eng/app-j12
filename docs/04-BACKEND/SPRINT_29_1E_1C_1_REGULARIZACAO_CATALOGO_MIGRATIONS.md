# Sprint 29.1E.1C.1 — Regularização do catálogo de migrations

## Escopo e conclusão

Auditoria local do catálogo canônico em 24/07/2026. Foram reconhecidas 27 migrations versionadas, sem arquivo temporário, ID ou timestamp duplicado. A migration de progresso digital foi registrada no grafo. Nenhum banco, VPS, ambiente de homologação ou produção foi acessado e nenhuma migration foi executada.

O teste anterior esperava 23 porque sua última atualização ocorreu no commit `35ddce9`, junto da migration de integridade da pré-matrícula. Depois entraram quatro migrations canônicas:

1. `20260720120000_create_enrollment_digital_invitations_table` (`9119a6d`);
2. `20260724120000_create_auth_identities_table` (`998e751`);
3. `20260724123000_create_user_unit_memberships_table` (`a225243`);
4. `20260724150000_create_digital_enrollment_progress` (`00cf546`).

O baseline não foi apenas alterado de 23 para 27. O teste passou a comparar o conjunto completo e a ordem topológica dos 27 IDs esperados. Inclusão, remoção ou reordenação acidental não passa por uma contagem coincidente.

## Convenções

- **Legada:** criada antes do runner canônico e preservada por compatibilidade.
- **Compatibilidade:** baseline/reconciliação que formaliza DDL runtime ou resolve topologia legada.
- **Moderna:** criada sob o catálogo canônico.
- Todas possuem os testes globais de catálogo e de contrato de nomes/timestamps; “teste” destaca contratos focados adicionais.
- “Dependentes” considera arestas diretas do grafo.

## Inventário canônico em ordem topológica

| # | Timestamp | Nome/arquivo | Dependências diretas | Dependentes diretos | Teste | Introdução | Tipo |
|---:|---|---|---|---|---|---|---|
| 1 | 20260712183000 | `create_people_domain_tables.sql` | — | enrollments; people identity; student conversion; pre-enrollment integrity; digital progress | global | `d7f173c` | compatibilidade |
| 2 | 20260629134546 | `create_enrollments_table.sql` | people domain | active draft; confirmation audit; class links 1030; obligations; agenda items; lead enrollment conversion; invitations | global | `8c15240` | legada |
| 3 | 20260629190607 | `add_active_draft_unique_constraint_to_enrollments.js` | enrollments | invitations | global | `8c15240` | legada |
| 4 | 20260629232350 | `add_enrollment_confirmation_audit_columns.js` | enrollments | — | global | `8c15240` | legada |
| 5 | 20260713100000 | `create_classes_foundation_table.js` | — | class links 1030; agenda items | global | `0eeeeab` | compatibilidade |
| 6 | 20260701103000 | `add_enrollment_class_links_table.js` | enrollments; classes foundation | reconcile indexes | rollback global | `8c15240` | legada |
| 7 | 20260713101500 | `reconcile_enrollment_class_links_indexes.js` | class links 1030 | class links 1200 | global | `0eeeeab` | compatibilidade |
| 8 | 20260701120000 | `add_enrollment_class_links_table.js` | reconcile indexes | — | rollback global | `8c15240` | compatibilidade |
| 9 | 20260702120000 | `create_enrollment_financial_obligations_table.js` | enrollments | financial bridges | financial/global | `8c15240` | legada |
| 10 | 20260702133000 | `create_enrollment_agenda_items_table.js` | enrollments; classes foundation | recurrence | global | `5a9444e` | legada |
| 11 | 20260703130000 | `create_agenda_recurrence_tables.js` | agenda items | notifications | global | `a73a8ae` | legada |
| 12 | 20260703143000 | `create_agenda_notification_tables.js` | recurrence | — | global | `df32e8a` | legada |
| 13 | 20260709220000 | `create_financial_automation_execution_history.js` | — | — | financial/global | `be4225f` | legada |
| 14 | 20260712184500 | `create_auth_runtime_tables.sql` | — | auth identities | global | `d7f173c` | compatibilidade |
| 15 | 20260715143000 | `create_enrollment_financial_bridges_table.js` | obligations | — | financial bridge | `9979938` | moderna |
| 16 | 20260715210000 | `add_p0_database_performance_indexes.js` | — | — | P0 performance | `9979938` | moderna |
| 17 | 20260715223000 | `add_p1_database_performance_indexes.js` | — | — | P1 performance | `9979938` | moderna |
| 18 | 20260717150000 | `create_crm_foundation_tables.js` | — | student conversion | global | `2af8429` | moderna |
| 19 | 20260717180000 | `create_crm_activities_table.js` | — | — | global | `12df2e2` | moderna |
| 20 | 20260717220000 | `add_people_normalized_identity_columns.js` | people domain | — | people identity | `e3388ef` | moderna |
| 21 | 20260718200000 | `create_crm_lead_student_conversions.js` | people domain; CRM foundation | lead enrollment conversion | global | `11f73df` | moderna |
| 22 | 20260718220000 | `create_crm_lead_enrollment_conversions.js` | enrollments; student conversion | — | global | `c33c5f4` | moderna |
| 23 | 20260719200000 | `add_pre_enrollment_integrity_constraints.js` | people domain | — | pre-enrollment integrity | `35ddce9` | moderna |
| 24 | 20260720120000 | `create_enrollment_digital_invitations_table.js` | enrollments; active draft | digital progress | invitation contract | `9119a6d` | moderna |
| 25 | 20260724120000 | `create_auth_identities_table.js` | auth runtime | memberships | AuthIdentity contract | `998e751` | moderna |
| 26 | 20260724123000 | `create_user_unit_memberships_table.js` | auth identities | — | membership contract | `a225243` | moderna |
| 27 | 20260724150000 | `create_digital_enrollment_progress.js` | people domain; invitations | — | progress contract | `00cf546` | moderna |

## Auditoria das quatro migrations adicionais

Os quatro arquivos existem, seguem `<timestamp>_<nome>.(js|sql)`, possuem timestamp e ID únicos e não são artefatos temporários. Os nomes/tabelas são coerentes: `enrollment_digital_invitations`, `auth_identities`, `user_unit_memberships` e `digital_enrollment_progress`.

As dependências declaradas existem e apontam apenas para estruturas anteriores na ordem topológica. O catálogo bloqueia dependências ausentes, declarações para IDs desconhecidos, ciclos, IDs e timestamps duplicados antes de qualquer execução. Cada migration adicional possui contrato focado.

`users` e `j12_usuarios` são estruturas runtime formalizadas por `20260712184500_create_auth_runtime_tables`. `j12_unidades`, exigida pela membership, é um baseline runtime externo ao catálogo versionado e deve ser comprovada no preflight futuro. `people`, `person_profiles` e `person_relationships` são formalizadas por `20260712183000_create_people_domain_tables`.

## Dependências do progresso digital

`20260724150000_create_digital_enrollment_progress` possui duas dependências diretas:

- `20260712183000_create_people_domain_tables`, que cria `people`, `person_profiles` e `person_relationships`;
- `20260720120000_create_enrollment_digital_invitations_table`, que cria os convites e depende transitivamente de `20260629134546_create_enrollments_table` e da restrição de draft ativo.

Não foi criada aresta artificial para `20260719200000_add_pre_enrollment_integrity_constraints`: ela endurece a pré-matrícula, mas não cria tabela ou chave estrangeira consumida pelo progresso digital.

## Riscos e bloqueios remanescentes

- O catálogo prova topologia de código; não prova estado de banco.
- As duas migrations históricas de class links seguem preservadas até o estado de HML ser conhecido.
- DDL MySQL pode realizar commit implícito; aplicação futura exige backup validado e restauração planejada.
- O progresso ainda exige preflight/dry-run em HML inequivocamente isolada, com secrets fora do Git.
- Antes da aplicação, o runner deve listar exatamente o plano revisado; qualquer outra pendência exige auditoria.

Esta sprint não executa preflight remoto, status de ledger, dry-run contra banco, backup ou migration.
