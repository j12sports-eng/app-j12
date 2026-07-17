# Sprint 27.14 — Fundação Canônica do CRM

## Resultado

Foi criada a fundação backend mínima do CRM, sem API, frontend, BI ou integração runtime. Os commits df2ef94 e d968be7 documentaram bloqueios; esta sprint cria o domínio real.

## Domínio

O aggregate Lead exige unidade, origem, nome de contato e ator. Lifecycle: OPEN, CONVERTED, LOST e ARCHIVED. Estágios: NEW, CONTACTED, QUALIFIED, TRIAL_SCHEDULED, TRIAL_COMPLETED e NEGOTIATION. Status e estágio são independentes; estados terminais não reabrem e operações terminais repetidas são idempotentes.

Contato é normalizado e limitado. Não são armazenados CPF, endereço, mensagens, documentos ou dados financeiros. A unidade é imutável no aggregate. Pessoa e responsável comercial são vínculos opcionais; nenhuma Pessoa, matrícula ou aluno é criado.

## Persistência e auditoria

A migration manual cria crm_leads e crm_lead_stage_history em InnoDB. Há índices por unidade/status, unidade/stage, origem, owner, datas lifecycle e identidade consultiva. Não existe unique global de contato. O vínculo opcional com people usa FK; histórico referencia Lead.

O repository usa SQL parametrizado e transação para mudança de estado mais histórico. O histórico contém apenas IDs, estados, ação, ator, data e motivo curto; não duplica contato. Toda leitura e atualização exige unit_id.

## Application

CrmLeadService cobre criação, mudança de estágio, conversão e perda com autorização de unidade injetável, duplicidade consultiva e erros determinísticos. Não há efeitos externos, logs de PII, automações ou API.

## Aula experimental e limitações

trial-classes não foi migrada ou alterada. Uma integração futura deverá mapear explicitamente origem/status e manter idempotência, sem copiar histórico ou PII desnecessária. Unit FK e owner FK ficam pendentes até confirmação definitiva dos tipos legados. API administrativa, archive/assign/link em application, BI e frontend são próximos passos.

## Testes

Testes isolados cobrem criação, sanitização, lifecycle, transições inválidas, idempotência, autorização, isolamento, duplicidade consultiva, transação, histórico sem PII, SQL parametrizado e contrato da migration. A migration não é executada automaticamente nem contra banco real.
