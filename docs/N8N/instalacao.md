# Instalação dos Workflows - Sprint 20.2

## Objetivo

Configurar as automações financeiras da J12 Sports utilizando o n8n.

---

## Pré-requisitos

- n8n instalado e funcionando
- API da J12 Sports acessível
- Banco Inter configurado
- BotConversa configurado
- Token de administrador válido

---

## Passo 1 - Importar os workflows

No n8n:

Menu → Workflows → Import

Importar os seguintes arquivos:

- financeiro-cobranca-antes-vencimento.json
- financeiro-cobranca-vencida.json
- financeiro-confirmacao-pagamento.json
- financeiro-sync-inter.json

---

## Passo 2 - Configurar credenciais HTTP

Criar uma credencial HTTP para a API da J12 Sports.

Exemplo:

Base URL

http://127.0.0.1:3001

Headers

Authorization: Bearer {TOKEN_ADMIN}

Content-Type: application/json

---

## Passo 3 - Configurar BotConversa

Adicionar a credencial HTTP do BotConversa.

Informar:

- URL da API
- Token

---

## Passo 4 - Configurar Banco Inter

Adicionar as credenciais:

- Client ID
- Client Secret
- Certificado
- Chave privada

Conforme configuração da Sprint 20.1.

---

## Passo 5 - Configurar os Cron

Workflow                                   Agendamento

Cobrança antes do vencimento               08:00 diariamente

Cobrança vencida                           09:00 diariamente

Sincronização Banco Inter                  a cada 10 minutos

Confirmação de pagamento                   após sincronização

---

## Passo 6 - Ativar

Após validar todos os testes:

Ativar os quatro workflows no n8n.

---

## Observações

- Nunca salvar tokens dentro dos workflows.
- Utilizar apenas credenciais do n8n.
- Todos os logs devem permanecer disponíveis para auditoria.