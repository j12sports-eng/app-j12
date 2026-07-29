# Sprint 29.2 — Segurança multiunidade do domínio Enrollment

## 1. Objetivo

Consolidar o estado arquitetural e as garantias de segurança multiunidade do domínio moderno de Enrollment após as Sprints 29.2A a 29.2F.

Enrollment autenticado opera com identidade canônica, membership persistida e unidade ativa. A unidade efetiva não é escolhida pelo cliente: ela é resolvida no servidor, materializada em `UnitContext`, incorporada a um `ActorContext` imutável e revalidada contra o ownership persistido antes de leituras ou mudanças de estado.

Este documento descreve o código no HEAD `3df1189d` da branch `sprint-23`, auditado em 29/07/2026. A Sprint 29.2F é exclusivamente documental: não aplica migrations, não altera banco, não monta rotas e não realiza deploy.

## 2. Escopo consolidado

| Sprint | Evidência | Entrega consolidada |
| --- | --- | --- |
| 29.2A | Commit `1fbe1496` | Define a FK `enrollments.unit_id -> j12_unidades.id` em migration manual. O artefato não comprova aplicação em ambiente. |
| 29.2B | Commit `6cdb3378` | Propaga e valida ownership no application service, convite, criação/reuso de DRAFT e formulário digital. |
| 29.2C | Commit `7fd5c6a6` | Cria o extrator confiável de Enrollment e remove unidade do cliente das fronteiras. |
| 29.2D | Commit `e21e4f52` | Compõe `ActorContext` nas rotas autenticadas montadas e injeta reader que ignora seleção do cliente. |
| 29.2E | Commit `3df1189d` | Testa de forma integrada o isolamento nas cadeias montadas; gate registrado de 549/549 testes de Enrollment. |
| 29.2F | Este documento e ADR 0007 | Fecha arquitetura, matrizes, limites e critérios anteriores a produção. |

As entregas complementam as fundações anteriores de `auth_identities`, `user_unit_memberships`, convite, formulário, documentos e contrato digital.

## 3. Arquitetura canônica

```text
Usuário autenticado e relido da persistência
→ Auth Identity existente e ativa
→ Membership ativa persistida
→ Unidade existente e ativa em j12_unidades
→ UnitContext imutável
→ ActorContext imutável
→ Controller
→ EnrollmentFacade / Application Service
→ Repository
→ Banco
```

### 3.1 Autenticação e identidade

`requireAuth`, em `backend/auth.js`, extrai o Bearer token e chama `getUserBySessionToken`. JWTs são verificados e o usuário é relido de `users` ou `j12_usuarios`; sessões opacas são validadas em `user_sessions`. O resultado sanitizado é atribuído ao mesmo objeto em `req.user` e `req.auth`.

`AuthenticatedAuthIdentityResolverService` usa `source + sourceUserId` para localizar uma `auth_identities` existente. `AuthIdentityApplicationService.findBySourceUser` revalida o usuário da origem, exige status ativo e rejeita identidade ausente ou desabilitada. A resolução de contexto não cria identidade implicitamente.

### 3.2 Membership e unidade

`user_unit_memberships` vincula `auth_identity_id` a `j12_unidades.id`, com `role`, `status` e `is_default`. FKs ligam a membership à identidade, unidade e atores de criação/revogação. Índices únicos impedem duplicidade identidade–unidade e mais de uma default ativa por identidade.

`UnitContextResolverService` lista memberships ativas e, para Enrollment, recebe `requestedUnitId = null`. Seleciona uma única default ativa ou a única membership ativa; rejeita ausência, defaults conflitantes e múltiplas memberships sem default. Depois consulta `j12_unidades`, exige unidade ativa e revalida a membership exata unindo membership, identidade e unidade ativas.

Não há fallback para unidade global, primeira membership, `unidades` legada ou unidade presente no usuário autenticado.

### 3.3 Contextos produzidos

`UnitContext` contém exatamente `unitId`, `membershipId`, `membershipRole`, `isDefault`, `resolvedBy` e `resolvedAt`.

`ActorContext` contém `authIdentityId`, `source`, `sourceUserId`, `unitContext`, `membershipRole`, `requestId`, `correlationId` e, quando disponíveis, `authenticatedAt`, `issuedAt` e `globalRole`. As entidades e seus DTOs são congelados. A composição sobrescreve qualquer `req.actorContext` anterior.

### 3.4 Composição específica e cadeia real

O middleware genérico preserva suporte injetável a um reader e, por padrão, pode interpretar `x-unit-id` apenas como unidade solicitada a ser revalidada. Enrollment é mais restritivo: `createEnrollmentRouteContextComposition` injeta `ignoreEnrollmentClientUnitSelection`, que sempre retorna `null`.

