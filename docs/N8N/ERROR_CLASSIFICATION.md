# Classificação Operacional de Erros

## Objetivo

Padronizar gravidade, possibilidade de recuperação e resposta. A classificação considera impacto observado, não apenas código HTTP ou mensagem técnica.

## Warning

Condição anormal sem perda da execução e sem efeito incorreto.

Exemplos:

- execução sem itens elegíveis;
- latência acima da linha de base, ainda dentro do timeout;
- campo opcional ausente;
- credencial próxima da expiração.

Resposta: registrar `WARN`, observar tendência e corrigir no turno. Retry automático normalmente não é necessário.

## Recoverable

Falha transitória com estado conhecido e recuperação segura/idempotente.

Exemplos:

- indisponibilidade temporária ou limitação simulada pelo stub;
- timeout com confirmação de que nenhum efeito ocorreu;
- falha de rede antes do envio, com estado reconciliado.

Resposta: registrar `WARN` ou `ERROR`, aplicar retry finito com backoff e mesma correlação. Escalar quando esgotar limite ou o estado ficar desconhecido.

## Critical

Falha com impacto alto, risco de duplicidade, segurança ou estado incerto.

Exemplos:

- autenticação comprometida;
- payload incompatível com possível efeito parcial;
- destino fora do ambiente permitido;
- duplicidade ou retry descontrolado;
- falha ao registrar o resultado após efeito confirmado.

Resposta: interromper workflow, bloquear gatilhos/retries, preservar evidências, alertar imediatamente e reconciliar antes de retomar. Não fazer retry automático.

## Fatal

Condição que invalida a operação do ambiente ou exige suspensão global.

Exemplos:

- execução em produção sem autorização;
- efeito financeiro ou mensagem real durante Dry Run;
- exposição confirmada de segredo com alcance externo;
- corrupção/perda sistêmica da trilha de auditoria;
- múltiplos workflows produzindo efeitos não controlados.

Resposta: desativar todos os workflows, bloquear egress, revogar credenciais, abrir incidente máximo e acionar segurança/financeiro. Retorno exige análise de causa, reconciliação e nova autorização formal.

## Matriz de decisão

| Pergunta | Sim | Não |
| --- | --- | --- |
| Houve ambiente/destino não autorizado ou impacto sistêmico? | Fatal | continuar |
| Há duplicidade, exposição, efeito parcial ou estado desconhecido? | Critical | continuar |
| A falha é transitória, conhecida e recuperável com idempotência? | Recoverable | continuar |
| A execução concluiu corretamente com condição degradada? | Warning | investigar como erro não classificado |

Na dúvida entre duas classes, usar a mais grave até obter evidência.

## Transições

- Warning vira Recoverable se impedir conclusão.
- Recoverable vira Critical ao esgotar retries, perder idempotência ou tornar o estado desconhecido.
- Critical vira Fatal quando o impacto é sistêmico, produtivo ou não contido.
- Redução de severidade exige evidência, responsável e timestamp registrados.

## Campos de erro

Todo erro deve registrar `errorClass`, `errorCode` estável, mensagem sanitizada, dependência, `workflowId`, `executionId`, `correlationId`, tentativa, timestamp e estado do efeito (`NONE`, `CONFIRMED`, `UNKNOWN`).
