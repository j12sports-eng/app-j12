# Estrutura Frontend

Referencia da estrutura React/Vite/TanStack Start.

## Indice

- [Resumo](#resumo)
- [Pastas Principais](#pastas-principais)
- [Bootstrap](#bootstrap)
- [Roteamento](#roteamento)
- [Estilos](#estilos)
- [Assets](#assets)
- [Pontos de Atencao](#pontos-de-atencao)
- [Links Relacionados](#links-relacionados)

## Resumo

O frontend usa React 19, Vite, TanStack Router/Start, TailwindCSS 4, Radix UI, shadcn-like components e stores customizadas em `src/lib`.

## Pastas Principais

```text
src/
  assets/
  components/
  hooks/
  lib/
  routes/
  stores/
  styles.css
  router.tsx
  routeTree.gen.ts
```

## Bootstrap

- `src/router.tsx`: cria o router TanStack.
- `src/routes/__root.tsx`: define HTML base, providers, head e fallback 404.
- `vite.config.ts`: TanStack Start, React, Tailwind e proxy `/api`, `/__api`, `/socket.io`.

## Roteamento

Rotas file-based em `src/routes`. `routeTree.gen.ts` e gerado automaticamente pelo TanStack Router.

## Estilos

`src/styles.css` define tema escuro com:

- Preto/cinza escuro como base.
- Laranja como cor primaria.
- Classes utilitarias `j12-*`.
- TailwindCSS 4 com tokens CSS.

## Assets

Principais:

- `src/assets/logo.png`.
- `src/assets/login-j12-jessiquinha.png`.

## Pontos de Atencao

- Ha textos com encoding quebrado em varios arquivos.
- `routeTree.gen.ts` e gerado e nao deve ser editado manualmente.
- Existem arquivos de rota com prefixo `-` que devem ser auditados antes de uso.

## Links Relacionados

- [Rotas Frontend](./ROTAS.md)
- [Componentes](./COMPONENTES.md)
- [Estado Global](./ESTADO_GLOBAL.md)

