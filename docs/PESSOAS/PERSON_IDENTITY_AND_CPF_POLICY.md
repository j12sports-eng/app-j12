# Política de Identidade de Pessoa e CPF

## 1. Status e método

Este documento é a decisão arquitetural da Sprint 27.17A.4.1D. Cada conclusão distingue:

- **FATO CONFIRMADO NO CÓDIGO**: estrutura ou comportamento verificável;
- **REGRA CONFIRMADA NA DOCUMENTAÇÃO**: princípio já registrado;
- **INFERÊNCIA**: consequência técnica, não regra empresarial;
- **DECISÃO APROVADA**: sustentada conjuntamente pelo modelo e documentação;
- **DECISÃO PROPOSTA**: recomendação que exige aprovação empresarial;
- **PENDÊNCIA/BLOCKED**: não há evidência para decidir com segurança.

Nenhuma política proposta ou bloqueada altera o comportamento atual.

## 2. Evidências principais

| Tema                                                                   | Evidência                              | Classificação     |
| ---------------------------------------------------------------------- | -------------------------------------- | ----------------- |
| `people` não possui `unit_id` ou tenant                                | foundation, repository e migration A.4 | FATO CONFIRMADO   |
| `person_profiles.person_id` liga papéis à Pessoa                       | schema e profile services              | FATO CONFIRMADO   |
| Pessoa é identidade; Profile é papel                                   | `PERSON_PROFILE_ARCHITECTURE.md`       | REGRA DOCUMENTADA |
| uma Pessoa pode ter contratos em unidades diferentes                   | arquitetura de perfis                  | REGRA DOCUMENTADA |
| CPF é nullable e somente nome é obrigatório em `PersonService`         | schema/service                         | FATO CONFIRMADO   |
| pré-matrícula exige CPF do responsável                                 | schema e validator de pré-matrícula    | FATO CONFIRMADO   |
| aluno, responsável e professor legados têm identidades paralelas       | controllers/routes/schema legado       | FATO CONFIRMADO   |
| não há `person_type`, CNPJ ou documento estrangeiro persistido         | schema/mapper                          | FATO CONFIRMADO   |
| locação possui perfil de locatário; financeiro aceita devedor CPF/CNPJ | perfis e integração financeira         | FATO CONFIRMADO   |
| CRM Lead tem `person_id` opcional e conversão não implementada         | domínio CRM                            | FATO CONFIRMADO   |

Há tensão entre o alvo global e os fluxos legados separados. Isso é coexistência de arquitetura em migração, não autorização para duplicar identidade civil por unidade.

## 3. Matriz oficial de decisões

| Decisão              | Valor                                            | Estado       | Fundamento                                                                                 |
| -------------------- | ------------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------ |
| Escopo de Pessoa     | `GLOBAL_IDENTITY_CONTEXTUAL_PROFILES_AND_ACCESS` | **APPROVED** | tabela global + princípio Person/Profile + contratos multiunidade                          |
| Papel do CPF         | `OPTIONAL_STRONG_IDENTIFIER`                     | **PROPOSED** | CPF é forte quando presente, mas o sistema permite ausência                                |
| Natureza de `people` | `LEGAL_ENTITY_BOUNDARY_UNDEFINED`                | **BLOCKED**  | PJ não é modelada, porém fornecedores, parceiros e representante empresarial são previstos |
| Estrangeiros         | `ALTERNATIVE_DOCUMENT_MODEL_REQUIRED`            | **BLOCKED**  | nenhum documento alternativo ou regra operacional existe                                   |
| Obrigatoriedade      | `CPF_CONDITIONALLY_REQUIRED`                     | **PROPOSED** | exigências atuais variam por fluxo e estágio                                               |
| Alteração de CPF     | `AUTHORIZED_AUDITED_CHANGE_REQUIRED`             | **BLOCKED**  | update é tecnicamente possível, sem autorização/histórico                                  |
| Pessoa inativa       | `IDENTITY_REMAINS_RESERVED`                      | **PROPOSED** | identidade não deveria desaparecer com fim de vínculo; delete físico existe                |
| CPF normalizado nulo | `NULL_ONLY_WHEN_CPF_ABSENT_OR_LEGACY_INVALID`    | **PROPOSED** | compatibilidade legada existe; novos writes ainda não rejeitam inválido                    |

## 4. Princípios aprovados

1. Pessoa é global; perfis, vínculos, matrículas, contratos e permissões são contextuais.
2. Identidade global não concede acesso global. Resolução e autorização são operações separadas.
3. Uma Pessoa pode possuir múltiplos perfis; perfil não cria nova identidade.
4. CPF pertence à Pessoa, não ao perfil.
5. E-mail e telefone são contatos compartilháveis e não identificadores únicos.
6. `people.id` sustenta tecnicamente Pessoas sem CPF.

Esses princípios não aprovam busca global pública. Um futuro resolvedor deve evitar confirmar a existência de Pessoa fora do escopo autorizado.

## 5. CPF e ausência

Política proposta:

- ausência real é `cpf = NULL` e `cpf_normalized = NULL`; string vazia é apenas legado a sanear;
- CPF sintaticamente aceito continua sendo 11 dígitos, sem alegar verificação de dígitos;
- novo write moderno com CPF preenchido e inválido deve ser rejeitado em sprint futura;
- legado inválido pode ser preservado temporariamente com normalizado nulo e revisão explícita;
- nenhum CPF fictício, sequencial ou compartilhado deve representar ausência ou estrangeiro;
- CPF válido repetido deve bloquear nova criação e exigir revisão, sem escolha ou merge automático.

