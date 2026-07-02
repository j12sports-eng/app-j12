# Contract Signature

Arquitetura conceitual de assinatura eletronica e digital para contratos.

## Objetivo

Permitir multiplos metodos de assinatura com auditoria consistente, preservando
validade probatoria e rastreabilidade.

## Tipos Suportados

| Tipo | Uso |
| --- | --- |
| `CLICK_TO_SIGN` | Aceite simples no portal/app. |
| `WHATSAPP_CONFIRMATION` | Confirmacao por WhatsApp quando juridicamente permitida. |
| `GOV_BR` | Assinatura via Gov.br quando integracao existir. |
| `ICP_BRASIL` | Assinatura digital com certificado. |
| `SIMPLE_ELECTRONIC` | Assinatura eletronica simples com evidencias. |
| `ADVANCED_ELECTRONIC` | Assinatura avancada com provedor/evidencias reforcadas. |

## Entidade Conceitual

```text
ContractSignature
```

Atributos:

- `signatureId`
- `contractId`
- `versionId`
- `signerPersonId`
- `signerProfileId`
- `signerRole`
- `signatureType`
- `status`
- `requestedAt`
- `signedAt`
- `declinedAt`
- `expiresAt`
- `ipAddress`
- `device`
- `userAgent`
- `geoLocation`
- `evidenceHash`
- `documentHash`
- `provider`
- `providerReference`
- `certificateInfo`
- `auditTrail`

## Status

| Status | Significado |
| --- | --- |
| `PENDING` | Aguardando assinatura. |
| `SIGNED` | Assinado. |
| `DECLINED` | Assinatura recusada. |
| `EXPIRED` | Prazo expirado. |
| `REVOKED` | Assinatura revogada por regra juridica/administrativa. |
| `FAILED` | Falha tecnica no provedor. |

## Evidencias Minimas

Para qualquer assinatura:

- Data/hora.
- IP.
- Dispositivo.
- User agent.
- Identidade do assinante.
- Papel do assinante.
- Hash do documento assinado.
- Hash das evidencias.
- Versao do contrato.
- Evento no historico.

Para WhatsApp:

- Numero usado.
- Mensagem enviada.
- Resposta recebida.
- Timestamp da conversa.
- Identificador da conversa/provedor.
- Regra juridica permitindo esse metodo.

Para Gov.br:

- Identificador do provedor.
- Nivel de conta quando disponivel.
- Protocolo de assinatura.
- Hash retornado pelo provedor.

Para ICP-Brasil:

- Certificado.
- Cadeia de validacao.
- Carimbo de tempo quando disponivel.
- Resultado da validacao.

## Regras

- Assinatura sempre aponta para `ContractVersion`, nunca apenas para `Contract`.
- Alteracao material apos envio para assinatura invalida assinaturas pendentes e
  exige nova versao.
- Contrato so pode virar `ACTIVE` quando todas as assinaturas obrigatorias forem
  `SIGNED`.
- Assinaturas recusadas devem registrar motivo quando informado.
- Evidencias nao devem ser apagadas por edicao operacional.
- Dados sensiveis devem respeitar LGPD e permissoes de acesso.

## Papeis de Assinante

- `J12_LEGAL_REPRESENTATIVE`
- `STUDENT_RESPONSIBLE`
- `ADULT_STUDENT`
- `PROFESSOR`
- `TENANT`
- `EMPLOYEE`
- `SERVICE_PROVIDER`
- `WITNESS`

## Auditoria

Eventos:

- `SIGNATURE_REQUESTED`
- `SIGNATURE_VIEWED`
- `SIGNATURE_SIGNED`
- `SIGNATURE_DECLINED`
- `SIGNATURE_EXPIRED`
- `SIGNATURE_REVOKED`
- `SIGNATURE_PROVIDER_CALLBACK_RECEIVED`

