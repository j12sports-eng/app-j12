# Sprint 29.1C.2C - UnitContext e ActorContext canonicos

## Escopo

Esta sprint adiciona uma fundacao interna para resolver contexto de unidade e ator autenticado sobre as fundacoes canonicas `AuthIdentity` e `UserUnitMembership`.

Nao foram alterados login, assinatura de JWT, `req.user`, `req.auth`, CORS, rotas, frontend, migrations, `.env`, banco de dados ou VPS.

## Componentes Criados

- `UnitContext`: value object imutavel com `unitId`, `membershipId`, `membershipRole`, `isDefault`, `resolvedBy` e `resolvedAt`.
- `ActorContext`: value object imutavel que combina `AuthIdentity`, `UnitContext`, `requestId` e `correlationId`.
- `AuthenticatedAuthIdentityResolverService`: resolve somente identidade autenticavel ja existente por `source` + `sourceUserId`.
- `UnitContextResolverService`: escolhe unidade de forma deterministica e valida membership ativa mais unidade ativa.
- `ActorContextFactoryService`: constroi `ActorContext` sem conceder autorizacao.
- Middlewares factory `createUnitContextMiddleware` e `createActorContextMiddleware`.
- Composition `createUnitContextComposition`.

## Politica de Resolucao de Unidade

1. Unidade explicitamente solicitada, quando validada por membership ativa e unidade ativa.
2. Membership ativa marcada como default.
3. Membership ativa unica.
4. Multiplas memberships ativas sem default falham com selecao obrigatoria.
5. Nenhuma membership ativa falha fechado.

`x-unit-id` e aceito apenas como contexto solicitado. Ele nao autoriza acesso e sempre e revalidado contra `UserUnitMembership`.

## Garantias de Seguranca

- Nenhum bypass global de admin.
- Nenhum contexto e extraido de JWT como autorizacao de unidade.
- Nenhuma identidade e criada durante resolucao de contexto.
- Falhas sao fail-closed.
- Logs dos novos componentes nao registram `sourceUserId`, PII, headers brutos ou payloads completos.
- Objetos retornados sao imutaveis.
- Campos extras sao rejeitados para reduzir mass assignment.

## Integracao Atual

A infraestrutura foi criada para uso interno futuro, mas nao foi montada globalmente em `server.js`.

CORS permanece sem liberar `X-Unit-Id`. Isso e intencional nesta sprint porque o contexto ainda nao esta operacional em rotas publicas ou globais.

## Fora de Escopo

- Frontend.
- Login.
- Alteracao de JWT.
- Middleware global.
- Novas rotas.
- Migrations.
- Banco de dados.
- Regras finais de autorizacao por funcionalidade.

## Riscos Restantes

- Rotas futuras precisam decidir explicitamente onde acoplar os middlewares.
- A liberacao de `X-Unit-Id` em CORS deve ser feita apenas quando houver endpoint operacional que precise receber selecao de unidade.
- Auditorias futuras devem garantir que handlers nao loguem `req.actorContext.toJSON()` em lugares com politica diferente de auditoria.

## Proximos Passos Sugeridos

- Sprint 29.1C.2D: acoplar `ActorContext` em uma rota interna piloto, mantendo fallback seguro.
- Definir contrato HTTP para selecao de unidade quando houver UI.
- Adicionar guardas de autorizacao por capability/acao sobre `ActorContext`.