O ponto exato em que CPF se torna obrigatório não está aprovado. O código confirma apenas: Pessoa moderna aceita ausência; pré-matrícula exige CPF do responsável; matrícula/financeiro possuem contratos distintos e não consolidam uma regra civil única.

## 6. Cenários

| Cenário real auditado | Criar registro                              | CPF atual                          | Política/resultado                      |
| --------------------- | ------------------------------------------- | ---------------------------------- | --------------------------------------- |
| Pessoa moderna mínima | permitido                                   | opcional                           | fato atual; completude futura PROPOSED  |
| Pré-matrícula         | permitido em tabela própria                 | CPF do responsável obrigatório     | fato atual, não regra global            |
| Aluno menor           | permitido nos fluxos legados                | regra fragmentada                  | BLOCKED para obrigatoriedade civil      |
| Aluno adulto          | permitido                                   | não há regra consolidada por idade | BLOCKED                                 |
| Lead CRM              | criado como Lead, não Pessoa                | contato pode existir sem CPF       | fato atual; conversão fora do escopo    |
| Estrangeiro           | não há modelo específico                    | não usar CPF fictício              | BLOCKED; requer documentos alternativos |
| CPF repetido          | fisicamente permitido hoje                  | conflito detectável                | PROPOSED: bloquear e revisar            |
| CPF inválido legado   | preservar sem inventar normalizado          | normalizado nulo                   | PROPOSED: revisão                       |
| CPF inválido novo     | repository hoje preserva original           | normalizado nulo                   | PROPOSED: rejeitar em sprint própria    |
| Pessoa inativa        | permanece com `ativo=0` quando não deletada | CPF permanece                      | PROPOSED: reservar identidade           |
| Contato compartilhado | permitido                                   | não determina identidade           | APPROVED                                |

Não existe evidência para afirmar que matrícula ativa ou financeiro devam exigir CPF em todos os cenários. Essa decisão envolve menores, estrangeiros, contratos e requisitos fiscais.

## 7. Pessoa Jurídica

`people` não suporta PJ corretamente. Ao mesmo tempo, a arquitetura cita fornecedor, parceiro, prestador, empresa locatária e representante de empresa, e o financeiro sabe formar payload CPF/CNPJ. Portanto, não está aprovado declarar `people` exclusivamente Pessoa Física.

Direção deve escolher entre:

1. `people` exclusivamente Pessoa Física e entidade própria para organizações; ou
2. supertipo de partes com discriminador e identificadores CPF/CNPJ separados.

Até a decisão, `LEGAL_ENTITY_MODEL_NOT_CONFIRMED` permanece ativo e nenhum CNPJ deve ser colocado em `cpf_normalized`.

## 8. Alteração, duplicidade e histórico

Alteração de CPF hoje é um update comum e delete de Pessoa é físico. A política segura proposta exige autorização específica, verificação de conflito, motivo, auditoria do valor anterior com acesso restrito e distinção entre correção e merge. Como não existe histórico de documentos, a política fica **BLOCKED** para aprovação.

Mesmo CPF em Pessoas distintas é conflito, não licença para escolher o registro mais novo. Pessoa sem CPF não pode ser deduplicada por nome, nascimento ou contato isoladamente. Nenhum merge automático está autorizado.

## 9. Inativos e múltiplos perfis

É **APPROVED** que encerrar perfil, matrícula ou contrato não cria nova identidade. É **PROPOSED** que CPF continue reservado inclusive para Pessoa inativa, pois o repository ainda permite delete físico e não há política de retenção aprovada. Questões LGPD, fiscais e contratuais exigem decisão da direção/jurídico.

## 10. Bypass por normalizado nulo

Uma future unique nullable não cobre `cpf preenchido + cpf_normalized NULL`. Antes da A.4.2 é obrigatório:

- aprovar rejeição de CPF inválido em novos writes;
- sanear legado autorizado até zero drift;
- comprovar writers versionados e externos;
- validar MySQL fisicamente;
- decidir constraint complementar sem antecipá-la nesta sprint.

## 11. Estados futuros

`INCOMPLETE`, `UNVERIFIED`, `VERIFIED`, `CONFLICT` e `LEGACY_INVALID` podem apoiar onboarding e saneamento, mas permanecem **PROPOSED**. Nenhum estado foi adicionado ao schema.

## 12. Critérios de revisão e liberação

A.4.2 continua bloqueada até que todas as oito decisões do contrato estejam `APPROVED`, o gate técnico/operacional esteja aprovado, duplicidades e drift sejam zero e writers externos sejam controlados. A aprovação documental não substitui validação MySQL nem diagnóstico operacional.

Decisões que exigem direção/jurídico:

- fronteira Pessoa Física/Pessoa Jurídica;
- etapa de obrigatoriedade do CPF para menor, adulto, matrícula e financeiro;
- política para estrangeiros;
- autorização, retenção e auditoria de alteração;
- reserva de CPF em inativos/excluídos;
- definição do que é CPF sintático, semanticamente válido ou verificado.
