# Roadmap Fase 10 - Matriculas

## Objetivo

Organizar as prioridades tecnicas da Fase 10 apos o baseline arquitetural da
Sprint 10.1. Este roadmap nao altera comportamento; ele define ordem sugerida
para reduzir risco antes de ampliar integracoes reais.

## Prioridades para Sprint 10.2

### P0 - Fechar superficie publica/interna

Estado atual:

```text
admin routes estao montadas e protegidas
public boundary esta montada, mas tambem protegida por permissao de gestao
internal router existe como factory e nao esta montado
```

Recomendacao:

```text
decidir se /enrollments e uma API publica autenticada de aluno/responsavel ou
apenas uma boundary de frontend admin
documentar ou renomear a politica de exposicao antes de abrir qualquer mobile
montar internal router somente se houver namespace interno aprovado
```

Motivo:

```text
evita expor confirmacao, status e dados operacionais para audiencia incorreta
```

### P0 - Versionar e estabilizar artefatos

Estado atual:

```text
o worktree local contem varios arquivos do dominio/documentacao como untracked
```

Recomendacao:

```text
revisar git status
agrupar artefatos por sprint
garantir que migrations, docs e codigo do dominio estejam versionados antes de
novas mudancas
```

Motivo:

```text
sem versionamento formal, o baseline pode divergir do que sera implantado
```

### P1 - Hardening de confirmacao concorrente

Estado atual:

```text
DRAFT tem lock e unique index
confirmacao tem guard logico contra ACTIVE duplicado
confirmacao nao possui lock especifico nem UPDATE condicional por status
```

Recomendacao:

```text
avaliar UPDATE enrollments SET status='ACTIVE' ... WHERE id=? AND status='DRAFT'
ou lock nomeado/transacional para confirmacao
adicionar testes de concorrencia ou simulacao controlada
```

Motivo:

```text
reduz risco em operacoes concorrentes sem mudar o contrato publico
```

### P1 - Definir escopo unit/tenant

Estado atual:

```text
enrollments nao possui unit_id, tenant_id ou branch_id
dashboard operacional esta bloqueado por falta de escopo
```

Recomendacao:

```text
definir fonte oficial de unidade
decidir se Matriculas herda unidade de profile/turma ou guarda propria coluna
planejar migration somente depois da decisao de dominio
```

Motivo:

```text
dashboard, relatorios e permissoes por unidade dependem desse escopo
```

### P1 - Planejar auditoria persistente

Estado atual:

```text
confirmed_at/confirmed_by existem
contrato de audit event seguro existe
nao ha tabela, retencao ou consulta de auditoria completa
```

Recomendacao:

```text
definir tabela de auditoria
definir campos permitidos e payload sanitizado
definir retencao, consulta admin e correlação por requestId
```

Motivo:

```text
operacoes de matricula precisam rastreabilidade antes de integracoes sensiveis
com financeiro e notificacoes
```

### P2 - Preparar links reais de integracao

Estado atual:

```text
Turmas, Financeiro, Agenda e Notificacoes estao em contratos preparatorios
```

Recomendacao:

```text
criar uma sprint por integracao real
definir tabelas de link antes de side effects externos
manter idempotencia e rollback por integracao
```

Motivo:

```text
reduz acoplamento e evita que confirmacao de matricula crie efeitos externos
irreversiveis sem rastreabilidade
```

### P2 - Evoluir frontend administrativo

Estado atual:

```text
tela admin consulta por ids tecnicos
nao ha busca operacional por aluno/perfil dentro da tela de Matriculas
```

Recomendacao:

```text
adicionar busca segura por aluno/perfil quando a API administrativa expuser
endpoint paginado adequado
manter confirmacao protegida por permissoes backend
```

Motivo:

```text
melhora operacao sem alterar dominio de Matriculas
```

### P2 - Mobile/app

Estado atual:

```text
existe summary DTO seguro
nao existe rota mobile nem autenticacao de aluno/responsavel ligada a esse contrato
```

Recomendacao:

```text
definir autenticacao mobile
definir escopo do aluno/responsavel
criar endpoint read-only antes de qualquer acao de matricula pelo app
```

Motivo:

```text
evita exposicao de dados administrativos e preserva a separacao de audiencia
```

## Ordem sugerida

```text
1. Fechar politica de rotas public/admin/internal
2. Versionar baseline e artefatos existentes
3. Hardening de confirmacao concorrente
4. Decidir unit/tenant
5. Projetar auditoria persistente
6. Escolher primeira integracao real
7. Evoluir dashboard ou frontend apenas depois do escopo de unidade
8. Criar mobile read-only apos politica de audiencia
```

## Criterio de entrada para integracoes reais

Antes de acionar Turmas, Financeiro, Agenda ou Notificacoes a partir de
Matriculas:

```text
auditoria persistente definida
idempotencia por integracao definida
rollback operacional documentado
permissao/autenticacao revisadas
testes com banco controlado
logs estruturados com requestId/correlationId
```
