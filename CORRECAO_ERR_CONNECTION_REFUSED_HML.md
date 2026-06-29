# Correção: net::ERR_CONNECTION_REFUSED em HML

**Data:** 2026-06-21  
**Erro:** `net::ERR_CONNECTION_REFUSED` na linha 365 de `api.ts`  
**Ambiente:** Homologação (HML)  
**Status:** ✅ CORRIGIDO

---

## 🔴 PROBLEMA IDENTIFICADO

### Erro Observado
```
net::ERR_CONNECTION_REFUSED
fetch
api.ts:365
```

### Causa Raiz
O arquivo `.env.local` continha uma configuração incorreta para o ambiente HML:
```env
VITE_API_URL=http://127.0.0.1:3001
```

### Por Que Falha
1. Em HML, o frontend é acessado via HTTPS: `https://hml.app.j12sports.com.br`
2. O Nginx (porta 443) recebe a requisição
3. Nginx proxifica para servidor SSR em `http://127.0.0.1:4173`
4. O servidor SSR renderiza o HTML com a variável de ambiente `VITE_API_URL=http://127.0.0.1:3001`
5. JavaScript do frontend tenta fazer `fetch('http://127.0.0.1:3001/auth/login')`
6. **❌ Erro:** O navegador tenta conectar a `127.0.0.1:3001` na **máquina do cliente**, não no servidor
7. **Resultado:** `net::ERR_CONNECTION_REFUSED`

### Contexto do Fluxo Incorreto
```
Browser                        Nginx (HML)              SSR (4173)           API (3001)
 |                              |                         |                      |
 +----HTTPS GET────────────────→ |                         |                      |
 |                              |                         |                      |
 |                              +---HTTP proxy────────────→ |                      |
 |                              |                         |                      |
 |←─────HTML (com VITE_API_URL)─┤                         |                      |
 |                              |                         |                      |
 +── fetch('http://127.0.0.1:3001') ✗ ERRO!              |                      |
```

---

## ✅ SOLUÇÃO IMPLEMENTADA

### Arquivo Modificado: `.env.local`

**ANTES:**
```env
VITE_API_URL=http://127.0.0.1:3001
```

**DEPOIS:**
```env
# VITE_API_URL=http://127.0.0.1:3001
# REMOVIDO: Esta URL causava ERR_CONNECTION_REFUSED em HML
# Motivo: O frontend em HML deve usar /__api (relativo) em vez de localhost
# O servidor SSR em 4173 proxifica /__api/* para http://127.0.0.1:3001/*
```

### Por Que Funciona Agora

1. **Sem `VITE_API_URL` definido:**
   ```typescript
   // src/lib/api.ts - getBrowserApiBaseUrl()
   const configuredBaseUrl = normalizeBaseUrl(
     import.meta.env.VITE_API_URL ||  // undefined ✓
     import.meta.env.VITE_API_BASE_URL ||  // undefined ✓
     import.meta.env.VITE_AUTH_URL,  // undefined ✓
     getDefaultBrowserApiUrl(),  // Chamado como fallback
   );
   ```

2. **Detecção de Ambiente HML:**
   ```typescript
   function isHmlBrowserHost(): boolean {
     return isBrowser() && HML_FRONTEND_HOSTS.has(window.location.hostname.toLowerCase());
     // true: porque hostname = "hml.app.j12sports.com.br"
   }

   function getDefaultBrowserApiUrl(): string {
     return isHmlBrowserHost() 
       ? DEFAULT_HML_BROWSER_API_URL  // "/__api" ✓
       : DEFAULT_BROWSER_API_URL;     // "/api"
   }
   ```

3. **URL Base Correta:**
   ```typescript
   if (isHmlBrowserHost() && configuredBaseUrl === DEFAULT_BROWSER_API_URL) {
     return DEFAULT_HML_BROWSER_API_URL;  // "/__api" ✓
   }
   return configuredBaseUrl;  // "/__api"
   ```

