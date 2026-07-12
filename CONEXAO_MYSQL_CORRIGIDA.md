# 🚀 Conexão MySQL Corrigida - J12 Sports Hub

## 📋 Resumo das Alterações

### ✅ Problemas Corrigidos

1. **Timeout de Bootstrap Aumentado**
   - ❌ Anterior: 15 segundos (15000ms)
   - ✅ Corrigido: 60 segundos (60000ms)
   - Arquivo: `backend/src/server.js`

2. **Pool de Conexão Otimizado para HostGator**
   - ✅ Connect Timeout: 60 segundos (60000ms)
   - ✅ Connection Limit: 20 conexões simultâneas
   - ✅ Keep-Alive ativado com delay de 30 segundos
   - Arquivo: `backend/src/config/db.js`

3. **Reconexão Automática com Backoff Exponencial**
   - ✅ Até 10 tentativas de reconexão
   - ✅ Delay progressivo: 1s, 2s, 4s, 8s, 16s, 30s (máximo)
   - ✅ Detecta erros: `PROTOCOL_CONNECTION_LOST`, `PROTOCOL_ERROR`, etc.
   - Arquivo: `backend/src/config/db.js`

4. **Validação de Credenciais no Startup**
   - ✅ Valida obrigatoriedade: `DB_HOST`, `DB_USER`, `DB_NAME`
   - ✅ Mata o processo se credenciais forem inválidas
   - ✅ Exibe logs claros de validação
   - Arquivo: `backend/src/config/db.js`

5. **Logs Detalhados de Conexão**
   - ✅ Logs de teste de conexão com ping
   - ✅ Logs de tentativas de reconexão
   - ✅ Logs de erro com code, errno e mensagem
   - ✅ Logs de liberação de conexão
   - Arquivo: `backend/src/config/db.js`

6. **Variáveis de Ambiente Expandidas**
   - ✅ `DB_CONNECTION_LIMIT=20`
   - ✅ `DB_CONNECT_TIMEOUT=60000`
   - ✅ `DB_USE_SSL=false`
   - ✅ `BOOTSTRAP_WARN_TIMEOUT_MS=60000`
   - ✅ `NODE_ENV=development`
   - Arquivo: `.env`

7. **Tratamento de Erro Melhorado**
   - ✅ Try/catch melhorado na função `testConnection()`
   - ✅ Liberação segura de conexão em finally blocks
   - ✅ Tratamento de erro no pool durante queries
   - Arquivo: `backend/src/config/db.js`

8. **Healthcheck Robusto**
   - ✅ Endpoint `/health` com status do banco
   - ✅ Endpoint `/api/test` para teste rápido
   - ✅ Responde com `degraded` se banco não está ready
   - Arquivo: `backend/src/server.js`

9. **Logs de Inicialização Melhorados**
   - ✅ Banner de inicialização do servidor
   - ✅ Exibição de configurações do banco
   - ✅ Exibição de endpoints disponíveis
   - Arquivo: `backend/src/server.js`

---

## 📁 Arquivos Alterados

```
backend/
├── src/
│   ├── config/
│   │   └── db.js ........................ ✅ CORRIGIDO
│   └── server.js ....................... ✅ CORRIGIDO
└── package.json ........................ ✅ Sem mudança (já tem mysql2)

.env .................................... ✅ EXPANDIDO
```

---

## 🔧 Configuração do .env

```bash
# ====================================
# BANCO DE DADOS - HOSTGATOR
# ====================================
DB_HOST=108.167.168.27
DB_USER=bestt486_appj12
DB_PASSWORD="<REDACTED_HISTORICAL_SECRET>"
DB_NAME=bestt486_appj12
DB_PORT=3306

# Pool de conexão
DB_CONNECTION_LIMIT=20
DB_CONNECT_TIMEOUT=60000
DB_USE_SSL=false

# Bootstrap e healthcheck
BOOTSTRAP_WARN_TIMEOUT_MS=60000
NODE_ENV=development
```

---

## 🚀 Como Iniciar Backend e Frontend

### 1️⃣ Terminal 1 - Backend (Node.js + Express)

```bash
# Navegue até o diretório do backend
cd backend

# Instale dependências (se não estiver feito)
npm install

# Ou com Bun (se usar)
bun install

# Inicie o backend
npm run dev

# Ou com Bun
bun run dev
```

**Esperado na saída:**
```
========================================
🚀 INICIANDO J12 API
========================================

[DB] Validando credenciais do banco de dados...
[DB] ✓ Credenciais validadas com sucesso
[DB] Host: 108.167.168.27:3306
[DB] Database: bestt486_appj12
[DB] User: bestt486_appj12
[DB] Configuração do pool:
  - Connection Limit: 20
  - Connect Timeout: 60000ms
  - Keep-Alive: true
  - Keep-Alive Delay: 30000ms
[DB] Criando novo pool de conexões...
✓ [SERVER] API ouvindo em http://0.0.0.0:3001
✓ [ENDPOINTS] Health: http://127.0.0.1:3001/health
✓ [ENDPOINTS] Login: POST http://127.0.0.1:3001/auth/login
✓ [ENDPOINTS] Test: http://127.0.0.1:3001/api/test

[SERVER] Inicializando banco de dados em background...
[DB] Testando conexão com banco de dados...
[DB] ✓ Conexão adquirida do pool
[DB] ✓ Ping ao banco de dados bem-sucedido
[DB] ✓ Conexão liberada
[DB] ✓ Teste de conexão concluído com sucesso
[OK] Banco de dados inicializado.
```

