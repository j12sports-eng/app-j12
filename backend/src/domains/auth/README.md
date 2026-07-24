# Dominio Auth

Boundary interna para fundacoes canonicas de autenticacao.

## Estado atual

As Sprints 29.1C.2A e 29.1C.2B adicionaram as fundacoes canonicas de `AuthIdentity` e `UserUnitMembership`.
O fluxo atual de login, sessoes, JWT, `req.user`, `req.auth`, rotas e autorizacao
permanece intacto.

## Fundacao disponivel

- `AuthIdentity`: identidade autenticavel estavel.
- `source`: origem real permitida (`users` ou `j12_usuarios`).
- `sourceUserId`: PK da origem preservada como string.
- `AuthIdentityApplicationService`: resolve ou cria a identidade de forma idempotente.
- Repositories em memoria e MySQL para uso interno/testes.
- `UserUnitMembership`: vinculo canonico usuario-unidade com role, status e default ativo unico.
- `UserUnitMembershipApplicationService`: concede, revoga, desativa, troca role, define default e valida acesso ativo de forma fail-closed.

## Fora desta boundary por enquanto

- Selecao de unidade em login/JWT.
- Alteracao de login/JWT.
- Frontend ou rotas publicas.
