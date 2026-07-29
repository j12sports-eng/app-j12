# Sprint 29.3D — Convite Digital Canônico

## Objetivo

Esta sprint oficializa a emissão administrativa do convite digital associado a um único `Enrollment DRAFT`.

A entrega promove o convite existente à entrada administrativa oficial da jornada digital, sem reutilizar fluxos legados e sem criar uma arquitetura paralela.

## Arquitetura

O fluxo canônico é:

`EnrollmentAdminRouter` → `EnrollmentAdminController` → `EnrollmentFacade` → `EnrollmentInvitationAdminApplicationService` → `EnrollmentDigitalInvitationService` → repositórios de `Enrollment` e convite.

O controller permanece fino. Validação de ownership, estado, expiração, emissão e reemissão fica na camada de aplicação. A infraestrutura executa somente persistência e consultas parametrizadas.

## Operação canônica

A operação `createDigitalEnrollmentInvitation` recebe somente o `enrollmentId` e o `ActorContext`. Ela:

1. valida o contexto e a autorização administrativa;
2. obtém a unidade exclusivamente de `actorContext.unitContext.unitId`;
3. carrega o `Enrollment` pelo aggregate oficial;
4. valida o ownership do `Enrollment` contra a unidade do ator;
5. aceita somente `Enrollment DRAFT`;
6. bloqueia `ACTIVE`, `CANCELLED`, `FINISHED` e qualquer estado incompatível;
7. consulta o convite ativo pelo par `enrollmentId + unitId`;
8. cria ou reemite o convite conforme o estado encontrado.

Headers, query strings e body não selecionam unidade. O endpoint não aceita `unitId` do cliente.

## Endpoint administrativo

- Método e caminho: `POST /admin/enrollments/:enrollmentId/invitations`
- Autenticação: obrigatória
- Autorização administrativa: obrigatória
- `ActorContext`: obrigatório
- Body: vazio

O endpoint foi adicionado ao router administrativo já montado. Nenhuma rota pública foi criada ou alterada.

## Token e persistência

O token é gerado com `crypto.randomBytes(32)` e codificado em Base64URL. Ele é criptograficamente seguro e não utiliza identificadores sequenciais.

Somente o hash SHA-256 do token é persistido. O token bruto existe transitoriamente para formar a URL devolvida ao administrador e nunca é entregue ao repositório. A persistência existente registra o identificador do convite, hash, criação, expiração, revogação, ator criador e unidade.

## Expiração

A política de expiração permanece centralizada no `EnrollmentDigitalInvitationService`. O prazo padrão é de sete dias. O endpoint oficial não aceita duração escolhida pelo cliente.

## Reemissão

A reemissão segue o padrão já existente no domínio:

- sem convite ativo: cria um convite;
- convite `ACTIVE` ainda válido: revoga o convite anterior e emite outro token;
- convite expirado: marca o anterior como `EXPIRED` e emite outro token.

A constraint física existente, a consulta canônica e o fluxo de substituição garantem no máximo um convite `ACTIVE` por Enrollment.

## Projeção pública

A resposta de sucesso contém somente:

- `invitationId`;
- `expiresAt`;
- `status`;
- `url`.

Não são retornados hash, ownership, unidade, campos de auditoria ou token bruto em campo separado. A URL contém a credencial bearer e deve ser tratada como segredo.

## Testes executados

- Testes direcionados da Sprint 29.3D: 47 testes, 47 aprovados e nenhuma falha.
- Suíte completa de Enrollment: 598 testes, 598 aprovados e nenhuma falha.

A cobertura inclui criação, reemissão, expiração, token único, hash, estados incompatíveis, ownership, unidade inválida, `ActorContext` obrigatório, repository unit-scoped, controller, route e integração.

## Fora do escopo

Permanecem fora do escopo convite público, formulário público, contrato digital, financeiro e portal. Nenhuma migration foi criada ou aplicada, e nenhuma rota pública foi modificada.
