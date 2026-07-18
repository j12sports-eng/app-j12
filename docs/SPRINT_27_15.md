# Sprint 27.15 — Pipeline Canônico de Leads

O pipeline foi centralizado em lead-stage-transition-policy.js, preservando o aggregate, service, repository e tabelas da Sprint 27.14. Não foi criada migration: crm_leads já possui stage/status e crm_lead_stage_history já contém os campos e índices necessários.

Matriz: NEW -> CONTACTED/LOST; CONTACTED -> QUALIFIED/LOST; QUALIFIED -> PROPOSAL/LOST; PROPOSAL -> NEGOTIATION/LOST; NEGOTIATION -> WON/LOST. WON e LOST são terminais. Mesmo estágio, salto, stage desconhecido e movimentação terminal falham antes da persistência. LOST exige motivo.

WON sincroniza status CONVERTED e convertedAt; LOST sincroniza status LOST, lostAt e lostReason. A API application moveLeadToStage usa autorização de unidade, valida o aggregate e persiste via transação.

O repository faz SELECT FOR UPDATE e UPDATE compare-and-set por id, unidade, stage anterior e status anterior. affectedRows diferente de um gera CRM_STAGE_CONFLICT; o histórico só é inserido depois do update válido, na mesma transação. A consulta de histórico é ascendente por created_at e id.

O estado bloqueado também é comparado com o stage/status originalmente lido, impedindo aplicação de resultado calculado sobre snapshot antigo. Movimentos para LOST persistem o motivo mesmo usando STAGE_CHANGED. Metadata é validada como JSON serializável de até 4096 caracteres, mas não é persistida porque o schema não possui coluna canônica.

O método changeStage legado da fundação foi preservado para compatibilidade; novas movimentações de pipeline usam exclusivamente moveTo/moveLeadToStage. Metadata, notas e correlação não foram adicionadas porque o schema real não as possui.

Testes cobrem fluxo até WON, LOST, saltos, mesmo stage, terminais, inexistente, concorrência, atomicidade, histórico e regressão 27.14. Fora do escopo: HTTP, frontend, integrações, conversão de Pessoa/aluno/matrícula, BI, automações e reabertura.