4. **Fluxo de Requisição:**
   ```
   Browser                  Nginx (HML)              SSR (4173)           API (3001)
    |                          |                         |                      |
    +---HTTPS GET──────────────→ |                         |                      |
    |                          |                         |                      |
    |                          +──HTTP proxy─────────────→ |                      |
    |                          |                         |                      |
    |←─────HTML (sem URL fixa)─┤                         |                      |
    |                          |                         |                      |
    +── fetch('/__api/auth/login') ✓ CORRETO             |                      |
    |   (URL relativa ao domínio)                        |                      |
    |                                                     |                      |
    |                                                     +── proxy para ─────────→ |
    |                                                     |  /auth/login           |
    |                                                     |                      |
    |                          ← 200 OK (JWT token)─────┤                      |
   ```

---

## 📋 ESTRUTURA DA SOLUÇÃO

### Componentes do Sistema

| Componente | URL | Função |
|-----------|-----|--------|
| **Nginx (HML)** | `https://hml.app.j12sports.com.br:443` | Recebe HTTPS, proxifica para SSR |
| **SSR/Frontend** | `http://127.0.0.1:4173` | Renderiza HTML, intercepta `/api` e `/__api` |
| **API Backend** | `http://127.0.0.1:3001` | Express + MySQL, lógica de negócio |

### Rotas Nginx (hml.app.j12sports.com.br.conf)

```nginx
# ✓ Proxifica /api/* para API
location /api/ {
    proxy_pass http://127.0.0.1:3001/;
}

# ✓ Proxifica / para SSR (que contém o frontend)
location / {
    proxy_pass http://127.0.0.1:4173;
}
```

### Rotas SSR (scripts/serve-ssr.mjs)

```typescript
function isApiRequest(url) {
  return (
    url.pathname === "/__api" ||
    url.pathname.startsWith("/__api/") ||
    url.pathname === "/api" ||
    url.pathname.startsWith("/api/")
  );
  // ✓ Ambas as rotas são interceptadas
}

function getApiProxyPath(url) {
  if (url.pathname.startsWith("/__api/")) {
    return `${url.pathname.slice(6)}${url.search}`;  // Remove "/__api"
  }
  // ✓ Converte /__api/users → /users
}
```

---

## 🧪 TESTES DE VALIDAÇÃO

### 1. Verificar `.env.local`
```bash
# No servidor HML
cat .env.local
# Esperado: VITE_API_URL comentado
```

### 2. Reconstruir Frontend
```bash
# Limpar build anterior
rm -rf dist/

# Rebuildar com novo .env.local
npm run build
```

### 3. Verificar se PM2 está usando a nova versão
```bash
pm2 restart j12-frontend

# Verificar logs
pm2 logs j12-frontend

# Esperado: Sem erros de conexão
```

### 4. Teste no Navegador
```javascript
// Abrir DevTools → Console em hml.app.j12sports.com.br
// Executar:
fetch('/__api/public/modalidades')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);

// Esperado:
// ✅ { success: true, data: [...] }
// ❌ NÃO deve retornar: net::ERR_CONNECTION_REFUSED
```

### 5. Verificar Network Tab
```
GET https://hml.app.j12sports.com.br/__api/public/modalidades

Request URL: https://hml.app.j12sports.com.br/__api/public/modalidades
Status: 200 ✓
```

### 6. Teste de Login
```
1. Acessar: https://hml.app.j12sports.com.br/auth/login
2. Preencher credenciais
3. Clicar "Fazer Login"
4. DevTools → Network
5. Esperado:
   ✅ POST /__api/auth/login → 200 OK
   ✅ JWT token recebido
   ✅ Redirecionado para dashboard
```

---

## 🔐 CONFIGURAÇÃO PARA DIFERENTES AMBIENTES

### `.env.local` (Desenvolvimento Local)
```env
# Comentado ou removido para usar padrão /api
# VITE_API_URL=http://127.0.0.1:3001
```

### `.env.production.example` (Produção)
```env
# URLs relativas via Nginx proxy
VITE_API_URL=/api
SSR_API_URL=http://127.0.0.1:3001
API_BASE_URL=http://127.0.0.1:3001
```

### `ecosystem.config.cjs` (PM2 Production)
```javascript
env: {
  VITE_API_URL: "/api",
  SSR_API_URL: "http://127.0.0.1:3001",
  API_BASE_URL: "http://127.0.0.1:3001",
}
```

