# Padroes Frontend

Padroes para evolucao do frontend J12.

## Indice

- [Objetivo](#objetivo)
- [Componentizacao](#componentizacao)
- [Chamadas de API](#chamadas-de-api)
- [Estados](#estados)
- [Rotas](#rotas)
- [Design System](#design-system)
- [Acessibilidade](#acessibilidade)
- [Qualidade](#qualidade)
- [Links Relacionados](#links-relacionados)

## Objetivo

Manter o frontend consistente, responsivo, tipado e alinhado ao tema premium esportivo da J12.

## Componentizacao

- Componentes base ficam em `components/ui`.
- Componentes de dominio ficam em subpastas.
- Rotas devem orquestrar estado e layout, evitando regra duplicada.
- Reutilizar dialogs, tables, cards e skeletons existentes.

## Chamadas de API

- Usar `src/lib/api.ts` como cliente padrao.
- Evitar `fetch` direto em componentes novos.
- Tipar payloads e respostas.
- Preservar `skipAuthHeader` apenas em endpoints publicos/auth.

## Estados

Todo fluxo remoto deve prever:

- loading.
- erro.
- vazio.
- sucesso.
- retry quando aplicavel.

## Rotas

- Usar TanStack file routes.
- Proteger paginas com `ProtectedRoute` ou `RequireAuth`.
- Nao editar `routeTree.gen.ts`.

## Design System

Tema atual:

- fundo escuro.
- card escuro.
- laranja primario.
- Radix UI + Tailwind.
- classes `j12-*` para superficies, tabela, toolbar, KPI e skeleton.

## Acessibilidade

- Usar `aria-label` em botoes iconicos.
- Manter foco visivel.
- Usar labels em formularios.
- Alt em imagens.
- Garantir navegacao por teclado em dialogs e tabs.

## Qualidade

- Evitar `any`.
- Remover logs de debug antes de producao.
- Corrigir encoding.
- Executar `npm run build` e lint quando alterar frontend.

## Links Relacionados

- [Componentes](./COMPONENTES.md)
- [Estrutura](./ESTRUTURA.md)
- [Auditoria](../REFATORACAO/AUDITORIA.md)

