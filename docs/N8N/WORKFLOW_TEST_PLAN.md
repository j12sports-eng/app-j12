# Plano de Testes dos Workflows n8n

## Regras comuns

- Executar somente em homologação, com workflows inativos e acionamento manual.
- Usar dados sintéticos, destinatário em allowlist e credenciais HML.
- Registrar versão Git/n8n, execução, entradas anonimizadas, saídas, HTTP e efeito.
- Importação bem-sucedida não equivale a teste funcional.
- Repetir a mesma chave de evento para validar idempotência.
- Em falha, não registrar sucesso nem repetir ilimitadamente.

## Financeiro - Lembretes

**Pré-condições:** `J12_API_URL`, `BOTCONVERSA_URL`, credenciais J12/BotConversa, fixture de mensalidade e allowlist.

| Caso | Resultado esperado |
| --- | --- |
| Importar inativo | 12 nós reconhecidos, conexões preservadas e timezone `America/Sao_Paulo` |
| Lista vazia | nenhum envio; saída `sem_registros` |
| Item válido | um envio sandbox e um evento `COMPLETED` |
| Já processado/não elegível | provedor não chamado |
| Item sem `eventKey` | ignorado sem envio |
| Provedor falha/expira | evento `FAILED`, sem sucesso falso |
| Repetir evento | nenhum segundo envio quando API sinaliza idempotência |

**Aceite:** todos os casos aprovados, somente HML/allowlist e um efeito por `eventKey`.

## Financeiro - Baixa de Pagamento

**Bloqueio atual:** zero nós; pode validar o envelope importado, mas não webhook ou baixa.

Quando houver fluxo executável, testar: confirmação válida; autenticação inválida; pagamento desconhecido; payload inválido; repetição idempotente; indisponibilidade da API. Nenhuma baixa real é permitida.

**Aceite:** autenticação, idempotência, falha controlada e reconciliação aprovadas.

## Financeiro - Cobrança Diária

**Bloqueio atual:** zero nós; não há gatilho, consulta, envio ou registro a testar.

Quando houver fluxo executável, testar: lista vazia; um inadimplente elegível; contato inválido; falha parcial; repetição no mesmo dia; paginação e limite de lote.

**Aceite:** volume, paginação, isolamento de falhas e chave diária comprovados.

## Financeiro - Cobrança no Vencimento

**Bloqueio atual:** zero nós; não há regra executável para o vencimento.

Quando houver fluxo executável, testar: vencimento hoje; datas não elegíveis; virada do dia em `America/Sao_Paulo`; cobrança paga/cancelada; repetição; falha ao registrar evento.

**Aceite:** seleção por data/status e idempotência aprovadas nos limites de horário.

## Financeiro - Reprocessar Falhas

**Bloqueio atual:** zero nós; não há seleção, backoff ou limite executável.

Quando houver fluxo executável, testar: falha transitória; falha permanente até `RETRY_LIMIT`; payload inválido sem retry cego; item já concluído; indisponibilidade prolongada; lote misto.

**Aceite:** limite finito, backoff, idempotência, seleção e auditoria comprovados.

## Registro de resultado

| Campo | Valor |
| --- | --- |
| Data/hora e executor |  |
| Ambiente e versão n8n |  |
| Commit/versão do JSON |  |
| ID da execução |  |
| Caso e fixture |  |
| Esperado/obtido |  |
| Evidência |  |
| Status (`APROVADO`, `REPROVADO`, `BLOQUEADO`) |  |
| Ação corretiva |  |
