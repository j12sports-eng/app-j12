#!/usr/bin/env markdown
# 🎯 SOLUÇÃO RÁPIDA: net::ERR_CONNECTION_REFUSED em HML

---

## ⚡ RESUMO EM 30 SEGUNDOS

| O quê | Resultado |
|------|----------|
| **Problema** | `net::ERR_CONNECTION_REFUSED` em `api.ts:365` |
| **Causa** | `.env.local` com `VITE_API_URL=http://127.0.0.1:3001` |
| **Solução** | Comentar a linha em `.env.local` |
| **Impacto** | Todas as requisições da API funcionam normalmente |
| **Risco** | Muito baixo - mudança simples e reversível |
| **Tempo** | 5 minutos para aplicar + 5 min para rebuild |

---

## 🚀 EXECUTAR AGORA (3 passos)

### Passo 1: Validar
```bash
bash validate-connection-fix.sh
# ou no Windows:
.\validate-connection-fix.ps1
```

### Passo 2: Reconstruir
```bash
npm run build
```

### Passo 3: Reiniciar
```bash
pm2 restart j12-frontend
pm2 logs j12-frontend
```

---

## ✅ VERIFICAR (No Browser)

```javascript
// Abrir console (F12) em https://hml.app.j12sports.com.br

fetch('/__api/public/modalidades')
  .then(r => r.json())
  .then(console.log)

// Esperado: { success: true, data: [...] }
// NÃO deve ser: net::ERR_CONNECTION_REFUSED
```

---

## 📄 DOCUMENTAÇÃO CRIADA

1. **[CORRECAO_ERR_CONNECTION_REFUSED_HML.md](CORRECAO_ERR_CONNECTION_REFUSED_HML.md)** - Completa (técnica)
2. **[DEPLOY_INSTRUÇOES.md](DEPLOY_INSTRUÇOES.md)** - Passo a passo
3. **[VISUALIZACAO_SOLUCAO.md](VISUALIZACAO_SOLUCAO.md)** - Diagramas antes/depois
4. **[SUMARIO_SOLUCAO.md](SUMARIO_SOLUCAO.md)** - Análise detalhada
5. **validate-connection-fix.ps1** - Validação (Windows)
6. **validate-connection-fix.sh** - Validação (Linux)

---

## 🔙 REVERTER (Se Necessário)

```bash
git checkout .env.local
npm run build
pm2 restart j12-frontend
```

---

## 📝 MUDANÇA REALIZADA

**Arquivo:** `.env.local`

```diff
- VITE_API_URL=http://127.0.0.1:3001
+ # VITE_API_URL=http://127.0.0.1:3001
+ # REMOVIDO: Esta URL causava ERR_CONNECTION_REFUSED em HML
```

---

**Status:** ✅ PRONTO PARA DEPLOY  
**Data:** 2026-06-21  
**Desenvolvido por:** GitHub Copilot
