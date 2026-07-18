# Política Oficial de Identidade de Pessoa e CPF

## Autoridade e estado

Esta política consolida as decisões oficiais da J12 Sports registradas em
[Decisões Executivas — Identidade e CPF](./PERSON_IDENTITY_AND_CPF_EXECUTIVE_DECISION.md).

As vinte decisões estão `APPROVED`. Condições de revisão especializada, implementação futura e gates técnicos não reabrem a decisão empresarial; elas controlam quando e como cada comportamento poderá ser implementado.

Fonte técnica: `backend/src/domains/pessoas/person-identity-policy.js`.

## Princípios oficiais

1. Cada pessoa física possui uma identidade global no ERP.
2. Perfis, vínculos, matrículas, acessos e operações são contextuais por unidade.
3. A mesma Pessoa pode exercer múltiplos perfis.
4. CPF pertence à Pessoa, não ao perfil.
5. E-mail e telefone são compartilháveis.
6. CPF é identificador forte opcional e `people.id` continua sendo a chave técnica.
7. CPF informado e válido identifica uma única Pessoa globalmente.
8. Duplicidade nunca é resolvida automaticamente.
9. Resolução global não concede acesso global.
10. `people` representa exclusivamente Pessoa Física; organizações terão domínio próprio.

## Contrato técnico das vinte decisões

| Código | Campo técnico                | Valor oficial                                              | Condição posterior           |
| ------ | ---------------------------- | ---------------------------------------------------------- | ---------------------------- |
| DEC-01 | `entityNatureDecision`       | `NATURAL_PERSON_ONLY`                                      | nenhuma                      |
| DEC-02 | `legalEntityDecision`        | `SEPARATE_LEGAL_ENTITY_DOMAIN`                             | implementação futura         |
| DEC-03 | `cpfRoleDecision`            | `OPTIONAL_STRONG_IDENTIFIER`                               | nenhuma                      |
| DEC-04 | `cpfOptionalityPolicy`       | `CONDITIONALLY_REQUIRED_BY_LIFECYCLE`                      | revisão especialista         |
| DEC-05 | `minorStudentCpfPolicy`      | `ALLOW_WITHOUT_CPF_WHEN_RESPONSIBLE_IS_VALID`              | nenhuma                      |
| DEC-06 | `adultStudentCpfPolicy`      | `BRAZILIAN_ADULT_REQUIRES_VALID_CPF_FOR_ACTIVE_ENROLLMENT` | exceção estrangeiro          |
| DEC-07 | `responsibleCpfPolicy`       | `REQUIRED_BEFORE_ACTIVE_WHEN_CONTRACTUAL_OR_FINANCIAL`     | revisão especialista         |
| DEC-08 | `foreignPersonPolicy`        | `ALLOW_WITHOUT_CPF_USING_INTERNAL_ID`                      | nenhuma                      |
| DEC-09 | `alternativeDocumentPolicy`  | `TYPED_ALTERNATIVE_DOCUMENT_DOMAIN`                        | implementação futura         |
| DEC-10 | `cpfValidationPolicy`        | `NORMALIZED_SEMANTICALLY_VALID_AND_VERIFIED_LEVELS`        | verificação externa futura   |
| DEC-11 | `invalidNewCpfPolicy`        | `REJECT_INVALID_CPF_ON_MODERN_WRITES`                      | implementação pendente       |
| DEC-12 | `invalidLegacyCpfPolicy`     | `PRESERVE_WITH_NULL_NORMALIZED_AND_ASSISTED_REVIEW`        | saneamento assistido         |
| DEC-13 | `duplicateCpfPolicy`         | `BLOCK_AND_REVIEW_WITHOUT_AUTOMATIC_MERGE`                 | implementação pendente       |
| DEC-14 | `cpfChangePolicy`            | `AUTHORIZED_AUDITED_CHANGE_ONLY`                           | implementação pendente       |
| DEC-15 | `cpfHistoryPolicy`           | `RESTRICTED_CPF_HISTORY_REQUIRED`                          | revisão LGPD                 |
| DEC-16 | `inactivePersonPolicy`       | `IDENTITY_AND_CPF_REMAIN_RESERVED`                         | nenhuma                      |
| DEC-17 | `physicalDeletionPolicy`     | `CONTROLLED_ONLY_WITHOUT_LINKS_OR_OBLIGATIONS`             | revisão LGPD                 |
| DEC-18 | `nullNormalizedPolicy`       | `NULL_ONLY_WHEN_CPF_ABSENT_OR_LEGACY_INVALID`              | saneamento e writers         |
| DEC-19 | `personScopeDecision`        | `GLOBAL_IDENTITY_CONTEXTUAL_PROFILES_AND_ACCESS`           | gates técnicos               |
| DEC-20 | `privacyAuthorizationPolicy` | `GLOBAL_RESOLUTION_CONTEXTUAL_AUTHORIZATION`               | implementação de autorização |

## Obrigatoriedade por etapa

- Lead: CPF opcional.
- Conversão: conforme Pessoa e operação resultante.
- Pré-matrícula: pode iniciar sem CPF, com pendência explícita.
- Matrícula `DRAFT`: pode existir sem CPF.
- Matrícula `ACTIVE`: adulto brasileiro exige CPF válido; menor pode não possuir CPF; responsável contratual brasileiro exige CPF; estrangeiro segue política própria.
- Financeiro/contrato: CPF da pessoa responsável é obrigatório, salvo exceção formal de estrangeiro.

Regras fiscais e contratuais deverão passar por revisão especialista antes da implementação, sem alterar a decisão de negócio.

## Validade, legado e conflito

- novo CPF moderno inválido será rejeitado;
- legado inválido será preservado com normalizado nulo e saneamento assistido;
- CPF ausente usa original e normalizado nulos;
- CPF válido exige original e normalizado preenchidos;
- duplicidade bloqueia criação e exige revisão;
- não haverá seleção, exclusão, sobrescrita ou merge automático;
- alteração exige permissão, motivo, validação, conflito, autoria, data e histórico;
- logs e respostas técnicas não expõem CPF.

## Inatividade, exclusão e LGPD

Inativação não libera identidade ou CPF. Exclusão física é excepcional, somente sem vínculos ou obrigações e por processo autorizado. Histórico, retenção, anonimização e acesso dependem de revisão LGPD/jurídica antes da implementação.

## Identidade global e autorização

Unicidade e resolução são globais; visualização e utilização são contextuais. Uma correspondência global não pode revelar CPF, e-mail, telefone ou existência detalhada a usuário não autorizado.

## Impacto no gate

Os blockers de decisão empresarial estão resolvidos pelo contrato oficial. O gate global continua condicionado a evidências técnicas e operacionais, incluindo MySQL isolado, migration, idempotência, rollback, múltiplos nulos, dados operacionais, zero duplicidades, zero drift, writers sincronizados, rollout e impacto aceito.

Esta política não autoriza criar unique, migration, validação funcional ou alteração de dados nesta Sprint.
