# Sprint 9.0.5 - Revisao Arquitetural dos Contratos

Documento de consolidacao da Sprint 9.0.5. Esta sprint e 100% documental e nao
altera backend, frontend, banco, migrations, SQL, APIs, controllers, services,
repositories, rotas, Prisma, models ou testes.

## Objetivo

Definir uma arquitetura unica para gerenciamento completo de contratos da J12
Sports, cobrindo:

- Alunos.
- Professores.
- Locatarios.
- Funcionarios futuros.
- Prestadores de servico futuros.

A arquitetura deve suportar criacao, aprovacao, assinatura, vigencia, renovacao,
suspensao, cancelamento, rescisao, auditoria, documentos e integracao financeira.

## Contexto Atual

O sistema ja possui contrato de matricula de aluno no frontend, com:

- Status atuais: `rascunho`, `aguardando_assinatura`, `ativo`, `encerrado`,
  `cancelado`.
- Template de contrato de matricula.
- Assinatura eletronica simples com nome, documento, IP, dispositivo e data.
- Geracao de parcelas financeiras quando contrato e ativado.
- Cancelamento de cobrancas pendentes no cancelamento de contrato.

Esses comportamentos devem ser preservados durante migracao. A arquitetura alvo
nao remove o fluxo atual; ela define o modelo conceitual para evolucao.

## Escopo

Incluido:

- Dominio `contracts/`.
- Ciclo de vida contratual.
- Rescisao.
- Renovacao.
- Versionamento.
- Assinatura eletronica e digital.
- Historico e auditoria.
- Documentos obrigatorios.
- Integracao financeira.
- Relacao com Person, Profile, Relationship e Enrollment.
- Escalabilidade para multiplos dominios.

Nao incluido:

- Criacao de tabelas.
- Criacao de endpoints.
- Criacao de services.
- Alteracao de templates existentes.
- Migracao de dados.
- Implementacao de assinatura externa.
- Alteracao do fluxo financeiro atual.

## Arquitetura Unica

Contratos devem ser tratados como dominio proprio, nao como campo solto de
aluno, professor, locatario ou financeiro.

```text
Person
  -> Profiles
  -> Relationships
  -> Contracts
       -> ContractVersion
       -> ContractSignature
       -> ContractAttachment
       -> ContractHistory
       -> ContractTermination
       -> PaymentPlan
       -> Documents
```

Principios:

- `Person` representa identidade.
- `Profile` representa papel exercido no sistema.
- `Contract` representa o acordo juridico/operacional.
- `ContractVersion` preserva alteracoes contratuais.
- `ContractSignature` registra manifestacao de vontade.
- `ContractHistory` registra todo evento.
- `ContractTermination` representa processo formal de rescisao.
- `PaymentPlan` deriva obrigacoes financeiras do contrato.
- `Documents` guarda evidencias e anexos.

## Fontes Oficiais da Sprint

Entregaveis criados:

- [CONTRACTS_ARCHITECTURE.md](./CONTRACTS_ARCHITECTURE.md)
- [CONTRACT_LIFECYCLE.md](./CONTRACT_LIFECYCLE.md)
- [CONTRACT_TERMINATION.md](./CONTRACT_TERMINATION.md)
- [CONTRACT_SIGNATURE.md](./CONTRACT_SIGNATURE.md)
- [CONTRACT_VERSIONING.md](./CONTRACT_VERSIONING.md)
- [DOCUMENTS_ARCHITECTURE.md](./DOCUMENTS_ARCHITECTURE.md)
- [FINANCIAL_ARCHITECTURE.md](./FINANCIAL_ARCHITECTURE.md)
- [PERSON_PROFILE_ARCHITECTURE.md](./PERSON_PROFILE_ARCHITECTURE.md)
- [ENTITY_RELATIONSHIP_DIAGRAM.md](./ENTITY_RELATIONSHIP_DIAGRAM.md)
- [DECISOES_ARQUITETURAIS.md](./DECISOES_ARQUITETURAIS.md)
- [CHECKLIST_SPRINT_9_0_5.md](./CHECKLIST_SPRINT_9_0_5.md)

## Resultado Esperado

Ao final desta Sprint, a J12 deve ter um contrato arquitetural pronto para
guiar a Sprint 9.1 sem ambiguidade sobre:

- Onde contratos vivem.
- Como contratos mudam de status.
- Como renovacoes e rescisoes sao registradas.
- Como assinaturas sao auditadas.
- Como documentos sao exigidos por tipo contratual.
- Como financeiro e contratos se conectam.
- Como uma mesma pessoa pode ter multiplos perfis e contratos simultaneos.