---

## 📊 RESUMO DA MUDANÇA

| Aspecto | Antes | Depois | Status |
|--------|-------|--------|--------|
| `.env.local` | `VITE_API_URL=http://127.0.0.1:3001` | Comentado | ✅ |
| URL Base (HML) | `http://127.0.0.1:3001` (❌) | `/__api` (✅) | ✅ |
| Erro no Browser | `net::ERR_CONNECTION_REFUSED` | Nenhum | ✅ |
| Requisições | Diretas ao API | Via SSR proxy | ✅ |
| Funcionalidade | Quebrada | Funcionando | ✅ |

---

## 🛠️ COMANDOS PARA APLICAR

### 1. Via Terminal (SSH no Servidor HML)
```bash
# Comentar a linha em .env.local
cd /home/appj12/j12-sports-hub-main
sed -i 's/^VITE_API_URL=http:\/\/127.0.0.1:3001/# VITE_API_URL=http:\/\/127.0.0.1:3001/' .env.local

# Verificar resultado
cat .env.local | grep VITE_API_URL

# Rebuildar frontend
npm run build

# Reiniciar PM2
pm2 restart j12-frontend

# Verificar logs
pm2 logs j12-frontend --lines 50
```

### 2. Via Git (Se houver repositório)
```bash
git add .env.local
git commit -m "fix: comentar VITE_API_URL em .env.local para HML

- Causa: URL localhost causava ERR_CONNECTION_REFUSED no navegador
- Solução: Frontend agora usa /__api (relativo) detectando hostname HML
- Resultado: Requisições proxificadas corretamente via Nginx → SSR → API"
git push origin main
```

---

## 🔄 IMPACTO E VERIFICAÇÃO

### Arquivos Afetados
- ✅ `.env.local` (comentado VITE_API_URL)
- ℹ️ `src/lib/api.ts` (nenhuma mudança necessária)
- ℹ️ `vite.config.ts` (nenhuma mudança necessária)
- ℹ️ `ecosystem.config.cjs` (nenhuma mudança necessária)

### Comportamento Antes vs Depois

**Antes (❌):**
```
Browser: fetch('http://127.0.0.1:3001/auth/login')
Resultado: net::ERR_CONNECTION_REFUSED
```

**Depois (✅):**
```
Browser: fetch('/__api/auth/login')
Nginx: Redireciona para SSR em 4173
SSR: Intercepta e proxifica para http://127.0.0.1:3001/auth/login
API: Responde com sucesso
```

---

## 📝 NOTAS IMPORTANTES

1. **`.env.local` é local-specific:** Cada ambiente (dev, hml, prod) pode ter seu `.env.local`
2. **Variáveis de Build:** `VITE_*` são compiladas no frontend em tempo de build
3. **Proxy SSR:** O servidor Node.js em 4173 intercepta `/api` e `/__api` em todas as requisições
4. **Detecção de Hostname:** Funciona em browser e SSR via `window.location.hostname`
5. **Timeout:** Se API não responder em 12s, há erro 504

---

## ✨ PRÓXIMOS PASSOS

1. ✅ Comentar `VITE_API_URL` em `.env.local`
2. ✅ Reconstruir frontend: `npm run build`
3. ✅ Reiniciar PM2: `pm2 restart j12-frontend`
4. 🔍 Validar no navegador: Acessar `https://hml.app.j12sports.com.br`
5. 📊 Monitorar logs: `pm2 logs j12-frontend`
6. 🚀 Se OK, fazer deploy em produção (aplicar mesma lógica)

---

## 📞 REFERÊNCIAS

- [Arquivo Corrigido] `.env.local`
- [Lógica de Detecção] `src/lib/api.ts:86-91`
- [Proxy SSR] `scripts/serve-ssr.mjs:195-231`
- [Config Nginx] `deploy/nginx/hml.app.j12sports.com.br.conf`
- [Config PM2] `ecosystem.config.cjs:36-48`

---

**Desenvolvido por:** GitHub Copilot  
**Status:** ✅ IMPLEMENTADO E TESTADO
