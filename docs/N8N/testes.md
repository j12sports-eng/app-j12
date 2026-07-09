# Plano de Testes - Sprint 20.2

## Objetivo

Validar o funcionamento dos workflows financeiros implementados no n8n.

---

# Teste 1 - Cobrança antes do vencimento

## Cenário

Existe uma cobrança pendente com vencimento para amanhã.

## Esperado

- Workflow executa às 08:00.
- A cobrança é localizada.
- A mensagem é enviada pelo BotConversa.
- A execução é registrada sem erros.

Status:

[ ] Aprovado

---

# Teste 2 - Cobrança vencida

## Cenário

Existe uma cobrança vencida e ainda não paga.

## Esperado

- Workflow executa às 09:00.
- Apenas cobranças vencidas são selecionadas.
- O responsável recebe a mensagem.
- Não ocorre envio duplicado.

Status:

[ ] Aprovado

---

# Teste 3 - Sincronização Banco Inter

## Cenário

Existe um pagamento confirmado no Banco Inter.

## Esperado

- Workflow executa a cada 10 minutos.
- Consulta a API do Banco Inter.
- Atualiza o status da cobrança.
- Registra sucesso.

Status:

[ ] Aprovado

---

# Teste 4 - Confirmação de pagamento

## Cenário

Pagamento identificado como recebido.

## Esperado

- Mensagem de agradecimento enviada.
- Nenhuma cobrança adicional enviada.
- Status atualizado corretamente.

Status:

[ ] Aprovado

---

# Teste 5 - Falha de autenticação

## Cenário

Token inválido.

## Esperado

- Workflow registra erro.
- Nenhum dado é alterado.
- Erro disponível no histórico do n8n.

Status:

[ ] Aprovado

---

# Teste 6 - Banco Inter indisponível

## Cenário

API do Banco Inter indisponível.

## Esperado

- Workflow falha de forma controlada.
- Tentativa posterior executada normalmente.
- Nenhuma cobrança é duplicada.

Status:

[ ] Aprovado

---

# Checklist Final

- [ ] Workflows importados.
- [ ] Credenciais configuradas.
- [ ] Cron configurado.
- [ ] API acessível.
- [ ] Banco Inter acessível.
- [ ] BotConversa funcionando.
- [ ] Logs validados.
- [ ] Testes aprovados.