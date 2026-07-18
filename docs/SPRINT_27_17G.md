# Sprint 27.17G — Observabilidade e Auditoria Operacional da Conversão

## Estado e arquitetura

A Sprint 27.17F permanece intacta. A rota continua `POST /internal/crm/leads/:leadId/draft-enrollment` (e o alias `/api`) com o mesmo payload, resposta e códigos de erro.

A solução escolhida foi um decorator de aplicação injetado na composition root do router CRM:

`controller → CrmLeadEnrollmentConversionObservabilityDecorator → CrmLeadEnrollmentConversionService`

O controller, o caso de uso, o resolvedor de unidade, os repositórios e as rotas funcionais não recebem lógica de auditoria. A instrumentação é exclusivamente aditiva e preserva o erro original por `throw` após registrar a falha.

## Eventos e campos

São emitidos três eventos estruturados pelo logger oficial:

- `CRM_LEAD_ENROLLMENT_CONVERSION_STARTED`;
- `CRM_LEAD_ENROLLMENT_CONVERSION_SUCCEEDED`;
- `CRM_LEAD_ENROLLMENT_CONVERSION_FAILED`.

A fonte é `INTERNAL_CRM`, com `operationName`, rota, versão do evento e `correlationId`. Os campos operacionais permitidos são: `leadId`, `unitId`, `userId`, `personId`, `personProfileId`, `enrollmentId`, `enrollmentStatus`, `personResolution`, `profileResolution`, `enrollmentResolution`, flags `*Reused`, `durationMs`, `errorCode`, `errorCategory`, `createdAt` e fingerprint irreversível de idempotência.

O fingerprint é SHA-256 de Lead + chave; a chave em claro nunca é registrada. IDs são limitados em tamanho, resoluções aceitam somente `CREATED`/`FOUND`, e o status de matrícula aceito é `DRAFT`.

Nunca são registrados CPF, nome, e-mail, telefone, nascimento, sexo, body, headers completos, token, SQL, stack, host, usuário do banco, mensagem original ou metadata arbitrária.

## Correlação e duração

O decorator usa `context.correlationId`, normalmente preenchido por `createRequestObservabilityMiddleware` e preservado pelo controller. Não cria um formato paralelo.

A duração usa `process.hrtime.bigint()`, é convertida para milissegundos inteiros e nunca fica negativa. Eventos de sucesso e falha carregam a duração da mesma tentativa.

## Métricas

`CrmLeadEnrollmentConversionMetrics` é um collector process-local, bounded e injetável. Não há endpoint, Prometheus novo, Grafana ou dashboard nesta Sprint. As séries são limitadas a 32 e usam somente labels de baixa cardinalidade:

- `source`;
- `result`;
- `errorCode` categorizado;
- `enrollmentResolution`.

Métricas:

- `crm_lead_enrollment_conversion_attempts_total`;
- `crm_lead_enrollment_conversion_success_total`;
- `crm_lead_enrollment_conversion_failure_total`;
- `crm_lead_enrollment_conversion_duration_ms`;
- `crm_lead_enrollment_conversion_reused_total`.

Nenhum ID é usado como label. O collector pode ser substituído futuramente por adapter oficial sem alterar o decorator.

## Falha da auditoria

A conversão principal é prioritária. Falha do adapter de auditoria, logger secundário ou collector é absorvida e gera somente um aviso sanitizado (`CRM_AUDIT_ADAPTER_FAILED`); ela não altera resposta, status, código, `expose`, idempotência ou efeitos da conversão.

A implementação usa log estruturado como persistência operacional, aproveitando stdout/PM2 e a política de retenção externa existente. Não foi criada tabela CRM duplicada, repository MySQL ou migration. A Sprint 27.17H poderá consumir esses eventos por adapter/persistência futura, sem endpoint histórico nesta Sprint.

## Compatibilidade e segurança

O resultado original da conversão continua sendo retornado integralmente. Em sucesso, a auditoria registra `DRAFT`, IDs internos, resoluções e flags de reuso somente depois do resultado existir. Em falha, registra apenas IDs de contexto e código/categoria sanitizados.

Não houve alteração de frontend. A tela da Sprint 27.17F continua usando o mesmo contrato e não recebe payload técnico de auditoria.

As Sprints `27.17A.4.1C.1`, `27.17A.4.1E` e `27.17A.4.2` permanecem suspensas. Não houve execução de MySQL externo, retomada de diagnóstico físico, índice UNIQUE, mudança funcional, matrícula ACTIVE, financeiro, turma, contrato ou notificação.

## Testes e limitações

Os testes isolados cobrem allowlist, limites, hash, ausência de PII, eventos, métricas, duration monotônica, correlação, IDs internos somente após sucesso, erro original, status/código preservados e fail-open. Os testes usam adapters e serviços fake por DI, sem banco externo.

Limitações: o collector padrão é process-local e o histórico persistente depende de futura decisão de retenção/adapter; ainda não existe endpoint ou tela de histórico. O logger estruturado continua sujeito à política de retenção do ambiente operacional.

Próximo passo: Sprint 27.17H — Histórico Visual de Conversões no CRM.
