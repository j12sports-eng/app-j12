# Resultados Esperados do Dry Run

## Regras gerais

- Todas as execuções são manuais, em cópia inativa e isolada.
- Respostas são produzidas por stubs; nenhum sistema real é chamado.
- Códigos e corpos exatos devem seguir o contrato configurado na fixture da execução.
- Importação válida de envelope vazio é resultado estrutural, não funcional.

## Financeiro - Lembretes

| Cenário | Comportamento e resposta esperados |
| --- | --- |
| Importação | 12 nós, 10 grupos de conexões, timezone `America/Sao_Paulo`, inativo |
| Lista vazia | stub responde sucesso com coleção vazia; nenhum item chega ao sink; saída `sem_registros` |
| Um item elegível | uma captura no sink e um registro simulado `COMPLETED` no stub J12 |
| Item já processado | fluxo ignora envio; nenhuma captura no sink |
| Item sem chave de evento | fluxo ignora envio; nenhum efeito simulado |
| Falha de mensagem | sink devolve falha controlada; registro simulado `FAILED`; nenhum sucesso falso |
| Timeout | execução falha/segue ramo de erro conforme o nó; sem repetição automática ilimitada |
| Repetição idempotente | fixture sinaliza processamento anterior; segunda captura não ocorre |

## Demais workflows

`financeiro-baixa-pagamento`, `financeiro-cobranca-diaria`, `financeiro-cobranca-vencimento` e `financeiro-reprocessar-falhas` devem:

- importar com `active=false`;
- apresentar zero nós e zero conexões;
- não oferecer execução funcional;
- receber resultado `BLOQUEADO - SEM FLUXO EXECUTÁVEL`.

Não simular comportamento inexistente nem interpretar o envelope vazio como aprovação.

## Erros aceitáveis

São aceitáveis apenas quando deliberadamente injetados pelo stub e corretamente registrados:

- resposta de negócio inválida para testar validação;
- status de autenticação simulado;
- timeout curto e controlado;
- indisponibilidade simulada;
- payload sintético incompleto;
- rejeição de duplicidade simulada.

O erro deve ficar restrito à execução, sem chamada externa real, retry ilimitado ou exposição de segredo.

## Erros críticos

- qualquer tentativa de alcançar API/provedor real;
- entrega de mensagem ou mutação financeira, inclusive em HML não isolada;
- workflow original ou agendamento ativado;
- credencial válida fora do stub vinculada à cópia;
- dado pessoal, segredo ou URL real em log/evidência;
- duplicidade, retry crescente ou execução fora da janela;
- resultado de sucesso apesar de falha no sink/stub;
- execução funcional atribuída a um envelope vazio.

Erro crítico reprova o Dry Run, exige interrupção imediata e aciona `INCIDENT_RESPONSE.md`.

## Critérios de aprovação

- checklist integralmente preenchido, sem gate de segurança pendente;
- isolamento de rede e destinos stub comprovados;
- originais e cópia permanecem inativos fora da execução manual;
- casos aplicáveis produzem exatamente os efeitos simulados esperados;
- nenhum efeito real, entrega, segredo ou dado pessoal;
- repetição idempotente aprovada e ausência de retry infinito;
- evidências anonimizadas aprovadas pelos responsáveis;
- envelopes vazios corretamente classificados como bloqueados.

A aprovação vale somente para o Dry Run da versão registrada e não autoriza ativação HML agendada ou produção.
