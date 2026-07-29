# ADR 0007 — Enrollment não aceita unidade proveniente do cliente

## Status

Aceita em 29/07/2026.

## Contexto

O domínio moderno de Enrollment possui ownership persistido em `enrollments.unit_id`, identidade canônica em `auth_identities`, autorização contextual em `user_unit_memberships` e unidade operacional canônica em `j12_unidades`.

O middleware genérico de contexto suporta um reader injetável e pode tratar `x-unit-id` como unidade solicitada, sempre revalidada. Enrollment, porém, contém operações sensíveis de busca de alunos, consulta de DRAFT/ACTIVE, confirmação, convite e formulário digital. Aceitar seleção do cliente ampliaria a superfície para IDOR, mass assignment, fallback acidental e confusão entre role global e role contextual.

Usuários também podem possuir múltiplas memberships. A ordem dos registros não representa consentimento nem escolha segura de unidade.

## Problema

Definir se uma rota moderna de Enrollment pode escolher unidade a partir de body, query, params, header, dados do usuário autenticado, contexto previamente inserido ou inferência de registros enviados pelo cliente.

## Decisão

Enrollment não aceita seleção de unidade proveniente do cliente.

As rotas autenticadas devem usar `createEnrollmentRouteContextComposition`, que injeta `ignoreEnrollmentClientUnitSelection`. O `unitId` é derivado exclusivamente de uma membership ativa persistida:

1. uma única membership default ativa; ou
2. a única membership ativa da identidade.

Zero memberships falha fechado. Múltiplas memberships sem uma única default falham com seleção requerida. A unidade selecionada deve existir, estar ativa e continuar vinculada à identidade na revalidação.

O `ActorContext` resultante é sobrescrito pelo middleware canônico e congelado. Controllers extraem somente `ActorContext.unitContext.unitId`; application services comparam esse valor ao ownership persistido; repositories filtram pela unidade quando a consulta permitir.

IDs e tokens recebidos continuam permitidos como localizadores. Eles nunca são prova de ownership.

## Fontes rejeitadas

- `body.unitId` e `body.unit_id`;
- `query.unitId` e `query.unit_id`;
- `params.unitId` e `params.unit_id`;
- `x-unit-id`;
- `req.auth.unitId` e `req.user.unitId`;
- `globalRole` como bypass de membership;
- primeira membership retornada;
- unidade global/default fora de `user_unit_memberships`;
- ActorContext pré-injetado;
- unidade inferida de dados enviados pelo cliente.

## Alternativas rejeitadas

### Aceitar `x-unit-id` após validar membership

É possível no middleware genérico, mas não há contrato de seleção aprovado para Enrollment. Habilitá-lo agora criaria comportamento divergente das garantias testadas na 29.2E.

### Aceitar unidade em body, query ou params

Mistura comando com autorização contextual, amplia mass assignment e facilita tentativa de acesso cross-unit.

### Usar `req.auth.unitId` ou `req.user.unitId`

Esses objetos representam o usuário autenticado e compatibilidade legada. Não substituem uma membership ativa revalidada.

### Escolher a primeira membership ativa

A ordem do repository não expressa intenção e pode selecionar a unidade errada.

### Permitir bypass para admin global

Role global autoriza apenas a fronteira funcional. Não comprova vínculo com unidade.

### Inferir unidade do Enrollment solicitado

O recurso pode pertencer a outra unidade. Usá-lo para formar o próprio contexto transformaria posse do identificador em autorização.

## Consequências

### Positivas

- o cliente não troca unidade manipulando a requisição;
- a cadeia falha antes do controller quando identidade, membership ou unidade não são comprovadas;
- o mesmo contexto confiável alimenta controller, service e repository;
- unidades distintas permanecem isoladas com seletores hostis idênticos;
- a ausência de fallback torna inconsistências visíveis.

### Custos e limitações

- usuário com múltiplas memberships precisa de uma única default persistida;
- não existe seleção manual de unidade em Enrollment;
- experiência multiunidade futura exigirá nova ADR, contrato explícito e testes hostis;
- integrações internas não podem usar a factory preparada até comporem ActorContext canônico.

## Impacto sobre rotas públicas

Rotas autenticadas sob `/admin/enrollments`, `/api/admin/enrollments`, `/enrollments` e `/api/enrollments` seguem esta ADR.

O convite digital público sob `/api/enrollments/digital-invitations/public/:token` não usa ActorContext. Sua autoridade é o token opaco; o serviço resolve o convite persistido e exige consistência entre `invitation.unitId` e `Enrollment.unitId`. Campos de unidade do cliente continuam sem autoridade.

As rotas legadas `/public/enrollments` e `/api/public/enrollments` estão fora do aggregate moderno e não são cobertas automaticamente por esta decisão.

## Impacto sobre múltiplas memberships

- uma única default ativa é selecionada;
- sem default, uma única membership ativa pode ser selecionada;
- duas ou mais memberships ativas sem default resultam em 409 e nenhuma escolha;
- defaults conflitantes resultam em conflito de estado;
- nenhuma membership é escolhida por ordenação ou fallback.

Seleção manual futura deverá ser explícita, autenticada, revalidada e isolada da entrada de negócio. Até nova decisão, permanece proibida.

## Regra fail-closed

Qualquer ausência ou inconsistência de autenticação, identidade canônica, membership ativa, unidade ativa, ActorContext, ownership persistido ou dependência obrigatória interrompe a operação. O sistema não tenta outra unidade, não usa dados do cliente como fallback e não continua com autorização parcial.

## Referências

- [Fechamento 29.2](../04-BACKEND/SPRINT_29_2_MULTIUNIT_ENROLLMENT_SECURITY.md)
- [ADR 0006](ADR-0006-UNIDADE-CANONICA-E-BLOQUEIO-DE-MEMBERSHIP.md)
- [Composição Enrollment](../../backend/src/domains/enrollments/infrastructure/enrollment-route-context.composition.js)
- [Teste integrado](../../backend/src/domains/enrollments/presentation/routes/enrollment-unit-isolation.integration.test.js)
