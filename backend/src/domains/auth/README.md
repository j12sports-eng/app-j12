# Dominio Auth

Boundary interna para fundacoes canonicas de autenticacao.

## Estado atual

A Sprint 29.1C.2A adicionou somente a fundacao de `AuthIdentity` canonica.
O fluxo atual de login, sessoes, JWT, `req.user`, `req.auth`, rotas e autorizacao
permanece intacto.

## Fundacao disponivel

- `AuthIdentity`: identidade autenticavel estavel.
- `source`: origem real permitida (`users` ou `j12_usuarios`).
- `sourceUserId`: PK da origem preservada como string.
- `AuthIdentityApplicationService`: resolve ou cria a identidade de forma idempotente.
- Repositories em memoria e MySQL para uso interno/testes.

## Fora desta boundary por enquanto

- Membership por unidade.
- Unidade ativa.
- Selecao de unidade.
- Alteracao de login/JWT.
- Frontend ou rotas publicas.
