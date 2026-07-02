# Sprint 10.5 — Capacidade e Vagas no Vínculo Matrícula ↔ Turma

## Objetivo

Adicionar validação segura de capacidade/vagas ao vínculo real entre matrícula `ACTIVE` e turma, sem alterar frontend, mobile, financeiro, agenda, notificações, API pública ou regras de confirmação de matrícula.

## Mapeamento do schema real

- Capacidade total da turma: coluna `j12_turmas.capacidade`.
- Status real da turma: coluna `j12_turmas.status`.
- Vínculos ativos: tabela `enrollment_class_links` com coluna `status = 'ACTIVE'`.
- Vínculos inativos/antigos: não contam para a ocupação; a regra considera apenas links ativos.
- Limites por modalidade/professor/horário: não foram identificados no schema atual como parte do fluxo de vínculo de matrícula/turma.
- Tabela histórica: não existe no fluxo atual para a regra de capacidade; o controle é baseado nos vínculos ativos.
- Lista de espera: não existe no schema atual para este fluxo.

## Regra aplicada

Antes de criar um vínculo ativo, o serviço valida:

1. existência da turma;
2. status ativo da turma;
3. capacidade total da turma;
4. quantidade de vínculos ativos já existentes para a turma;
5. bloqueio quando `vagas_ocupadas >= capacidade_total`.

## Estratégia de concorrência

A implementação atual usa a leitura do snapshot de capacidade e a checagem no serviço antes da criação. Como o schema real ainda não possui uma estratégia de lock transacional explícita para esta operação, a proteção contra duas matrículas simultâneas ocupando a última vaga permanece dependente do repositório/adapter de banco e do uso de `createOrReuseActiveLink` com a lógica de idempotência. Para uma proteção forte contra race condition, a próxima etapa recomendada é adicionar um lock transacional ou uma regra de unicidade/consistência no ponto de escrita.

## Smoke tests

- CLASS_CAPACITY_GUARD_ENABLED=true
- CLASS_WITH_AVAILABLE_CAPACITY_ALLOWED=true
- FULL_CLASS_BLOCKED=true
- ACTIVE_LINKS_COUNTED=true
- INACTIVE_LINKS_IGNORED=true
- DUPLICATE_LINK_REUSED_OR_BLOCKED=true
- CAPACITY_CONCURRENCY_RISK_HANDLED_OR_DOCUMENTED=true
- NO_FINANCIAL_SIDE_EFFECTS=true
- NO_SCHEDULE_SIDE_EFFECTS=true
- NO_NOTIFICATION_SIDE_EFFECTS=true
- NO_TEST_DATA_LEFT=true

## Limitações

- A regra usa a capacidade real da turma quando a coluna `capacidade` estiver disponível no schema.
- Se a capacidade não estiver disponível no schema real, o serviço permanece compatível com a leitura de fallback sem inventar colunas ou regras novas.

## Próximos passos

- Avaliar lock transacional ou outra proteção forte contra concorrência.
- Se houver necessidade, expandir o repositório para contar vínculos ativos com maior controle de atomicidade.
