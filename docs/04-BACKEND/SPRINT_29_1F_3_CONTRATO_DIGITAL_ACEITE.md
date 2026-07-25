# Sprint 29.1F.3 — Contrato digital e aceite eletrônico

## Resultado

Esta sprint estabelece somente a foundation moderna e fail-closed. Não existe hoje uma regra canônica capaz de selecionar inequivocamente um template aplicável a um `Enrollment`: a tabela e a entidade `Enrollment` não persistem unidade, modalidade ou uma atribuição explícita de template. Portanto, nenhum endpoint público foi montado e o Wizard não recebeu a etapa operacional `CONTRACT`.

## Auditoria e decisão

`student_contracts`, `j12_contratos`, `/contratos`, `contratos-store`, `contratos-template` e as telas atuais são legados. O store permite edição do conteúdo, guarda CPF/IP/user-agent em texto e acopla assinatura à geração financeira. Esses artefatos serviram apenas como evidência de auditoria e não são fonte canônica.

Não foi encontrado template moderno publicado, histórico imutável de versões, atribuição por Enrollment ou regra aprovada de fallback global. O `unitId` do convite não substitui ownership persistido no Enrollment. Escolher o primeiro template ativo, por nome, ordem ou fallback global violaria isolamento e auditabilidade.

## Arquitetura preparada

- `DigitalEnrollmentContractTemplate`: `DRAFT`, `PUBLISHED`, `ARCHIVED`; versão e hash estável.
- `DigitalEnrollmentContract`: snapshot imutável vinculado ao Enrollment e relacionamento; `PENDING_ACCEPTANCE`, `ACCEPTED`, `SUPERSEDED`, `CANCELLED`.
- `DigitalEnrollmentContractAcceptance`: evidência única por contrato, método `ELECTRONIC_CONFIRMATION`, convite, relacionamento, hash, consentimentos e identificadores de requisição.

Aceite eletrônico não é assinatura digital qualificada, certificado digital ou ICP-Brasil.

## Conteúdo, hash e consentimentos

A autoridade de validação fica no backend. A foundation aceita apenas `HTML_SANITIZED` e rejeita scripts, iframes, objetos, embeds, handlers, `javascript:`, data URLs, CSS externo e recursos HTTP automáticos. Não existe interpolação operacional nesta sprint.

O snapshot é normalizado e recebe SHA-256. Alterações posteriores no template não modificam uma instância. Apenas `CONTRACT_TERMS` foi definido como consentimento obrigatório porque o contrato real comprova esse termo; consentimentos adicionais não foram inventados.

## Idempotência, concorrência e auditoria

As uniques preparam versão por unidade/nome, instância por Enrollment/template/versão e uma evidência por contrato. A transação de aceite e os eventos `CREATED`, `VIEWED`, `ACCEPTED`, `CONFLICT` e `ACCESS_REJECTED` permanecem bloqueados até existir seleção canônica e um transaction runner que grave aceite, contrato e progresso na mesma transação.

IP e user-agent somente podem ser persistidos como SHA-256. Conteúdo, token, PII e body não podem ser logados.

## Progresso e documentos

O futuro fluxo será `RESPONSIBLE_DATA → STUDENT_DATA → ADDRESS → ADDITIONAL_INFORMATION → DOCUMENTS → CONTRACT → REVIEW`. Nesta foundation, `CONTRACT` não foi adicionado ao progresso para não tornar o Wizard atual inalcançável. A futura regra para REVIEW exigirá documento enviado, não aprovação administrativa, salvo decisão posterior explícita.

## Migration

`20260725160000_create_digital_enrollment_contract_foundation.js` cria três tabelas InnoDB/utf8mb4 separadas, sem backfill, DROP ou legado. A migration não foi executada.

## Endpoints e frontend

Os contratos conceituais futuros são `GET /:token/contract`, `GET /:token/contract/status` e `POST /:token/contract/accept`. Não foram montados. O frontend também permanece intacto e não simula aceite indisponível.

## Fora do escopo

Sem ICP-Brasil, biometria, canvas, PDF, pagamento, PIX, boleto, mensalidade, financeiro, ativação, secretaria, turma, agenda, notificações, portal, mobile ou migração legada.

## Próximos passos

1. Persistir ownership de unidade no Enrollment ou criar uma atribuição explícita Enrollment→Template.
2. Publicar templates por processo administrativo auditado.
3. Implementar repositórios e transaction runner do aceite/progresso.
4. Montar endpoints rate-limited e a etapa `CONTRACT`.
5. Prosseguir para revisão da secretaria somente após a operação do aceite.
