# Variáveis de Ambiente - Sprint 20.2

Estas variáveis devem ser configuradas nas credenciais do n8n ou no ambiente onde o serviço estiver executando.

---

# API J12 Sports

API_URL=http://127.0.0.1:3001

API_TOKEN=

---

# Banco Inter

INTER_ENVIRONMENT=homolog

INTER_CLIENT_ID=

INTER_CLIENT_SECRET=

INTER_CONTA_CORRENTE=

INTER_CERT_PATH=

INTER_KEY_PATH=

---

# BotConversa

BOTCONVERSA_URL=

BOTCONVERSA_TOKEN=

---

# WhatsApp

WHATSAPP_PROVIDER=BotConversa

---

# Cron

COBRANCA_ANTES_VENCIMENTO=08:00

COBRANCA_VENCIDA=09:00

INTER_SYNC=*/10 * * * *

---

# Timezone

TZ=America/Sao_Paulo

---

# Endpoints utilizados

GET  /financeiro/cobrancas

GET  /inter/sync

POST /inter/webhook

POST /botconversa/send

---

# Observações

- Todas as credenciais devem ser armazenadas no n8n.
- Nunca salvar tokens diretamente nos workflows.
- Os certificados do Banco Inter devem permanecer apenas no servidor.