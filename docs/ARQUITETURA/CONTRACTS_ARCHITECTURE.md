# Contracts Architecture

Arquitetura conceitual do dominio `contracts/`. Este documento nao cria codigo,
rotas, tabelas ou migrations.

## Objetivo do Dominio

Centralizar todos os contratos da J12 Sports em um dominio unico, reutilizavel
por alunos, professores, locatarios, funcionarios e prestadores de servico.

O dominio deve separar:

- Contrato juridico/operacional.
- Tipo de contrato.
- Status de ciclo de vida.
- Versoes do documento.
- Termos e clausulas.
- Assinaturas.
- Anexos.
- Historico.
- Rescisao.
- Integracao financeira.

## Estrutura Conceitual

```text
contracts/
  Contract
  ContractType
  ContractStatus
  ContractVersion
  ContractTerm
  ContractHistory
  ContractAttachment
  ContractSignature
  ContractTermination
```

## Entidades

### Contract

Entidade principal. Representa um acordo entre a J12 e uma ou mais partes.

Atributos conceituais:

- `contractId`
- `contractNumber`
- `contractTypeId`
- `subjectType`
- `subjectProfileId`
- `counterpartyProfileId`
- `responsibleProfileId`
- `currentVersionId`
- `status`
- `startDate`
- `endDate`
- `unitIds`
- `createdBy`
- `createdAt`
- `updatedAt`

Responsabilidades:

- Identificar o contrato.
- Vincular contrato a pessoa/perfil correto.
- Guardar status atual.
- Apontar para versao vigente.
- Servir como raiz para assinaturas, anexos, historico, rescisao e financeiro.

Nao deve:

- Armazenar o texto inteiro de todas as versoes diretamente.
- Guardar regras financeiras detalhadas sem `PaymentPlan`.
- Duplicar dados civis de `Person`, exceto snapshots auditaveis em versoes.

### ContractType

Classifica a natureza do contrato.

Tipos alvo:

- `ALUNO_MATRICULA`
- `PROFESSOR_PRESTACAO_SERVICO`
- `LOCATARIO_QUADRA`
- `FUNCIONARIO_TRABALHO`
- `PRESTADOR_SERVICO`
- `PARCERIA`
- `OUTRO`

Responsabilidades:

- Definir regras minimas.
- Definir documentos obrigatorios.
- Definir partes esperadas.
- Definir se gera financeiro.
- Definir se permite renovacao automatica.

### ContractStatus

Enum conceitual do ciclo de vida.

Valores alvo:

- `DRAFT`
- `PENDING_APPROVAL`
- `PENDING_SIGNATURE`
- `ACTIVE`
- `SUSPENDED`
- `RENEWED`
- `ENDED`
- `TERMINATED`
- `CANCELLED`
- `ARCHIVED`

Mapeamento com status atuais:

| Atual | Alvo |
| --- | --- |
| `rascunho` | `DRAFT` |
| `aguardando_assinatura` | `PENDING_SIGNATURE` |
| `ativo` | `ACTIVE` |
| `encerrado` | `ENDED` |
| `cancelado` | `CANCELLED` ou `TERMINATED`, conforme motivo |

### ContractVersion

Representa uma versao imutavel do contrato.

Atributos conceituais:

- `versionId`
- `contractId`
- `versionNumber`
- `templateId`
- `contentSnapshot`
- `variablesSnapshot`
- `documentHash`
- `changeReason`
- `createdBy`
- `createdAt`
- `effectiveFrom`
- `effectiveUntil`

Responsabilidades:

- Preservar texto assinado.
- Registrar mudancas de valores, vigencia e clausulas.
- Servir como base para assinatura.
- Permitir auditoria e comparacao entre versoes.

### ContractTerm

Representa clausula, condicao ou termo parametrizavel.

Atributos conceituais:

- `termId`
- `contractTypeId`
- `code`
- `title`
- `content`
- `required`
- `order`
- `active`

Responsabilidades:

- Padronizar clausulas por tipo.
- Permitir evolucao de templates sem perder versoes assinadas.
- Indicar termos obrigatorios ou opcionais.

### ContractHistory

Log auditavel de eventos.

Atributos conceituais:

- `historyId`
- `contractId`
- `eventType`
- `fromStatus`
- `toStatus`
- `actorId`
- `actorProfileId`
- `occurredAt`
- `metadata`
- `notes`

Responsabilidades:

- Registrar todo evento relevante.
- Preservar trilha de auditoria.
- Nao permitir alteracao destrutiva.

### ContractAttachment

Anexo vinculado ao contrato.

Atributos conceituais:

- `attachmentId`
- `contractId`
- `versionId`
- `documentId`
- `category`
- `required`
- `uploadedBy`
- `uploadedAt`
- `expiresAt`
- `status`

Responsabilidades:

- Vincular documentos ao contrato.
- Guardar evidencias anexas.
- Controlar validade e pendencias.

### ContractSignature

Registro de assinatura ou aceite.

Atributos conceituais:

- `signatureId`
- `contractId`
- `versionId`
- `signerPersonId`
- `signerProfileId`
- `signatureType`
- `status`
- `signedAt`
- `ipAddress`
- `device`
- `evidenceHash`
- `documentHash`
- `provider`
- `providerReference`

Responsabilidades:

- Provar manifestacao de vontade.
- Vincular assinatura a uma versao imutavel.
- Guardar evidencias tecnicas.

## Contratos por Dominio

### Aluno

Contrato de matricula/prestacao de servicos.

Partes:

- J12.
- Responsavel legal/financeiro ou aluno maior.
- Aluno como beneficiario.

Integra com:

- Enrollment.
- PaymentPlan.
- Documentos medicos e cadastrais.
- Relacionamentos aluno-responsavel.

### Professor

Contrato de prestacao de servico, parceria ou trabalho.

Partes:

- J12.
- ProfessorProfile.

Integra com:

- Unidades.
- Modalidades.
- Turmas.
- Agenda.
- Financeiro a pagar.
- Documentos profissionais.

### Locatario

Contrato de locacao de quadra, evento ou pacote.

Partes:

- J12.
- LocatarioProfile.

Integra com:

- Agenda/Reserva.
- Quadra.
- Pagamento.
- Caucoes, multas e cancelamentos.

### Funcionario

Contrato trabalhista futuro.

Partes:

- J12.
- FuncionarioProfile.

Integra com:

- Usuario.
- Permissoes.
- Departamento.
- Jornada.
- Documentos trabalhistas.

### Prestador de Servico

Contrato futuro para terceiros.

Partes:

- J12.
- PrestadorProfile ou fornecedor.

Integra com:

- Servicos contratados.
- Notas fiscais.
- Contas a pagar.
- Documentos fiscais.

## Regras Gerais

- Um perfil pode ter varios contratos.
- Uma pessoa com varios perfis pode ter contratos simultaneos em dominios
  diferentes.
- Contratos assinados nao devem ser editados diretamente.
- Mudanca material deve gerar nova `ContractVersion`.
- Encerramento antecipado deve usar `ContractTermination`.
- Todo evento relevante deve gerar `ContractHistory`.
- Contratos devem preservar snapshots das partes no momento da assinatura para
  auditoria, sem substituir `Person` como fonte viva dos dados.

