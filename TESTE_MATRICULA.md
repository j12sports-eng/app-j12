# 🧪 GUIA DE TESTE - Carregamento de Modalidades, Unidades e Horários

## ✅ O que foi corrigido

A página de matrícula agora carrega **automaticamente** dados cadastrados:
- ✅ Modalidades (GET `/api/public/modalidades`)
- ✅ Unidades (GET `/api/public/unidades`)
- ✅ Horários/Turmas (GET `/api/public/turmas`)

## 🚀 Como Testar

### 1️⃣ Iniciar o Backend
```bash
npm run dev:backend
# ou
node backend/server.js
```

### 2️⃣ Iniciar o Frontend
```bash
npm run dev:frontend
# ou
npm run dev
```

### 3️⃣ Ir para a Página de Matrícula
```
http://localhost:5173/matricula
```

### 4️⃣ Navegar até a Etapa 5 - "Informações Esportivas"
- Clique em "Próxima etapa" até chegar na etapa de esportivas
- Ou clique diretamente no card "Informações Esportivas" na sidebar

## 🔍 O Que Você Verá

### ✨ Etapa de Carregamento
- Spinner giratório ao lado de "Modalidades", "Unidades", "Horários"
- Mensagem: "Carregando modalidades, unidades e horários..."

### ✅ Após Carregamento
**Se dados existem no banco:**
- Cards de seleção aparecem para cada modalidade
- Cards de seleção aparecem para cada unidade
- Cards de seleção aparecem para cada turma/horário

**Se houver erro:**
- Mensagem: "Erro ao carregar dados cadastrados. Tentando novamente..."
- Tentativa automática 2x

**Se não houver dados:**
- Mensagem: "Nenhuma modalidade disponível"
- Verifique se cadastrou dados em "Configurações" → "Modalidades"

## 🎯 Filtros em Cascata (Teste)

1. **Selecione uma Modalidade**
   - Unidades se filtram automaticamente
   - Horários se atualizam

2. **Selecione uma Unidade**
   - Horários se filtram pela combinação Modalidade + Unidade

3. **Observe a Filtragem**
   - Se não houver turma para a combinação: "Nenhum horário disponível..."

## 🐛 Debug - Verificar Logs no Console

Abra o **DevTools** (F12) → **Console**

Você verá logs como:
```javascript
[HOOK] Carregando modalidades públicas...
[HOOK] Modalidades carregadas: 3
[MATRICULA DEBUG]
  - isLoadingCatalog: false
  - consolidatedModalidades: [...]
  - consolidatedUnidades: [...]
  - consolidatedTurmas: [...]
  - modalityOptions: ["Futebol", "Natação", ...]
  - unitOptions: ["Unidade Centro", "Unidade Sul", ...]
  - horarioOptions: [...]
```

## 📊 Verificar Network (Aba Network)

Procure por requisições GET:
- `GET /api/public/modalidades` - Status 200
- `GET /api/public/unidades` - Status 200
- `GET /api/public/turmas` - Status 200

Se retorna **401 Unauthorized**: Backend ainda está bloqueando. Verifique se:
- Arquivo `backend/src/routes/public.routes.js` foi atualizado
- Arquivo `backend/src/controllers/public-catalog.controller.js` existe
- Backend foi reiniciado após as mudanças

## 🔧 Se não funcionar

### Problema 1: "Nenhuma modalidade disponível"
**Solução:** Cadastre dados em Configurações:
1. Acesse `http://localhost:5173/settings`
2. Clique em "Modalidades"
3. Adicione uma nova modalidade (ex: "Futebol")
4. Clique em "Turmas"
5. Adicione uma nova turma com:
   - Nome: "Turma A"
   - Modalidade: "Futebol"
   - Unidade: "Centro"
   - Horário: "19:00 - 20:30"
   - Status: "Ativo"

### Problema 2: Spinner não desaparece
**Solução:** 
- Verifique console (F12) para erros
- Cheque se backend está rodando
- Tente recarregar a página

### Problema 3: "Erro ao carregar dados"
**Solução:**
- Verifique Network (F12 → Network)
- Se erro 401: Backend precisa ser reiniciado
- Se erro 500: Verifique logs do backend
- Tente fazer reload da página

## ✅ Testes de Validação

- [ ] Modalidades aparecem após carregamento
- [ ] Unidades aparecem após carregamento
- [ ] Horários aparecem após filtrar
- [ ] Seleção de modalidade filtra unidades
- [ ] Seleção de unidade filtra horários
- [ ] Mensagens de erro aparecem corretamente
- [ ] Spinner mostra durante carregamento
- [ ] Pode prosseguir após seleção
- [ ] Dados persistem ao voltar etapas

## 📝 Notas

- ⚠️ Logs de debug (`console.log`) devem ser removidos antes de produção
- ⚠️ Cache de React Query: 5 minutos (staleTime) + 10 minutos (gcTime)
- ⚠️ Retry automático: 2 tentativas em caso de erro
- ⚠️ Consolidação de dados: PUBLIC > SETTINGS > LOCAL

## 🎓 Próximos Passos

Após validar o funcionamento:
1. Remover logs de debug do arquivo `src/routes/matricula.tsx`
2. Testar com múltiplas modalidades/unidades/turmas
3. Testar performance com 100+ turmas
4. Considerar pré-carregar dados ao montar página
5. Adicionar analytics para rastrear uso