Nas rotas modernas autenticadas:

```text
requisição
→ requireAuth
→ ensureEnrollmentAdminAccess ou ensureEnrollmentPublicAccess
→ createEnrollmentActorContextMiddleware
   → Auth Identity → membership → unidade → ActorContext
→ controller → facade/service → repository → persistência
```

`canManageSystem` protege a fronteira global para admin/coordenador, mas não concede unidade. A autorização por unidade vem da membership. A decisão completa está na [ADR 0007](../ADR/ADR-0007-ENROLLMENT-NAO-ACEITA-UNIDADE-DO-CLIENTE.md).

## 4. Fontes confiáveis

| Dado | Fonte canônica | Validação | Falha |
| --- | --- | --- | --- |
| Usuário | Usuário relido de `users`/`j12_usuarios` | `getUserBySessionToken` e `requireAuth` | 401 |
| `authIdentityId` | `auth_identities.id` por `source + sourceUserId` | Resolver e `AuthIdentityApplicationService` | 403 se ausente/inativa |
| Membership | `user_unit_memberships` ativa | Service e repository de membership | 403/409 |
| `unitId` | `membership.unit_id` validado em `j12_unidades` | `UnitContextResolverService` e `checkActiveMembership` | 403/409 |
| Role contextual | `user_unit_memberships.role` | `UnitContext`, `ActorContext` e guards | Ação rejeitada |
| `enrollmentId` | ID é só localizador; ownership vem da linha `enrollments` | Service compara `Enrollment.unitId`; repository filtra reads por aluno | Indisponível/conflito |
| Ownership de Enrollment | `enrollments.unit_id` | Entidade, service, repository e FK definida na 29.2A | Linha sem unidade/mismatch bloqueada |
| Ownership do convite | `enrollment_digital_invitations.unit_id` + FK ao Enrollment | Service compara convite, Enrollment e contexto | Resposta genérica/controlada |
| Template de contrato | `digital_enrollment_contract_templates.unit_id` | Entidade; selector ainda não canônico | Serviço bloqueado em 503 |
| Contrato | FKs para Enrollment, template e relacionamento; aceite também referencia convite | Fundação de entidade/migration | Sem operação HTTP ativa |

## 5. Fontes proibidas

| Fonte | Regra | Motivo |
| --- | --- | --- |
| `body.unitId` / `body.unit_id` | Nunca escolhe unidade | Payload controlado pelo cliente |
| `query.unitId` / `query.unit_id` | Nunca escolhe unidade | Query controlada pelo cliente |
| `params.unitId` / `params.unit_id` | Nunca escolhe unidade | Params não provam membership |
| `x-unit-id` | Ignorado em Enrollment | A composição específica injeta reader nulo |
| `req.auth.unitId` / `req.user.unitId` | Nunca escolhe unidade | Usuário global/legado não é autorização contextual |
| Fallback/unidade global | Proibido | Ocultaria configuração ausente |
| Primeira membership | Proibida | Ordem não é decisão de autorização |
| ActorContext pré-injetado | Sobrescrito | Pode ser não confiável |
| Unidade de registro enviado pelo cliente | Proibida | Ownership deve ser relido da persistência |

IDs e tokens recebidos são localizadores, nunca prova de ownership.

## 6. Matriz de rotas

### 6.1 Modernas montadas

