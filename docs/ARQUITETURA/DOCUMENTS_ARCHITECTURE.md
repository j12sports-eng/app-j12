# Documents Architecture

Arquitetura conceitual para documentos vinculados a pessoas, perfis e contratos.

## Objetivo

Padronizar documentos obrigatorios por tipo contratual, validade, vencimento,
historico e auditoria.

## Entidades Conceituais

```text
Document
DocumentType
DocumentRequirement
DocumentVersion
DocumentValidation
ContractAttachment
```

## Categorias

- `IDENTITY`
- `ADDRESS_PROOF`
- `MEDICAL_CERTIFICATE`
- `PROFESSIONAL_CERTIFICATE`
- `TAX_DOCUMENT`
- `LABOR_DOCUMENT`
- `BANK_DOCUMENT`
- `CONTRACT_DOCUMENT`
- `TERMINATION_DOCUMENT`
- `SIGNATURE_EVIDENCE`
- `OTHER`

## Documentos por Tipo de Contrato

### Aluno

Obrigatorios/recomendados:

- Documento do aluno.
- Documento do responsavel.
- Comprovante de endereco.
- Atestado medico.
- Autorizacao de imagem, quando aplicavel.
- Termo de responsabilidade, quando separado do contrato.

Validade:

- Atestado medico: vencimento controlado, recomendacao anual.
- Comprovante de endereco: pode exigir recencia operacional.

### Professor

Documentos:

- Documento de identidade.
- CPF.
- Comprovante de endereco.
- Certificacoes profissionais.
- Registro profissional quando aplicavel.
- Dados bancarios.
- Nota fiscal ou documentos fiscais, se prestador.
- Certidoes exigidas por politica interna.

### Locatario

Documentos:

- Documento do locatario.
- Comprovante de endereco.
- Comprovante de pagamento/caucao.
- Autorizacao de responsavel por evento, quando aplicavel.
- Termo de uso da quadra.

### Funcionario

Documentos futuros:

- Documento de identidade.
- CPF.
- CTPS/dados trabalhistas.
- Comprovante de endereco.
- Dados bancarios.
- Exames admissionais/periodicos.
- Contrato de trabalho.
- Termos internos.

### Prestador

Documentos futuros:

- Documento da pessoa ou empresa.
- CNPJ/CPF.
- Contrato social, se empresa.
- Nota fiscal.
- Dados bancarios.
- Certidoes fiscais quando exigidas.
- Comprovante de seguro, quando aplicavel.

## Atributos de Document

- `documentId`
- `ownerPersonId`
- `ownerProfileId`
- `documentType`
- `category`
- `fileName`
- `storageReference`
- `contentHash`
- `issuedAt`
- `expiresAt`
- `status`
- `uploadedBy`
- `uploadedAt`
- `validatedBy`
- `validatedAt`

## Status

- `PENDING`
- `UPLOADED`
- `UNDER_REVIEW`
- `APPROVED`
- `REJECTED`
- `EXPIRED`
- `REPLACED`
- `ARCHIVED`

## Regras

- Documento substituido nao deve ser apagado; deve virar `REPLACED`.
- Documento vencido deve gerar pendencia.
- Anexo de contrato deve apontar para documento/versionamento.
- Contrato assinado deve preservar referencia aos documentos aceitos na data.
- LGPD exige controle de acesso e retencao.

## Historico

Eventos:

- `DOCUMENT_REQUIRED`
- `DOCUMENT_UPLOADED`
- `DOCUMENT_APPROVED`
- `DOCUMENT_REJECTED`
- `DOCUMENT_EXPIRED`
- `DOCUMENT_REPLACED`
- `DOCUMENT_ATTACHED_TO_CONTRACT`

