# Rotas Frontend

Mapa das rotas TanStack Router.

## Indice

- [Resumo](#resumo)
- [Rotas Publicas](#rotas-publicas)
- [Rotas Administrativas](#rotas-administrativas)
- [Rotas de Portal](#rotas-de-portal)
- [Rotas de Professor](#rotas-de-professor)
- [Protecao](#protecao)
- [Pontos de Atencao](#pontos-de-atencao)
- [Links Relacionados](#links-relacionados)

## Resumo

As rotas sao file-based em `src/routes` e geram `src/routeTree.gen.ts`.

## Rotas Publicas

- `/`.
- `/login`.
- `/forgot-password`.
- `/reset-password/$token`.
- `/primeiro-acesso`.
- `/matricula`.

## Rotas Administrativas

- `/dashboard`.
- `/dashboard/aluno/$id`.
- `/alunos`.
- `/professores`.
- `/turmas`.
- `/presencas`.
- `/financeiro`.
- `/admin/financeiro`.
- `/planos`.
- `/contratos`.
- `/configuracoes`.
- `/aula-experimental`.

## Rotas de Portal

Aluno:

- `/portal-aluno/*`.

Responsavel:

- `/portal-responsavel/*`.

Tambem existem rotas gerais de self-service:

- `/meu-plano`.
- `/presenca`.
- `/notificacoes`.
- `/perfil`.
- `/trocar-senha`.

## Rotas de Professor

- `/professor/`.
- `/professor/presencas`.

## Protecao

```mermaid
flowchart TD
  Route[Route component] --> Protected[ProtectedRoute/RequireAuth]
  Protected --> Auth{Autenticado?}
  Auth -->|Nao| Login[/login]
  Auth -->|Sim| Role{Papel permitido?}
  Role -->|Nao| Home[homePath]
  Role -->|Sim| Page[Pagina]
```

## Pontos de Atencao

- Algumas rotas gerais mudam comportamento por papel.
- `routeTree.gen.ts` nao deve ser editado.
- Arquivos `src/routes/-*.js` precisam de auditoria.

## Links Relacionados

- [Portais](./PORTAIS.md)
- [Permissoes](../ARQUITETURA/PERMISSOES.md)
- [App Shell](./COMPONENTES.md)