| Rota | Montada | Auth/autorização | ActorContext | Unidade | Pública | Observações |
| --- | --- | --- | --- | --- | --- | --- |
| `GET /admin/enrollments/students/search` e `/api/...` | Sim | `requireAuth` + admin access | Sim | Membership | Não | Busca por aluno ignora unidade hostil |
| `GET /admin/enrollments/{status,current-draft,current-active}` e `/api/...` | Sim | `requireAuth` + admin access | Sim | Membership | Não | Reads filtrados por unidade |
| `POST /admin/enrollments/:enrollmentId/confirm` e `/api/...` | Sim | `requireAuth` + admin access | Sim | Membership | Não | Compara ownership persistido |
| `GET /enrollments/{status,current-draft,current-active}` e `/api/...` | Sim | `requireAuth` + public access gerencial | Sim | Membership | Não | `public` é nome de boundary, não acesso anônimo |
| `POST /enrollments/:enrollmentId/confirm` e `/api/...` | Sim | `requireAuth` + public access gerencial | Sim | Membership | Não | Mesmo service do admin |
| `GET /api/enrollments/digital-invitations/public/:token` | Sim | Token opaco | Não | Convite + Enrollment persistidos | Sim | Sem alias sem `/api` |
| `GET /api/enrollments/digital-invitations/public/:token/{form,review}` | Sim | Token opaco | Não | Convite + Enrollment | Sim | Consulta formulário/revisão |
| `PATCH /api/enrollments/digital-invitations/public/:token/{responsible,student,address,additional-information}` | Sim | Token opaco | Não | Convite + Enrollment | Sim | Passos allowlisted |
| `POST /api/enrollments/digital-invitations/public/:token/advance` | Sim | Token opaco | Não | Convite + Enrollment | Sim | Avanço sequencial |
| `POST/GET /api/enrollments/digital-invitations/public/:token/documents` | Sim | Token opaco | Não | Convite + Enrollment | Sim | Upload/listagem |
| `DELETE /api/enrollments/digital-invitations/public/:token/documents/:id` | Sim | Token opaco | Não | Convite + Enrollment | Sim | Exclusão validada |
| `GET /api/enrollments/digital-invitations/public/:token/documents/:id/download` | Sim | Token opaco | Não | Convite + Enrollment | Sim | Download validado |

### 6.2 Preparadas, não montadas e legadas

| Rota/fábrica | Montada | Estado/observação |
| --- | --- | --- |
| `POST /admin/enrollments/:enrollmentId/digital-invitations` | Não | Preparada com `requireAuth → UnitContext → ActorContext → role guard → controller` |
| `POST /admin/enrollments/:enrollmentId/digital-invitations/{renew,revoke}` | Não | Mesma cadeia; ausente de `server.js` |
| `GET /admin/enrollments/:enrollmentId/digital-invitations/current` | Não | Preparada; não confundir com router admin montado |
| `/internal/enrollments/*` | Não | Factory existe sem composição ActorContext; controllers falham fechado |
| Rotas de template/contrato/aceite | Não existem | Fundação bloqueada até seleção canônica de template |
| `GET /public/enrollments/next-number` e `/api/public/...` | Sim | Legada, fora do domínio moderno |
| `POST /public/enrollments` e `/api/public/...` | Sim | Legada; persiste em `j12_alunos` e `j12_matriculas_publicas` |

## 7. Matriz de operações

| Operação | Controller | Service/facade | Repository/gateway | Origem da unidade | Ownership e fail-closed |
| --- | --- | --- | --- | --- | --- |
| Buscar alunos | `EnrollmentAdminController.searchStudentScopes` | `EnrollmentApplicationService.searchStudentScopes` | `MySqlEnrollmentRepository.searchStudentScopes` | ActorContext | SQL exige unidade; sem contexto não consulta |
| Status | Controllers `getStatus` | `getEnrollmentStatusSummary` | `findDraftByStudent` + `findActiveByStudent` | ActorContext | Ambos os reads exigem unidade exata |
| DRAFT atual | Controllers `getCurrentDraft` | `findCurrentDraftEnrollment` | `findDraftByStudent` | ActorContext | SQL/mapper rejeitam cross-unit e `NULL` legado |
| ACTIVE atual | Controllers `getCurrentActive` | `findCurrentActiveEnrollment` | `findActiveByStudent` | ActorContext | Nunca retorna outra unidade |
| Criar/reusar DRAFT | Fronteira interna | Student/Enrollment application service | `createDraftIfNotExists` | Contexto confiável | Lock, busca, insert e retry incluem unidade |
| Confirmar | Controllers `confirmDraft` | `confirmDraftEnrollment` | `findById`, reads e `updateStatus` | ActorContext separado do comando | Mismatch não atualiza status |
| Convite admin | Controller admin não montado | Admin service → invitation service | Repositories de Enrollment/convite | ActorContext | Compara contexto, Enrollment e convite |
| Convite público | Public controller | Resolve service → invitation service | Repositories de convite/Enrollment | Token resolve persistência | Mismatch e estados inválidos têm resposta genérica |
| Formulário digital | Form controller | Form application service | Form gateway + invitation resolver | Convite persistido | Revalida convite, DRAFT, relação e unidade |
| Documentos | Document controller | Document service | Gateway, repository e storage | Convite persistido | Falha antes do documento sem ownership |
| Template/contrato | Sem controller | `DigitalEnrollmentContractService` | Fundação sem fluxo operacional | Deverá vir da persistência | Bloqueador canônico; não cria nem aceita contrato |

### 7.1 Isolamento dos repositories

