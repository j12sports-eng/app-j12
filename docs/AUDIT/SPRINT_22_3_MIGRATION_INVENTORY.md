# Sprint 22.3 - Inventario de migrations

Data: 2026-07-11. Base: branch `sprint-22`, commit `c2f6b6b`. Auditoria local e estatica; nenhum banco foi alterado.

## Escala de evidencia

1. Existe no repositorio; 2. possui teste estrutural; 3. executada em ambiente isolado; 4. executada em homologacao; 5. executada em producao. Somente 1 e 2 foram verificadas nesta Sprint. Documentacao historica de smoke nao foi promovida a evidencia atual de 3, 4 ou 5.

| Migration                                                             | Objetos                                               | E1  | E2      | E3             | E4             | E5             | Observacao                                                                   |
| --------------------------------------------------------------------- | ----------------------------------------------------- | --- | ------- | -------------- | -------------- | -------------- | ---------------------------------------------------------------------------- |
| `20260629134546_create_enrollments_table.sql`                         | `enrollments`, 2 FKs, 5 indices                       | sim | parcial | nao comprovado | nao comprovado | nao comprovado | `DOWN` usa drop sem guarda; executar somente com plano aprovado.             |
| `20260629190607_add_active_draft_unique_constraint_to_enrollments.js` | 2 colunas geradas, unique de draft ativo              | sim | sim     | nao comprovado | nao comprovado | nao comprovado | preflight bloqueia duplicatas.                                               |
| `20260629232350_add_enrollment_confirmation_audit_columns.js`         | `confirmed_at/by`                                     | sim | sim     | nao comprovado | nao comprovado | nao comprovado | idempotente por introspeccao.                                                |
| `20260701103000_add_enrollment_class_links_table.js`                  | link matricula-turma, FKs, indices, extensoes         | sim | sim     | nao comprovado | nao comprovado | nao comprovado | variante canonica mais defensiva.                                            |
| `20260701120000_add_enrollment_class_links_table.js`                  | mesmo link, contrato menor                            | sim | sim     | nao comprovado | nao comprovado | nao comprovado | duplicata historica; rollback agora bloqueia tabela populada.                |
| `20260702120000_create_enrollment_financial_obligations_table.js`     | obrigacoes, DECIMAL(12,2), unique e FK                | sim | sim     | nao comprovado | nao comprovado | nao comprovado | unique `(enrollment_id, obligation_type)` e guarda no down.                  |
| `20260702133000_create_enrollment_agenda_items_table.js`              | agenda da matricula                                   | sim | parcial | nao comprovado | nao comprovado | nao comprovado | requer validacao isolada.                                                    |
| `20260703130000_create_agenda_recurrence_tables.js`                   | series, excecoes e historico                          | sim | parcial | nao comprovado | nao comprovado | nao comprovado | multiplas tabelas/FKs.                                                       |
| `20260703143000_create_agenda_notification_tables.js`                 | eventos, fila, notificacoes, preferencias e auditoria | sim | parcial | nao comprovado | nao comprovado | nao comprovado | idempotency keys e FKs presentes.                                            |
| `20260709220000_create_financial_automation_execution_history.js`     | historico append-only e 6 indices                     | sim | sim     | nao comprovado | nao comprovado | nao comprovado | sem unique de `execution_id`; repeticao e permitida por tentativa/historico. |

## Fontes de schema fora do runner

Nao ha runner automatico nem tabela versionada de migrations. `backend/src/config/db.js` cria e altera dezenas de tabelas no bootstrap; repositories de pessoas, pagamentos, automacoes e campeonatos tambem criam schema; quadras o faz em service; `backend/sql/schema.sql` cobre apenas `alunos` e `financeiro`. Esses objetos nao podem ser classificados como migrations aplicadas.

## Ordem segura proposta

Inventariar `information_schema` de um clone sanitizado; registrar checksums; escolher uma unica migration de class links conforme o estado encontrado; executar `status`; fazer backup/restore ensaiado; executar `up` e repeticao de `up`; validar constraints; ensaiar `down` somente em clone vazio. Homologacao e producao continuam pendentes de autorizacao externa.
