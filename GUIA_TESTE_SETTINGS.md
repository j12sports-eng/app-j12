# 🧪 Guia de Teste: Endpoint POST /api/state/settings

## 1. Iniciar o Backend

```powershell
# Terminal 1
cd c:\Users\USER\Desktop\APPJ12\j12-sports-hub-main\backend
npm run dev
```

Você deve ver:
```
✓ [SERVER] API ouvindo em http://0.0.0.0:3001
✓ [DB] Teste de conexão concluído com sucesso
```

---

## 2. Iniciar o Frontend

```powershell
# Terminal 2
cd c:\Users\USER\Desktop\APPJ12\j12-sports-hub-main
npm run dev
```

Você deve ver:
```
VITE v4.x.x ready in xxx ms
```

Acesse: http://localhost:5173

---

## 3. Teste de Login

1. Abrir DevTools (F12)
2. Ir para aba **Console**
3. Fazer login com credenciais de admin

---

## 4. Teste de Persistência de Settings

### Método 1: Via Interface (Recomendado)

1. Após login, navegar para **Settings**
2. Alterar alguma configuração (ex: tema, cor, etc)
3. Clicar em **Salvar**
4. Abrir DevTools → Console
5. Procurar por logs:
   ```
   [RemoteCollection] Persistindo settings: {...}
   [RemoteCollection] ✓ settings persistido com sucesso
   ```

### Método 2: Via Terminal (Teste Manual)

```powershell
# PowerShell

# Prepare payload
$body = @{
    data = @{
        general = @{
            companyName = "J12 Sports"
            phone = "(11) 4000-9000"
        }
        appearance = @{
            mode = "dark"
            primaryColor = "#FF6B00"
        }
    }
} | ConvertTo-Json -Depth 5

Write-Host "Enviando payload:" -ForegroundColor Green
Write-Host $body

# Send request
try {
    $response = Invoke-WebRequest `
        -Uri "http://localhost:3001/api/state/settings" `
        -Method POST `
        -ContentType "application/json" `
        -Headers @{"Authorization" = "Bearer seu-token-aqui"} `
        -Body $body `
        -ErrorAction Stop
    
    Write-Host "`n✓ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Green
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 3
}
catch {
    Write-Host "`n✗ Erro:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    if ($_.Exception.Response) {
        Write-Host "Status: $($_.Exception.Response.StatusCode)"
    }
}
```

---

## 5. Validar Backend Logs

No terminal do backend, você deve ver:

```
[API] POST /api/state/settings
[API] req.body: {
  "data": {
    "general": {
      "companyName": "J12 Sports",
      ...
    },
    "appearance": {...},
    ...
  }
}
[API] req.body.data: (OBJETO GRANDE)
[API] Persistindo settings com payload: {...}
[API] ✓ settings persistido com sucesso
```

---

## 6. Validar Persistência no Banco de Dados

```sql
-- Conectar ao MySQL e executar:
SELECT 
  id,
  name,
  data,
  createdAt,
  updatedAt
FROM collections 
WHERE name = 'settings'
ORDER BY updatedAt DESC
LIMIT 1;
```

Você deve ver a data `updatedAt` atualizada com o timestamp atual.

---

## 7. Teste de Erro Esperado

### Teste com payload inválido (sem 'data')

```powershell
$body = '{"teste":"invalido"}' # SEM 'data'

try {
    $response = Invoke-WebRequest `
        -Uri "http://localhost:3001/api/state/settings" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body
}
catch {
    Write-Host "Status esperado: 400" -ForegroundColor Yellow
    Write-Host $_.Exception.Response.StatusCode
    # Deve retornar 400 com mensagem de erro
}
```

Backend mostrará:
```
[API] Erro 400: Campo 'data' ausente
```

---

## 8. Teste de Refresh (Verificar Persistência)

1. Salvar uma configuração
2. Fechar a aba do browser (ou fazer logout)
3. Reabrir a aplicação e fazer login
4. Ir para Settings
5. **Verificar que a configuração foi mantida**

Se isso funcionar ✅, a persistência está operacional.

---

## 9. Checklist de Validação

- [ ] Backend inicia sem erros
- [ ] Frontend inicia sem erros
- [ ] Login funciona
- [ ] Alteração de settings dispara [RemoteCollection] logs
- [ ] Backend recebe POST /api/state/settings
- [ ] Backend retorna 200 OK
- [ ] Dados aparecem em req.body.data no backend
- [ ] Database foi atualizado
- [ ] Refresh da página mantém as alterações
- [ ] Erro 400 não causa retry infinito
- [ ] Console não tem errors não tratados

---

## 10. Troubleshooting

### Erro: "Envie o campo data para persistir a colecao"

**Causa**: Frontend não está usando novo wrapper
**Solução**: Verificar se arquivo [src/lib/remote-collection.ts](src/lib/remote-collection.ts) foi atualizado corretamente

```typescript
// Deve ser:
const payload = { data: snapshot };
await apiFetch(..., { body: JSON.stringify(payload) });
```

---

### Erro: 401 Unauthorized

**Causa**: Token JWT inválido ou expirado
**Solução**: Fazer login novamente e verificar token no DevTools

---

### Erro: 500 Database Error

**Causa**: Problema na conexão com MySQL
**Solução**: 
1. Verificar credentials em `.env`
2. Verificar conexão: `ping 108.167.168.27`
3. Reiniciar backend

---

### Logs não aparecem

**Causa**: Console.log pode estar oculto em produção
**Solução**: Verificar NODE_ENV=development em .env

---

## 11. Performance Esperada

- Login: 1-2s
- Alteração de settings: <500ms
- Persistência no backend: <100ms
- Update no database: <200ms
- **Total**: <1s (com latência de rede)

Se demorar mais que 3s, há problema de conexão.

---

## 12. Próximas Melhorias (Futuro)

- [ ] Implementar versionamento de settings
- [ ] Adicionar rollback de alterações
- [ ] Sync de settings entre abas do browser
- [ ] Histórico de alterações
- [ ] Notificação quando settings mudarem em outro lugar

---

**Última atualização**: 2024-12-19
**Status**: ✅ Pronto para teste