### 2️⃣ Terminal 2 - Frontend (React + Vite)

```bash
# Navegue até a raiz do projeto
cd ..

# Instale dependências (se não estiver feito)
npm install
# ou
bun install

# Inicie o frontend em desenvolvimento
npm run dev

# Ou com Bun
bun run dev
```

**Esperado na saída:**
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  press h to show help
```

---

## ✅ Validação da Conexão

### 1. Teste de Healthcheck

```bash
curl http://localhost:3001/health
```

**Resposta esperada:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "database": "ready",
    "schemaReady": true,
    "lastError": null,
    "timestamp": "2026-05-15T...",
    "uptime": 45.234
  }
}
```

### 2. Teste da API

```bash
curl http://localhost:3001/api/test
```

**Resposta esperada:**
```json
{
  "success": true,
  "data": {
    "message": "Backend funcionando."
  }
}
```

### 3. Teste de Login

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "login": "usuario@email.com",
    "senha": "sua-senha"
  }'
```

---

## 🔍 Logs de Debug

### Ativar Logs Detalhados

1. No `.env`, adicione (ou mantenha):
```bash
NODE_ENV=development
```

2. Os logs serão exibidos automaticamente no console do backend

### Exemplos de Logs

**Conexão bem-sucedida:**
```
[DB] Testando conexão com banco de dados...
[DB] ✓ Conexão adquirida do pool
[DB] ✓ Ping ao banco de dados bem-sucedido
[DB] ✓ Conexão liberada
[DB] ✓ Teste de conexão concluído com sucesso
```

**Query com erro:**
```
[ERROR] Falha na query SQL {
  code: 'ER_ACCESS_DENIED_ERROR',
  errno: 1045,
  message: 'Access denied for user',
  sql: 'SELECT * FROM j12_alunos WHERE ...',
  timestamp: '2026-05-15T...'
}
```

**Reconexão automática:**
```
[ERROR] Falha na conexão com banco de dados (Tentativa 1/10)
  Code: PROTOCOL_CONNECTION_LOST
  Error: 1006
  Message: Connection lost...
[DB] Aguardando 1000ms antes de tentar novamente...
```

---

## 🛡️ Tratamento de Erros Comuns

### Erro 1: "Bootstrap do banco excedeu Xms"

**Possível causa:** Conexão lenta com HostGator

**Solução:**
```bash
# No .env, aumentar timeout
BOOTSTRAP_WARN_TIMEOUT_MS=120000  # 2 minutos
DB_CONNECT_TIMEOUT=120000  # 2 minutos
```

### Erro 2: "Access denied for user"

**Possível causa:** Credenciais incorretas

**Solução:**
1. Verificar credenciais no `.env`
2. Testar conexão direto no HostGator (SSH/cPanel)
3. Verificar whitelist de IP se necessário

### Erro 3: "Connection lost"

**Possível causa:** Timeout de conexão HostGator

**Solução:**
```bash
# No .env, aumentar keep-alive
DB_CONNECTION_LIMIT=30
DB_CONNECT_TIMEOUT=90000
```

---

## 📊 Monitoramento

### Health Check Contínuo

```bash
# Monitorar a cada 5 segundos
watch -n 5 'curl -s http://localhost:3001/health | jq'
```

### Ver Todas as Rotas

```bash
curl http://localhost:3001/health | jq '.data'
```

---

## 🔄 Ciclo de Vida de Reconexão

```
Tentativa 1: Aguarda 1s
Tentativa 2: Aguarda 2s
Tentativa 3: Aguarda 4s
Tentativa 4: Aguarda 8s
Tentativa 5: Aguarda 16s
Tentativa 6-10: Aguardam até 30s (máximo)
Tentativa 11: Erro permanente - servidor para
```

---

## 🔐 Segurança

### Credenciais
- ✅ Armazenadas no `.env` (não versionado em Git)
- ✅ Validadas no startup
- ✅ Senhas com caracteres especiais aceitos

### SSL/TLS
- ⚠️ Desativado por padrão (`DB_USE_SSL=false`)
- ℹ️ HostGator não requer SSL para conexões internas
- ✅ Pode ser ativado se necessário

### CORS
- ✅ Configurado para localhost (dev)
- ✅ Adicionar domínios em `CORS_ORIGIN` no `.env`

---

## 📞 Suporte

Se ainda tiver problemas:

1. **Verificar credenciais do .env:**
```bash
echo $DB_HOST $DB_USER $DB_NAME
```

2. **Testar conexão direto:**
```bash
mysql -h 108.167.168.27 -u bestt486_appj12 -p
```

3. **Ver logs do PM2 (se usar):**
```bash
npm install -g pm2
pm2 logs
```

4. **Verificar firewall:**
   - Porta MySQL HostGator: 3306
   - Verificar whitelist de IP

---

## ✨ Próximos Passos

- [ ] Configurar PM2 para produção
- [ ] Setup de backup automatizado do banco
- [ ] Monitoramento contínuo com APM
- [ ] Rate limiting por IP
- [ ] Cache Redis para queries frequentes

---

**Última atualização:** 15 de Maio de 2026
**Versão Backend:** 1.0.0
**Banco de Dados:** MySQL (HostGator)
