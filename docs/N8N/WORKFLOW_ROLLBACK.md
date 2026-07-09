# Plano de Rollback dos Workflows n8n

## Objetivo

Interromper automações com segurança, preservar evidências e restaurar a última versão aprovada sem duplicar cobranças, baixas ou mensagens.

## Gatilhos

- ambiente errado ou destinatário fora da allowlist;
- duplicidade, volume inesperado ou retry sem limite;
- credencial exposta/incorreta;
- payload incompatível ou efeito parcial;
- indisponibilidade persistente da API/provedor;
- versão importada divergente da aprovada.

## Preparação

1. Exportar a versão aprovada antes de ativar.
2. Registrar versão Git, ID do workflow/n8n e responsável.
3. Confirmar que o export não contém segredos.
4. Definir janela, canal de incidente e responsáveis técnico/financeiro.
5. Garantir acesso para desativar e revogar credenciais.

## Procedimento imediato

1. Desativar o workflow afetado; em risco sistêmico/ambiente errado, desativar todos.
2. Bloquear novos gatilhos/webhooks quando aplicável.
3. Avaliar efeitos parciais antes de cancelar execuções em andamento.
4. Registrar horários, IDs, entradas afetadas e último nó concluído.
5. Revogar/rotacionar credenciais se houver exposição ou ambiente incorreto.
6. Não usar o reprocessador durante o incidente.

## Reconciliação e restauração

1. Consultar quais mensagens, eventos ou baixas foram efetivados, sem nova mutação.
2. Comparar `eventKey`, identificador financeiro e `executionId`.
3. Classificar cada item: não processado, concluído, falhou ou desconhecido.
4. Não repetir concluídos/desconhecidos sem autorização financeira.
5. Importar o último export aprovado ou JSON do commit aprovado, sempre inativo.
6. Conferir workflow correto, nós, conexões, settings, credenciais e variáveis HML.
7. Executar caso sintético e repetição idempotente.
8. Obter aprovação técnica/financeira e reativar um por vez, somente em HML.

Se não existir versão anterior executável, manter desativado; envelope vazio não é alternativa operacional.

## Resposta por cenário

| Cenário | Ação adicional |
| --- | --- |
| API J12 indisponível | aguardar health check; timeout não comprova ausência de efeito |
| Provedor indisponível | consultar status antes de repetir |
| Credencial comprometida | revogar, rotacionar e revisar logs |
| Payload inválido | separar item; não repetir até corrigir mapeamento |
| Duplicidade | bloquear reprocessamento e reconciliar por chave |
| Retry infinito | desativar reprocessador e impor limite antes do retorno |
| Ambiente errado | desativar todos, revogar credenciais e abrir incidente crítico |

## Critérios de encerramento

- workflows inativos ou restaurados na versão aprovada;
- nenhuma execução/retry não controlado;
- efeitos parciais e duplicidades reconciliados;
- credenciais validadas/rotacionadas;
- causa, impacto, evidências e decisão documentados;
- teste sintético e idempotente aprovado antes da reativação.
