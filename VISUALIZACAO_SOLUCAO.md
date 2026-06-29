# 🎨 VISUALIZAÇÃO: net::ERR_CONNECTION_REFUSED - Antes vs Depois

---

## 📉 FLUXO ANTES (❌ ERRADO)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                            MÁQUINA DO CLIENTE                            │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  Browser (Chrome, Firefox, Safari)                                 │  │
│  │  ┌──────────────────────────────────────────────────────────────┐  │  │
│  │  │ Acessa: https://hml.app.j12sports.com.br                     │  │  │
│  │  │                                                              │  │  │
│  │  │ HTML recebido com: VITE_API_URL=http://127.0.0.1:3001       │  │  │
│  │  │                                                              │  │  │
│  │  │ Usuario clica: "Fazer Login"                                │  │  │
│  │  │                                                              │  │  │
│  │  │ ❌ fetch('http://127.0.0.1:3001/auth/login')               │  │  │
│  │  │    └─ Tenta conectar a porta 3001 DESTA MÁQUINA             │  │  │
│  │  │       (localhost do cliente, não do servidor!)              │  │  │
│  │  │                                                              │  │  │
│  │  │ RESULTADO: net::ERR_CONNECTION_REFUSED                      │  │  │
│  │  │           └─ Nada escutando em 127.0.0.1:3001               │  │  │
│  │  │                                                              │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  │                                                                    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                     SERVIDOR HML (linux.vps.com)                         │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Nginx (porta 443)                                              │   │
│  │  ├─ listen 443 ssl http2                                        │   │
│  │  ├─ server_name hml.app.j12sports.com.br                        │   │
│  │  └─ Recebe HTTPS de https://hml.app.j12sports.com.br            │   │
│  │     ✓ Cliente recebe HTML (com VITE_API_URL errada)             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  SSR Frontend (Node.js, porta 4173)                             │   │
│  │  ├─ Renderiza HTML                                              │   │
│  │  ├─ Injeta: VITE_API_URL=http://127.0.0.1:3001  ← ERRO!         │   │
│  │  └─ Proxifica /api/* para 127.0.0.1:3001                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  API Backend (Express + MySQL, porta 3001)                      │   │
│  │  ├─ listen 3001                                                 │   │
│  │  ├─ GET /auth/login                                             │   │
│  │  └─ POST /auth/login                                            │   │
│  │     ✗ Browser nunca consegue conectar por causa do erro local   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

     ❌ ERRO: Client tenta acessar localhost da máquina dele
           E não consegue conectar a API do servidor!
```

---

## 📈 FLUXO DEPOIS (✅ CORRETO)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                            MÁQUINA DO CLIENTE                            │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  Browser (Chrome, Firefox, Safari)                                 │  │
│  │  ┌──────────────────────────────────────────────────────────────┐  │  │
│  │  │ Acessa: https://hml.app.j12sports.com.br                     │  │  │
│  │  │                                                              │  │  │
│  │  │ HTML recebido com: VITE_API_URL=undefined (detecta HML)     │  │  │
│  │  │                                                              │  │  │
│  │  │ Usuario clica: "Fazer Login"                                │  │  │
│  │  │                                                              │  │  │
│  │  │ ✓ fetch('/__api/auth/login')                                │  │  │
│  │  │   └─ URL relativa ao domínio atual                           │  │  │
│  │  │      → https://hml.app.j12sports.com.br/__api/auth/login    │  │  │
│  │  │      └─ Faz requisição para MESMO domínio!                   │  │  │
│  │  │         (Nginx/SSR intercepta e proxifica)                   │  │  │
│  │  │                                                              │  │  │
│  │  │ RESULTADO: 200 OK                                           │  │  │
│  │  │           ├─ JWT token recebido                              │  │  │
│  │  │           └─ Login realizado com sucesso!                    │  │  │
│  │  │                                                              │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  │                                                                    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                     SERVIDOR HML (linux.vps.com)                         │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Nginx (porta 443)                                              │   │
│  │  ├─ listen 443 ssl http2                                        │   │
│  │  ├─ server_name hml.app.j12sports.com.br                        │   │
│  │  ├─ Recebe HTTPS de https://hml.app.j12sports.com.br            │   │
│  │  │  ✓ Cliente recebe HTML (SEM VITE_API_URL fixa)              │   │
│  │  │                                                              │   │
│  │  ├─ location / → proxy_pass http://127.0.0.1:4173              │   │
│  │  │  └─ Envia para SSR                                           │   │
│  │  │                                                              │   │
│  │  └─ location /__api/ → proxifica para SSR (que faz outro proxy) │   │
│  │     └─ SSR recebe /__api/* e envia para 127.0.0.1:3001         │   │
│  │                                                                │   │
│  │  ✓ Cliente recebe HTML renderizado                             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  SSR Frontend (Node.js, porta 4173)                             │   │
│  │  ├─ Renderiza HTML                                              │   │
│  │  ├─ Detecta hostname: hml.app.j12sports.com.br                  │   │
│  │  ├─ isHmlBrowserHost() retorna true                             │   │
│  │  ├─ Usa: DEFAULT_HML_BROWSER_API_URL = "/__api"  ✓ CORRETO!    │   │
│  │  │                                                              │   │
│  │  ├─ Intercepta requisições /__api/* ou /api/*                  │   │
│  │  ├─ Converte: /__api/auth/login → /auth/login                  │   │
│  │  └─ Proxifica para http://127.0.0.1:3001/auth/login            │   │
│  │     ✓ Conecta internamente ao backend                           │   │
│  │                                                                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  API Backend (Express + MySQL, porta 3001)                      │   │
│  │  ├─ listen 3001                                                 │   │
│  │  ├─ GET /auth/login                                             │   │
│  │  ├─ POST /auth/login                                            │   │
│  │  │                                                              │   │
│  │  ├─ Valida credenciais                                          │   │
│  │  ├─ Gera JWT token                                              │   │
│  │  ├─ Retorna: { success: true, data: { token: "..." } }         │   │
│  │  │                                                              │   │
│  │  └─ ✓ SSR → Nginx → Browser                                     │   │
│  │     └─ Browser recebe 200 OK com dados!                         │   │
│  │                                                                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

     ✓ SUCESSO: Client faz requisição para MESMO domínio
           E Nginx/SSR a proxifica corretamente para a API!
```

---

## 🔄 COMPARAÇÃO TÉCNICA

```
┌─────────────────────────────────────────────────────────────────────┐
│  ASPECTO            │  ANTES (❌)            │  DEPOIS (✅)          │
├─────────────────────────────────────────────────────────────────────┤
│  .env.local         │  VITE_API_URL=        │  # VITE_API_URL=      │
│                     │  http://127.0.0.1:    │  http://127.0.0.1:    │
│                     │  3001                 │  3001 (comentado)     │
├─────────────────────────────────────────────────────────────────────┤
│  URL Base           │  http://127.0.0.1:    │  /__api               │
│  (detectada)        │  3001 (absoluta)      │  (relativa)           │
├─────────────────────────────────────────────────────────────────────┤
│  fetch URL          │  http://127.0.0.1:    │  https://hml.app...   │
│  (browser)          │  3001/auth/login      │  /__api/auth/login    │
│                     │                       │  (detecta HML)        │
├─────────────────────────────────────────────────────────────────────┤
│  Conecta a          │  Localhost do CLIENTE │  Mesmo domínio HTTPS  │
│                     │  (porta 3001)         │                       │
├─────────────────────────────────────────────────────────────────────┤
│  Resultado          │  ❌ ERR_CONNECTION_   │  ✓ Nginx/SSR          │
│                     │  REFUSED              │  intercepta e         │
│                     │                       │  proxifica             │
├─────────────────────────────────────────────────────────────────────┤
│  API Recebe         │  Nunca chega          │  GET /auth/login      │
│                     │  (erro local)         │  (proxificado por SSR)│
├─────────────────────────────────────────────────────────────────────┤
│  Resposta           │  ❌ Nenhuma           │  ✓ JWT token          │
│                     │                       │  (200 OK)             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 ROTEIROS DE LÓGICA

### isHmlBrowserHost() - Detecção de Ambiente

```typescript
// CÓDIGO EM src/lib/api.ts

function isHmlBrowserHost(): boolean {
  return isBrowser() && HML_FRONTEND_HOSTS.has(window.location.hostname.toLowerCase());
}

// Execução:
window.location.hostname = "hml.app.j12sports.com.br"
HML_FRONTEND_HOSTS = Set(["hml.app.j12sports.com.br"])

HML_FRONTEND_HOSTS.has("hml.app.j12sports.com.br") 
// → true ✓ (detecta HML)
```

### getBrowserApiBaseUrl() - Determinação de URL

```typescript
// CÓDIGO EM src/lib/api.ts

function getBrowserApiBaseUrl(): string {
  const configuredBaseUrl = stripKnownAuthPath(
    normalizeBaseUrl(
      import.meta.env.VITE_API_URL ||        // ❌ undefined (foi comentado)
        import.meta.env.VITE_API_BASE_URL || // ❌ undefined
        import.meta.env.VITE_AUTH_URL,       // ❌ undefined
      getDefaultBrowserApiUrl(),              // ✓ Usa este fallback
    ),
  );

  if (isHmlBrowserHost() && configuredBaseUrl === DEFAULT_BROWSER_API_URL) {
    return DEFAULT_HML_BROWSER_API_URL; // "/__api" ✓
  }

  return configuredBaseUrl;
}

// Execução:
// ANTES: configuredBaseUrl = "http://127.0.0.1:3001" (URL absoluta)
//        → Não entra no if → Retorna URL absoluta ❌

// DEPOIS: configuredBaseUrl = "/api" (URL relativa, do fallback)
//         isHmlBrowserHost() = true ✓
//         → Entra no if ✓
//         → Retorna "/__api" ✓✓✓ CORRETO!
```

### buildApiUrl() - Construção da URL Final

```typescript
// CÓDIGO EM src/lib/api.ts

export function buildApiUrl(endpoint: string): string {
  const normalizedEndpoint = normalizeEndpoint(endpoint);

  if (isAbsoluteHttpUrl(normalizedEndpoint)) {
    return normalizedEndpoint;
  }

  return joinApiUrl(getApiBaseUrl(), normalizedEndpoint);
}

// Execução:
// buildApiUrl('/auth/login')
//   ├─ normalizedEndpoint = '/auth/login'
//   ├─ getApiBaseUrl() = '/__api' (para HML)
//   └─ joinApiUrl('/__api', '/auth/login')
//      └─ return '/__api/auth/login' ✓✓✓

// No Browser:
// fetch('/__api/auth/login')
// → URL relativa do mesmo domínio
// → Nginx/SSR intercepta e proxifica
// → Backend recebe em 127.0.0.1:3001
// → Retorna 200 OK ✓✓✓
```

---

## 📊 TIMELINE DE REQUISIÇÃO

### Antes (❌)
```
t=0ms    Browser carrega https://hml.app.j12sports.com.br
t=100ms  ├─ Nginx redireciona para 127.0.0.1:4173
t=200ms  ├─ SSR renderiza HTML com VITE_API_URL=http://127.0.0.1:3001
t=300ms  ├─ Browser recebe HTML
t=400ms  ├─ Usuario clica "Login"
t=500ms  ├─ Browser tenta: fetch('http://127.0.0.1:3001/auth/login')
t=600ms  ├─ ❌ ERRO: net::ERR_CONNECTION_REFUSED
t=~3000ms └─ Timeout (12s padrão, espera resposta que nunca chega)
```

### Depois (✅)
```
t=0ms    Browser carrega https://hml.app.j12sports.com.br
t=100ms  ├─ Nginx redireciona para 127.0.0.1:4173
t=200ms  ├─ SSR detecta hostname hml.app.j12sports.com.br
t=250ms  ├─ SSR renderiza HTML com baseUrl=/__api (relativa)
t=300ms  ├─ Browser recebe HTML
t=400ms  ├─ Usuario clica "Login"
t=500ms  ├─ Browser tenta: fetch('/__api/auth/login')
t=600ms  ├─ Nginx/SSR intercepta /__api/
t=700ms  ├─ SSR proxifica para 127.0.0.1:3001
t=800ms  ├─ API processa request
t=900ms  ├─ API retorna JWT token
t=1000ms ├─ SSR retorna resposta para Browser
t=1100ms └─ ✓ LOGIN SUCCESSFUL! (200 OK)
```

---

## 🎨 DIAGRAMA DE COMPONENTES

```
┌────────────────────────────────────────────────────────────────────────┐
│                         INFRAESTRUTURA J12                            │
│                                                                        │
│  ┌─ CLIENTE (Browser) ──────────────────┐                             │
│  │                                      │                             │
│  │  fetch('/__api/auth/login')         │  ✓ URL relativa             │
│  │       ↓                              │                             │
│  │  https://hml.app.j12sports.com.br   │  ✓ HTTPS                    │
│  │  /__api/auth/login                   │  ✓ Mesmo domínio            │
│  └──────────┬─────────────────────────┘                             │
│             │                                                         │
│             ↓ (HTTPS)                                                 │
│                                                                        │
│  ┌─ NGINX (porta 443) ────────────────┐                              │
│  │ hml.app.j12sports.com.br            │                             │
│  │                                    │                              │
│  │ Recebe: https://.../__api/auth/... │                             │
│  │                                    │                              │
│  │ location / → 127.0.0.1:4173        │                             │
│  │ location /__api → 127.0.0.1:4173   │                             │
│  │ (proxifica para SSR)                │                             │
│  └──────────┬────────────────────────┘                              │
│             │                                                         │
│             ↓ (HTTP interno)                                          │
│                                                                        │
│  ┌─ SSR Frontend (4173) ──────────────┐                              │
│  │ Node.js (TanStack Start)            │                             │
│  │                                    │                              │
│  │ Intercepta: /__api/...             │                             │
│  │ Converte: /auth/login              │                             │
│  │                                    │                              │
│  │ Proxifica para 127.0.0.1:3001      │                             │
│  │ (getApiProxyPath, proxyHttp)        │                             │
│  └──────────┬────────────────────────┘                              │
│             │                                                         │
│             ↓ (HTTP interno)                                          │
│                                                                        │
│  ┌─ API Backend (3001) ──────────────┐                               │
│  │ Express + MySQL                    │                              │
│  │                                   │                               │
│  │ POST /auth/login                   │                              │
│  │ └─ Valida credenciais              │                              │
│  │ └─ Gera JWT                        │                              │
│  │ └─ Retorna token                   │                              │
│  │                                   │                               │
│  │ Response: { success: true, data }  │                              │
│  └──────────┬────────────────────────┘                              │
│             │                                                         │
│             ↓ (HTTP reverso)                                          │
│                                                                        │
│  ┌─ SSR Frontend (4173) ──────────────┐                              │
│  │ Recebe resposta                    │                              │
│  │ Repassa para Nginx                 │                              │
│  └──────────┬────────────────────────┘                              │
│             │                                                         │
│             ↓ (HTTPS)                                                │
│                                                                        │
│  ┌─ CLIENTE (Browser) ──────────────┐                                │
│  │                                  │                                │
│  │ 200 OK                            │                               │
│  │ { "success": true, "data": {...}} │                               │
│  │                                  │                                │
│  │ ✓ JWT armazenado                  │                               │
│  │ ✓ Redirect para dashboard         │                               │
│  └──────────────────────────────────┘                                │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 CHECKLIST VISUAL

```
ANTES ❌                          DEPOIS ✅
═════════════════════════════════════════════════════════════
.env.local                        .env.local
├─ VITE_API_URL=http://...        ├─ # VITE_API_URL=http://...
│                                 │  └─ COMENTADO ✓
│
Browser                           Browser
├─ fetch('http://127.0.0.1:3001') ├─ fetch('/__api/...')
│  └─ ERRO                         │  └─ OK ✓
│
Nginx                             Nginx
├─ Proxifica para 4173            ├─ Proxifica para 4173
├─ (não consegue ajudar)          ├─ SSR intercepta /__api ✓
│
SSR                               SSR
├─ Renderiza HTML (URL errada)    ├─ Detecta HML ✓
├─ (browser não consegue)         ├─ Usa /__api ✓
│
API                               API
├─ Nunca recebe requisição        ├─ Recebe via proxy ✓
│  (erro local no browser)        │  └─ Retorna 200 OK ✓
```

---

**Visualização Completa:** ✅ Entendimento Total da Solução  
**Status:** ✅ Pronto para Deploy