- `MySqlEnrollmentRepository` persiste `unit_id`, projeta BIGINT como string, filtra DRAFT/ACTIVE/busca pela unidade e revalida o mapper.
- O lock de DRAFT inclui unidade; retry não reutiliza outra unidade nem `unit_id NULL`.
- `MySqlUserUnitMembershipRepository.checkActive` exige membership, identidade e unidade ativas.
- O repository de convite persiste `unit_id` e somente o hash; o service compara convite a Enrollment/contexto.
- `DigitalEnrollmentFormGateway` revalida ownership antes de ler ou alterar progresso.

## 8. Matriz de testes

| Garantia | Arquivo | Cenário/resultado |
| --- | --- | --- |
| Middleware genérico e reader injetável | `backend/src/domains/auth/infrastructure/middlewares/context-middlewares.test.js` | Preserva `req.auth`/`req.user`, valida dependências e permite reader que ignora header |
| Composição 29.2D | `backend/src/domains/enrollments/infrastructure/enrollment-route-context.composition.test.js` | Resolve identidade/default/unidade, ignora cliente e isola duas unidades |
| Ordem 29.2D | `backend/src/domains/enrollments/presentation/routes/enrollment-context.routes.test.js` | Controller só roda após auth, autorização e ActorContext |
| Contexto hostil 29.2E | `backend/src/domains/enrollments/presentation/routes/enrollment-unit-isolation.integration.test.js` | Body/query/params/header, usuário e ActorContext forjados não vencem membership |
| Membership ausente/inativa/ambígua/default | `backend/src/domains/enrollments/presentation/routes/enrollment-unit-isolation.integration.test.js` | 403/409 sem auto-seleção; default única vence |
| Busca/status/DRAFT/ACTIVE | `backend/src/domains/enrollments/presentation/routes/enrollment-unit-isolation.integration.test.js` | Repository recebe apenas unidade do ActorContext |
| Confirmação mismatch | `backend/src/domains/enrollments/presentation/routes/enrollment-unit-isolation.integration.test.js` e `backend/src/domains/enrollments/application/tests/enrollment-application.service.test.js` | Erro controlado e nenhum update |
| Convite público | `backend/src/domains/enrollments/presentation/routes/enrollment-unit-isolation.integration.test.js` e `backend/src/domains/enrollments/presentation/controllers/enrollment-invitation-public.controller.test.js` | Independente de ActorContext; ownership correto ou erro genérico |
| Sanitização | `backend/src/domains/enrollments/presentation/routes/enrollment-unit-isolation.integration.test.js` | Sem token, payload, SQL ou stack em resposta/log |
| Fronteiras 29.2C | `backend/src/domains/enrollments/presentation/controllers/trusted-enrollment-entry-boundaries.test.js` | Somente ActorContext chega ao facade |
| Repository | `backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment.repository.test.js` | Filtros, lock e retry permanecem unit-scoped |
| Fluxo digital 29.2B | `backend/src/domains/enrollments/application/tests/enrollment-digital-invitation.service.test.js` e `backend/src/domains/enrollments/infrastructure/digital-enrollment-form.gateway.test.js` | Ausência/mismatch de unidade falha antes de persistir |

Arquivos acima ficam em `backend/src/domains/auth/infrastructure/middlewares` ou `backend/src/domains/enrollments`. Resultado registrado na 29.2E: **549 testes de Enrollment aprovados, 0 falhas**. A 29.2F faz somente validação documental.

## 9. Garantias de segurança

- isolamento entre identidades/unidades mesmo com seletores hostis idênticos;
- impossibilidade de trocar unidade por body, query, params, header, usuário ou contexto pré-injetado;
- ausência de fallback e de escolha da primeira membership;
- falha antes do controller/repository sem identidade, membership ou unidade válidas;
- filtro de unidade até o repository;
- ownership persistido antes de confirmação e convites;
- convite público por token opaco, sem ActorContext, revalidado contra Enrollment;
- logs/respostas sem token, payload integral, SQL ou stack nos fluxos controlados;
- `UnitContext` e `ActorContext` imutáveis;
- role global não substitui role/unidade da membership.

## 10. Comportamento fail-closed

| Cenário | Comportamento |
| --- | --- |
| Sem autenticação | 401 antes de contexto |
| Identidade ausente/inativa | Resolução rejeitada; controller não roda |
| Membership ausente/inativa/revogada | 403/409; sem fallback |
| Múltiplas memberships sem default | 409 `UNIT_CONTEXT_SELECTION_REQUIRED` |
| Defaults conflitantes | 409 de estado |
| Unidade inexistente/inativa | 403 `UNIT_CONTEXT_UNIT_NOT_AVAILABLE` |
| Enrollment sem unidade/de outra unidade | Indisponível/conflito; nenhuma escrita |
| Convite de outra unidade | Erro genérico/controlado |
| Contrato de outra unidade | Fluxo ainda bloqueado antes de aceite |
| Contexto forjado/inconsistente | Recomposto ou rejeitado |
| Dependência obrigatória ausente | Operação rejeitada, nunca assumida como sucesso |

