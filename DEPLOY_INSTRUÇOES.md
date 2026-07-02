# 🚀 DEPLOY: Correção net::ERR_CONNECTION_REFUSED

## 📌 RESUMO EXECUTIVO

**Problema:** Erro `net::ERR_CONNECTION_REFUSED` na linha 365 de `api.ts`  
**Causa:** `.env.local` com URL localhost incorreta para HML  
**Solução:** Comentar `VITE_API_URL=http://127.0.0.1:3001` em `.env.local`  
**Status:** ✅ PRONTO PARA DEPLOY

---

## 📦 ARQUIVOS MODIFICADOS

### ✏️ Modificado
- **`.env.local`** - Comentada linha com VITE_API_URL

### 📄 Criados (Documentação)
- **`CORRECAO_ERR_CONNECTION_REFUSED_HML.md`** - Documentação técnica completa
- **`validate-connection-fix.ps1`** - Script de validação (Windows)
- **`validate-connection-fix.sh`** - Script de validação (Linux/Unix)
- **`DEPLOY_INSTRUÇOES.md`** - Este arquivo

---

## 🎯 PASSO A PASSO: COMO APLICAR

### Opção 1: Via Terminal (Linux/SSH)

```bash
# 1. Conectar ao servidor HML
ssh usuario@hml.app.j12sports.com.br

# 2. Ir para o diretório do projeto
cd /home/appj12/j12-sports-hub-main

# 3. Validar a correção
bash validate-connection-fix.sh

# 4. Se OK, reconstruir o frontend
npm run build

# 5. Reiniciar PM2
pm2 restart j12-frontend

# 6. Monitorar os logs
pm2 logs j12-frontend

# 7. Se houver erro, revert
git checkout .env.local
npm run build
pm2 restart j12-frontend
```

### Opção 2: Via PowerShell (Windows)

```powershell
# 1. No Visual Studio Code ou terminal
cd "c:\Users\USER\Desktop\APPJ12\j12-sports-hub-main"

# 2. Validar a correção
.\validate-connection-fix.ps1

# 3. Se OK, fazer commit (se usar Git)
git add .env.local
git commit -m "fix: comentar VITE_API_URL em .env.local para HML"
git push origin main

# 4. No servidor HML via SSH:
ssh usuario@hml.app.j12sports.com.br
cd /home/appj12/j12-sports-hub-main
git pull origin main
npm run build
pm2 restart j12-frontend
pm2 logs j12-frontend
```

### Opção 3: Manual (Se preferir não usar scripts)

```bash
# 1. Abrir arquivo .env.local no editor
nano .env.local

# 2. Encontrar a linha:
# VITE_API_URL=http://127.0.0.1:3001

# 3. Comentar (adicionar # no início):
# # VITE_API_URL=http://127.0.0.1:3001

# 4. Salvar (Ctrl+X, Y, Enter)

# 5. Compilar e reiniciar
npm run build
pm2 restart j12-frontend
```

---

## ✅ VERIFICAÇÃO APÓS DEPLOY

### 1. Verificar Arquivo
```bash
# Confirmar que a linha está comentada
grep -n "VITE_API_URL" .env.local

# Esperado:
# 1: # VITE_API_URL=http://127.0.0.1:3001
```

### 2. Verificar PM2
```bash
# Ver status dos processos
pm2 status

# Ver logs
pm2 logs j12-frontend --lines 50

# Esperado: Sem erros de conexão
```

### 3. Verificar no Navegador

**URL:** `https://hml.app.j12sports.com.br`

**Passos:**
1. Abrir DevTools (F12)
2. Ir para aba "Console"
3. Executar:
```javascript
fetch('/__api/public/modalidades')
  .then(r => r.json())
  .then(d => console.log('✓ Sucesso:', d))
  .catch(e => console.log('✗ Erro:', e.message))
```

**Esperado:**
```
✓ Sucesso: {success: true, data: [...]}
```

**NÃO deve ser:**
```
✗ Erro: Failed to fetch
✗ Erro: net::ERR_CONNECTION_REFUSED
```

### 4. Verificar Network Tab

1. F12 → Network
2. Recarregar página
3. Procurar por requisições a `/__api/` ou `/api/`
4. Status deve ser: **200 OK** ✓
5. **NÃO deve ser:** 502, 503, ERR_FAILED

---

## 🔄 ROLLBACK (Se algo der Errado)

