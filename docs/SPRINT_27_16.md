# Sprint 27.16 — Atividades e Interações Comerciais do CRM

## Auditoria e arquitetura

A fundação CRM e o pipeline canônico das Sprints 27.14 e 27.15 foram auditados e preservados sem alterações. Não existia aggregate, repository ou tabela de atividades. A implementação nova segue o fluxo `CrmActivityService -> CrmActivity -> MySqlCrmActivityRepository -> crm_activities` e permanece desacoplada de HTTP, frontend, BI e demais domínios.

`CrmActivity` é um Aggregate Root imutável. Cada registro pertence a um Lead e uma unidade. A descrição, o Lead, o tipo, o autor e a data de criação nunca são atualizados. A própria atividade constitui o histórico permanente; não há tabela adicional de histórico nem operação de exclusão.

## Modelo e regras

Campos persistidos: `id`, `leadId`, `unitId`, `activityType`, `status`, `subject`, `description`, `scheduledAt`, `completedAt`, `createdAt`, `createdBy` e `metadata`.

Tipos: `CALL`, `WHATSAPP`, `EMAIL`, `MEETING`, `VISIT`, `TASK`, `NOTE` e `SYSTEM`. Status: `PENDING`, `COMPLETED` e `CANCELLED`.

Somente `TASK` nasce e pode permanecer `PENDING`. Os demais tipos são criados como `COMPLETED`, com `completedAt` obrigatório. Apenas uma `TASK` pendente pode ser concluída ou cancelada. Subject, tipo, Lead, unidade e autor são obrigatórios.

Metadata é copiada por serialização JSON, rejeita referências circulares e possui limite de 4096 caracteres. Como a tabela é nova, a migration inclui `metadata TEXT`; não houve alteração de schema preexistente.

## Persistência, transação e concorrência

A migration idempotente cria `crm_activities` com `CREATE TABLE IF NOT EXISTS`, FK restritiva para `crm_leads` e somente os índices solicitados para Lead, unidade, status e agendamento. O `down` recusa remover uma tabela com dados.

`completeTask` e `cancelTask` executam em transação, bloqueiam a atividade por `SELECT ... FOR UPDATE` e atualizam somente quando `activity_type='TASK' AND status='PENDING'`. `affectedRows !== 1` gera conflito. Assim, uma conclusão concorrente não pode concluir novamente nem sobrescrever conteúdo. Erros propagam para rollback do transaction runner.

As consultas são parametrizadas. A listagem do Lead usa `created_at ASC, id ASC`; tarefas pendentes são ordenadas por agendamento, criação e ID.

## Limitações e próximos passos

Esta sprint apenas registra atividades. Não envia WhatsApp, e-mail ou notificações; não integra telefonia, calendários, webhooks ou automações. Também não cria API, frontend, dashboard, BI, anexos, comentários, checklist ou recorrência. Uma camada HTTP administrativa autenticada poderá ser considerada em sprint futura sem alterar o aggregate.

## Testes

Os testes cobrem CALL, EMAIL e TASK; status inicial; conclusão; cancelamento; concorrência; metadata inválida e serialização defensiva; Lead inexistente; subject e tipo inválidos; rollback; listagem por Lead; ordenação; queries parametrizadas e contrato da migration. A suíte CRM existente permanece como regressão integral.
