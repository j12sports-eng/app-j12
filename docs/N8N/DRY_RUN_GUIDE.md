# Guia de Dry Run dos Workflows Financeiros

## Objetivo

Preparar e registrar uma execução simulada em HML sem produzir baixa, cobrança, mensagem ou evento financeiro real. Esta sprint documenta o procedimento; não executa workflows nem integrações.

## Estado e limite de segurança

| Workflow | Estado atual | Dry Run permitido |
| --- | --- | --- |
| `financeiro-lembretes` | 12 nós; quatro chamadas HTTP habilitadas; `active=false` | somente em cópia isolada, com todos os destinos substituídos por stubs/sinks HML |
| `financeiro-baixa-pagamento` | zero nós/conexões | importação e inspeção estrutural apenas |
| `financeiro-cobranca-diaria` | zero nós/conexões | importação e inspeção estrutural apenas |
| `financeiro-cobranca-vencimento` | zero nós/conexões | importação e inspeção estrutural apenas |
| `financeiro-reprocessar-falhas` | zero nós/conexões | importação e inspeção estrutural apenas |

`active=false` impede execução agendada, mas não impede chamadas externas durante execução manual. Sem isolamento comprovado, **não executar**.

## Pré-requisitos

- projeto n8n inequivocamente identificado como HML;
- acesso, auditoria e retenção de execuções revisados;
- export/backup da versão importada;
- cópia do workflow nomeada com sufixo `DRY RUN`, mantida inativa;
- API stub para respostas sintéticas da J12;
- sink stub para mensagens, incapaz de entregar a destinatários;
- egress bloqueado para API/provedores reais;
- variáveis da cópia apontando somente para stubs;
- credenciais próprias de simulação, sem validade em sistemas reais;
- fixtures sintéticas sem dados pessoais;
- `DRY_RUN_CHECKLIST.md`, responsáveis e janela registrados.

## Preparação

1. Importar o JSON original com `active=false` e não executá-lo.
2. Duplicar no painel n8n para uma cópia descartável de Dry Run.
3. Confirmar que a cópia também está inativa e sem gatilho automático habilitado.
4. Vincular variáveis exclusivas aos stubs; não reutilizar configuração real ou produtiva.
5. Validar por controle de rede que a cópia não alcança API J12, Banco Inter, BotConversa ou WhatsApp reais.
6. Configurar o stub da API para devolver fixtures dos casos vazio, sucesso, inválido, indisponível e repetido.
7. Configurar o sink de mensagens para apenas capturar requisições e devolver resposta simulada.
8. Revisar os quatro nós HTTP de lembretes e comprovar seus destinos resolvidos sem revelar valores.
9. Para os envelopes vazios, registrar `BLOQUEADO - SEM FLUXO EXECUTÁVEL`.

Não basta desabilitar apenas o nó de envio: os nós de consulta e registro também produzem integração externa e precisam usar stubs.

## Execução

1. Selecionar um caso e registrar fixture, resultado esperado e operador.
2. Executar manualmente somente a cópia `DRY RUN`.
3. Acompanhar nó a nó; não acionar cron, webhook público ou fila real.
4. Confirmar no sink que nenhuma entrega ocorreu e que no máximo uma requisição simulada foi capturada.
5. Confirmar no stub J12 que consultas/registros foram apenas simulados.
6. Repetir a mesma chave sintética para observar o comportamento idempotente simulado.
7. Executar os cenários de erro por resposta controlada do stub, nunca derrubando serviços reais.
8. Encerrar a execução e manter original e cópia inativos.

## Validações

- IDs de execução, caminho percorrido, entradas e saídas correspondem ao caso;
- nenhum hostname/destino real aparece nos metadados da execução;
- nenhum dado pessoal, segredo ou material financeiro real aparece nos logs;
- sink registra captura sem entrega;
- erros controlados não geram sucesso falso nem repetição ilimitada;
- repetição utiliza a mesma chave sintética e não cria segundo efeito simulado quando a fixture sinaliza processamento prévio;
- resultados correspondem a `DRY_RUN_EXPECTED_RESULTS.md`.

## Encerramento e rollback

1. Parar/cancelar a execução se qualquer gate falhar.
2. Manter todos os workflows inativos.
3. Preservar evidências anonimizadas e registrar resultado.
4. Remover vínculos de credenciais/variáveis da cópia descartável.
5. Excluir a cópia somente após preservar as evidências autorizadas.
6. Reconciliar qualquer chamada não prevista antes de repetir.
7. Aplicar `INCIDENT_RESPONSE.md` e `WORKFLOW_ROLLBACK.md` em evento crítico.

Dry Run aprovado não autoriza ativação agendada nem produção.