### Desfazer a Mudança
```bash
# Opção 1: Git
git checkout .env.local

# Opção 2: Manual
# Abrir .env.local e descommentar:
# VITE_API_URL=http://127.0.0.1:3001

# Recompilar
npm run build
pm2 restart j12-frontend
```

---

## 📊 CHECKLIST DE DEPLOY

- [ ] `.env.local` editado (VITE_API_URL comentado)
- [ ] Validação passou: `validate-connection-fix.sh` ou `.ps1`
- [ ] Build reconstruído: `npm run build`
- [ ] PM2 reiniciado: `pm2 restart j12-frontend`
- [ ] Logs verificados: `pm2 logs j12-frontend` (sem erros)
- [ ] Teste no navegador passou (fetch `/__api/...` retorna 200)
- [ ] Network tab mostra 200 OK para requisições da API
- [ ] Login funciona corretamente
- [ ] Dashboard carrega sem erros

---

## 🔐 SEGURANÇA

✅ **Sem impacto de segurança:**
- Mudança é apenas em arquivo de configuração
- Não afeta banco de dados
- Não afeta credenciais
- Não afeta SSL/TLS
- Frontend continua usando HTTPS via Nginx

---

## 📞 SUPORTE

Se o erro persistir após o deploy:

1. **Confirmar que `.env.local` foi modificado:**
   ```bash
   cat .env.local | grep VITE_API_URL
   ```

2. **Confirmar que build foi reconstruído:**
   ```bash
   ls -la dist/client/ | head -5
   ```

3. **Verificar PM2 logs:**
   ```bash
   pm2 logs j12-frontend --lines 100
   ```

4. **Se build falhar:**
   ```bash
   npm install
   npm run build
   ```

5. **Se PM2 falhar:**
   ```bash
   pm2 restart j12-api j12-frontend
   pm2 delete ecosystem.config.cjs
   pm2 start ecosystem.config.cjs
   ```

---

## 📈 IMPACTO

| Métrica | Antes | Depois |
|---------|-------|--------|
| Erro no Browser | ❌ ERR_CONNECTION_REFUSED | ✅ Requisições normais |
| Funcionalidade | ❌ Quebrada | ✅ Funcionando |
| URL Base | ❌ http://127.0.0.1:3001 | ✅ /__api |
| Proxy | ❌ Direto ao API | ✅ Via SSR → Nginx |
| Timeout | ❌ Imediato | ✅ 12 segundos |

---

## 🎓 CONCEITOS

**Por que `/api` não funciona em HML?**
- Frontend rodando em `hml.app.j12sports.com.br` (HTTPS)
- API Backend em `http://127.0.0.1:3001` (HTTP, localhost)
- Browser bloqueia requisições cross-protocol
- Nginx proxifica para manter o mesmo domínio

**Como `/__api` funciona?**
- URL relativa ao domínio: `https://hml.app.j12sports.com.br/__api/...`
- Nginx ou SSR intercepta e converte para `http://127.0.0.1:3001/...`
- Browser permite porque é mesmo domínio/protocolo

---

## 📋 REFERÊNCIAS TÉCNICAS

- [Arquivo Corrigido] `.env.local`
- [Lógica Principal] `src/lib/api.ts` (linhas 86-91, 169-178)
- [Proxy SSR] `scripts/serve-ssr.mjs` (linhas 113-231)
- [Config Nginx] `deploy/nginx/hml.app.j12sports.com.br.conf`
- [Config PM2] `ecosystem.config.cjs`
- [Documentação] `CORRECAO_ERR_CONNECTION_REFUSED_HML.md`

---

## ✨ PRÓXIMAS ETAPAS

1. **Imediato:**
   - [ ] Aplicar mudança em `.env.local`
   - [ ] Validar com script
   - [ ] Deploy em HML

2. **Curto Prazo:**
   - [ ] Monitorar logs por 24 horas
   - [ ] Testar todos os endpoints
   - [ ] Validar de múltiplos clientes

3. **Médio Prazo:**
   - [ ] Documentar processo
   - [ ] Atualizar runbooks
   - [ ] Treinar time

4. **Longo Prazo:**
   - [ ] Revisar outras env vars
   - [ ] Implementar CI/CD checks
   - [ ] Consolidar documentação

---

**Status Final:** ✅ PRONTO PARA DEPLOY
**Data:** 2026-06-21
**Desenvolvido por:** GitHub Copilot