## 11. Limites, riscos e pendências

- Convites administrativos e `/internal/enrollments` não estão montados; o router interno ainda não compõe ActorContext.
- Contrato digital não tem rota/repository operacional nem seleção canônica de template; não está em produção.
- `digital_enrollment_contract_templates.unit_id` e `enrollment_digital_invitations.unit_id` são `VARCHAR(64)` e não têm FK direta a `j12_unidades`; o ownership é lógico/transitivo e precisa de reconciliação antes de ampliar o fluxo.
- `/public/enrollments` é legado e não herda automaticamente as garantias 29.2.
- Não há seleção manual de unidade: múltiplas memberships exigem uma única default.
- O middleware genérico pode ler `x-unit-id`; Enrollment o desabilita. UI futura exige nova decisão e validação explícita.
- O runtime reconhece o status textual `ativo` ou o sinalizador booleano `active: true`; vocabulário e dados reais devem ser confirmados no ambiente correto antes do deploy.
- A Sprint 29.1 registrou falha histórica global em teste CRM ligado a `refetchInterval`. A 29.2E comprovou apenas 549 testes de Enrollment; não se afirma correção de toda falha global.
- Há EOL documental preexistente em CRLF/misto fora deste escopo. O Git também avisa que os três documentos desta Sprint, hoje em LF, poderão ser convertidos para CRLF no próximo toque conforme a configuração local; `git diff --check` não aponta erro de whitespace. A 29.2F não normaliza arquivos alheios.
- Não houve deploy, migration, escrita no banco, acesso à VPS ou alteração de secrets nesta Sprint.

## 12. Checklist para novas rotas

- [ ] `requireAuth` quando não for pública por token.
- [ ] Autorização antes do controller.
- [ ] ActorContext pela composição específica de Enrollment.
- [ ] `unitId` somente do contexto.
- [ ] IDs tratados apenas como localizadores.
- [ ] Ownership persistido no service.
- [ ] Filtro por unidade e revalidação no repository.
- [ ] Teste de unidade hostil e ActorContext pré-injetado.
- [ ] Teste de mismatch, fail-closed e isolamento.
- [ ] Teste de sanitização.
- [ ] Registro nas matrizes deste documento.
- [ ] Se pública por token, resposta resistente a enumeração e vínculos persistidos revalidados.

## 13. Critérios para produção

Antes de deploy, execução operacional separada e aprovada deve confirmar:

- [ ] migrations aplicadas e catalogadas no ambiente correto;
- [ ] FKs e índices esperados válidos;
- [ ] linhas legadas sem ownership tratadas sem inferência;
- [ ] memberships consistentes e no máximo uma default ativa;
- [ ] unidades existentes, ativas e com status compatível;
- [ ] secrets, storage, CORS e limites configurados;
- [ ] logs sem token, PII, payload, SQL ou stack indevidos;
- [ ] smoke tests com pelo menos duas unidades em homologação;
- [ ] mismatch, expiração, revogação, concorrência e rollback testados;
- [ ] backup e plano de rollback verificados;
- [ ] validação funcional e de segurança em homologação.

Nenhum item operacional acima foi executado na 29.2F.

## Referências auditadas

- [ADR 0007](../ADR/ADR-0007-ENROLLMENT-NAO-ACEITA-UNIDADE-DO-CLIENTE.md)
- [ADR 0006](../ADR/ADR-0006-UNIDADE-CANONICA-E-BLOQUEIO-DE-MEMBERSHIP.md)
- [Autenticação](../../backend/auth.js)
- [Composição genérica](../../backend/src/domains/auth/infrastructure/unit-context.composition.js)
- [Resolver de unidade](../../backend/src/domains/auth/application/services/unit-context-resolver.service.js)
- [Fábrica de ator](../../backend/src/domains/auth/application/services/actor-context-factory.service.js)
- [Composição Enrollment](../../backend/src/domains/enrollments/infrastructure/enrollment-route-context.composition.js)
- [Bootstrap](../../backend/src/server.js)
- [Repository Enrollment](../../backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment.repository.js)
- [Teste integrado 29.2E](../../backend/src/domains/enrollments/presentation/routes/enrollment-unit-isolation.integration.test.js)
