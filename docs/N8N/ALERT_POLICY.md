# Política de Alertas n8n

## Princípios

Alertas devem ser acionáveis, deduplicados por ambiente/workflow/causa e conter somente metadados seguros. Thresholds são iniciais e devem ser calibrados em HML antes de produção.

## Severidades

### Crítico

Exige contenção imediata e acionamento dos responsáveis técnico, segurança e financeiro quando aplicável.

- workflow ativado em ambiente não autorizado;
- chamada a destino real durante Dry Run;
- cobrança, baixa ou mensagem duplicada;
- segredo/dado pessoal exposto em log;
- retry acima do limite configurado ou fila crescendo sem controle;
- três falhas consecutivas do mesmo workflow em 15 minutos;
- autenticação comprometida ou efeito financeiro em estado desconhecido.

Resposta inicial recomendada: até 5 minutos. Desativar o fluxo, bloquear novos gatilhos, preservar evidências e aplicar `INCIDENT_RESPONSE.md`.

### Atenção

Exige triagem no mesmo turno operacional.

- taxa de sucesso abaixo de 98% em 24 horas, com pelo menos 20 execuções;
- duração p95 acima de duas vezes a linha de base por três execuções;
- dependência indisponível por mais de 5 minutos;
- uma falha não recuperada, payload inválido ou credencial próxima da expiração;
- ausência de execução após o horário esperado mais a tolerância acordada;
- retries acima de 5% das execuções em 24 horas, com amostra mínima de 20.

Resposta inicial recomendada: até 30 minutos. Investigar, classificar e escalar se houver risco de efeito ou repetição.

### Informativo

Registra mudança ou evento esperado sem acionamento imediato.

- workflow importado, ativado/desativado em HML com autorização;
- execução manual de Dry Run iniciada/encerrada;
- credencial rotacionada;
- recuperação de dependência ou encerramento de incidente;
- execução sem itens elegíveis.

Revisar no resumo diário e conservar conforme a política de retenção.

## Conteúdo mínimo do alerta

- severidade e estado (`OPEN`, `ACKNOWLEDGED`, `RESOLVED`);
- ambiente, workflow e classe do erro;
- timestamp UTC, janela e contagem;
- `executionId` mais recente e `correlationId` quando aplicável;
- resumo sanitizado e link interno para runbook/dashboard, configurado fora do repositório;
- responsável atual e próximo passo.

Nunca incluir credenciais, payload completo, telefone, e-mail ou URL sensível.

## Deduplicação e escalonamento

- agrupar mesma causa por ambiente/workflow durante a janela definida;
- atualizar contador e último evento em vez de criar tempestade de alertas;
- não suprimir mudança de severidade;
- escalar Atenção para Crítico quando houver duplicidade, destino indevido, retry descontrolado ou impacto desconhecido;
- resolver somente após saúde restaurada, fila reconciliada e evidência registrada.

## Testes da política

Em HML, simular uma condição por vez usando stubs. Validar disparo, deduplicação, escalonamento, resolução e ausência de segredo. Não testar indisponibilidade contra serviços reais.
