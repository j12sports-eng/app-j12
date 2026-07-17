# Provider Integration Guide
## J12 Sports ERP 3.0 — Command Center

**Versão:** 1.0

**Sprint:** 27.0

**Status:** Oficial

---

# Objetivo

Este documento define o padrão oficial para integração de Providers do Centro de Comando (Command Center).

Todos os domínios deverão seguir exatamente este guia.

O objetivo é garantir:

- consistência arquitetural;
- previsibilidade;
- baixo acoplamento;
- facilidade de testes;
- evolução independente das camadas.

---

# Arquitetura Oficial

```
ERP

↓

API / Store / React Query / Socket

↓

Provider

↓

Adapter

↓

BI Contract

↓

Hook

↓

Dashboard / Widgets
```

Cada camada possui responsabilidade única.

---

# Responsabilidades

## API

Responsável apenas por obter dados.

Não calcula indicadores.

Não monta contratos.

Não aplica regras de apresentação.

---

## Store

Responsável apenas pelo estado compartilhado.

Não monta KPIs.

Não converte contratos.

---

## Provider

Responsável por conectar o ERP ao Command Center.

Pode utilizar:

- APIs
- React Query
- Zustand
- Context
- Socket.IO

Nunca produz componentes React.

Nunca renderiza widgets.

Nunca calcula KPIs de negócio.

---

## Adapter

Responsável apenas por transformar os dados recebidos pelo Provider em contratos oficiais.

Não acessa API.

Não acessa Store.

Não conhece React.

---

## Contract

Representa a linguagem oficial do Centro de Comando.

Todos os contratos devem utilizar o envelope padrão.

```
BIContractEnvelope<TKpis, TData>
```

---

## Hook

Responsável apenas por disponibilizar:

- contract
- loading
- error
- refetch
- lastUpdate

Utiliza TanStack React Query.

Não conhece regras de negócio.

---

# Fluxo Oficial

```
API

↓

Provider

↓

Adapter

↓

BIContractEnvelope

↓

Hook

↓

Dashboard
```

---

# Estrutura Recomendada

```
financial/

provider.ts

adapter.ts

contract.ts

hook.ts

types.ts

index.ts
```

Todos os domínios devem seguir este padrão.

---

# Origem dos Dados (metadata.source)

Cada Provider deve identificar claramente sua origem.

Exemplos:

```
financial-api

students-api

arena-api

championships-api

library-api

socket-financial

command-center-preview
```

Nunca utilizar valores genéricos.

---

# generatedAt

Todo contrato deve possuir:

```
generatedAt
```

Representando o momento da geração do contrato.

Utilizar:

```
new Date().toISOString()
```

Nunca deixar vazio.

---

# Metadata

Todo contrato deve preencher:

```
metadata
```

No mínimo:

```
source

version

environment
```

Exemplo:

```ts
metadata: {
    source: "financial-api",
    version: "1.0",
    environment: "development"
}
```

---

# Capabilities

Representam os recursos disponíveis naquele domínio.

Exemplo:

```ts
capabilities: {
    export: true,
    filters: true,
    realtime: false
}
```

Nunca inventar capacidades.

Representar apenas recursos realmente existentes.

---

# KPIs

Os Providers nunca calculam KPIs.

Os Providers apenas carregam dados.

Os KPIs devem vir:

- já calculados
- ou preparados pelo domínio responsável.

Caso ainda não existam:

```
value: null
```

Jamais utilizar:

```
0
```

como substituição para dado inexistente.

---

# Dados Indisponíveis

Quando um domínio ainda não estiver integrado:

```
value: null
```

Coleções:

```
[]
```

Nunca utilizar dados fictícios.

---

# Erros

Erros devem ser propagados.

Nunca ocultar exceções.

Hooks devem disponibilizar:

```
error
```

React Query será responsável pelo gerenciamento.

---

# React Query

Todos os Hooks devem utilizar:

```
queryKey
```

Obrigatória.

A chave deve representar completamente a consulta.

Exemplo:

```
[
    "financial",
    unitId,
    period,
    filters
]
```

Nunca utilizar queryKeys genéricas.

---

# Cache

Os Providers não definem políticas obrigatórias.

A configuração permanece responsabilidade do consumidor.

Opções permitidas:

- staleTime
- retry
- enabled
- refetchOnWindowFocus

---

# Socket.IO

Caso exista atualização em tempo real:

Socket

↓

Store/API

↓

Provider

↓

Adapter

↓

Hook

Nunca:

Socket

↓

Widget

---

# Feature Flags

Novas integrações deverão respeitar Feature Flags quando aplicável.

Nunca remover funcionalidades legadas durante uma Sprint de integração.

---

# Compatibilidade

O contrato oficial do Centro de Comando é:

```
BIContractEnvelope
```

Não criar novos modelos paralelos.

Não criar contratos duplicados.

Não manter camadas permanentes de compatibilidade.

---

# Checklist de Integração

Antes de considerar um Provider concluído:

- [ ] Provider implementado
- [ ] Adapter implementado
- [ ] Contract válido
- [ ] Hook funcionando
- [ ] queryKey definida
- [ ] generatedAt preenchido
- [ ] metadata preenchida
- [ ] source definida
- [ ] capabilities preenchidas
- [ ] KPIs válidos
- [ ] Sem dados artificiais
- [ ] ESLint OK
- [ ] TypeScript OK
- [ ] Build OK

---

# Critérios de Qualidade

Uma integração somente será considerada concluída quando:

- nenhuma regra de negócio estiver duplicada;
- nenhum KPI for calculado fora do domínio responsável;
- nenhuma camada acessar responsabilidades de outra;
- o contrato oficial for respeitado;
- o Dashboard permanecer desacoplado do ERP.

---

# Roadmap

Ordem recomendada:

1. Financeiro
2. Alunos
3. Turmas
4. Professores
5. Arena
6. Campeonatos
7. Comunicação
8. Biblioteca
9. Portal do Aluno
10. Portal do Responsável