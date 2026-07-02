# Sprint 9.58 - Auditoria Completa do Dominio de Matriculas

## Objetivo

Consolidar uma estrategia auditavel para o dominio de Matriculas, cobrindo
criacao, reutilizacao, confirmacao, bloqueios, conflitos e integracoes futuras,
sem alterar fluxo, schema, rotas publicas ou frontend.

## Eventos auditaveis mapeados

```text
DRAFT_CREATED
DRAFT_REUSED
DRAFT_CREATION_BLOCKED
DRAFT_CONFIRMATION_STARTED
DRAFT_CONFIRMED
DRAFT_CONFIRMATION_BLOCKED
ACTIVE_ENROLLMENT_FOUND
CONFLICT_DETECTED
DUPLICATE_DRAFT_BLOCKED
CLASS_LINK_PREPARED
FINANCIAL_LINK_PREPARED
SCHEDULE_LINK_PREPARED
NOTIFICATION_PREPARED
```

## Estrutura de auditoria encontrada

Itens existentes:

```text
confirmed_at e confirmed_by em enrollments para confirmacao DRAFT -> ACTIVE
req.id e X-Request-Id em backend/src/server.js
x-request-id lido em middlewares de erro
contrato LoggerInterface em backend/src/core/logger.js
auth com req.user/req.auth em backend/auth.js
controllers admin/internal resolvendo confirmedBy por body ou usuario autenticado
logs estruturados parciais em server/index.mjs e logs console em modulos legados
```

Itens nao encontrados:

```text
tabela dedicada de auditoria de Matriculas
modulo compartilhado de audit log persistente
repository/service de auditoria com politica de retencao
correlationId propagado ate todos os metodos da facade de Matriculas
mascara centralizada de payloads sensiveis
politica formal de retencao ou expurgo de logs de auditoria
```

## Decisao tecnica

Contrato/documentacao preparatoria.

Nao foi implementada auditoria persistente nesta sprint.

Motivos:

```text
nao existe tabela/modulo seguro de auditoria persistente
nao existe politica de retencao
logs atuais ainda misturam console, logger proprio e rotas legadas
persistir payloads agora poderia capturar dados pessoais, token, documento ou financeiro completo
schema/migration nao era indispensavel para manter o sistema funcional
```

## Contrato criado

Arquivo:

```text
backend/src/domains/enrollments/application/contracts/enrollment-audit.contract.js
```

Metodo exposto na facade:

```js
recordEnrollmentAuditEvent({
  enrollmentId,
  studentPersonId,
  studentProfileId,
  action,
  actor,
  occurredAt,
  requestId,
  correlationId,
  metadata,
})
```

O metodo retorna payload preparado, seguro e nao persistido:

```js
{
  action: "DRAFT_CONFIRMED",
  actor: "admin@j12.local",
  enrollmentId: "enrollment-id",
  studentPersonId: "person-id",
  studentProfileId: "profile-id",
  correlationId: "request-id",
  occurredAt: "2026-06-30T15:00:00.000Z",
  metadata: {
    preparedOnly: true,
    sensitiveDataRemoved: true
  },
  prepared: true,
  persisted: false,
  auditPayloadSafe: true,
  auditPersistenceEnabled: false,
  noAuditTableCreated: true
}
```

## Payload minimo

Campos permitidos:

```text
action
actor
enrollmentId
studentPersonId
studentProfileId
correlationId/requestId
occurredAt
metadata minima com escalares seguros
```

`metadata` aceita somente:

```text
string curta
number
boolean
null
```

Objetos, arrays e chaves sensiveis sao descartados.

## Dados proibidos

O contrato remove metadados com chaves relacionadas a:

```text
authorization
card/cartao
cnpj
cpf
document/documento
financeiro
password/senha
pagamento
rg
secret
stack
token
valor
```

Tambem permanece proibido gravar payload completo de pessoa/aluno, senha,
token, documento sensivel, stack trace ou dados financeiros completos.

## Estrategia para actor/correlationId

Actor atual:

```text
req.auth ou req.user
confirmedBy vindo do body quando permitido
fallback para email/login/id do usuario autenticado
```

Correlation atual:

```text
req.id
x-request-id
X-Request-Id na resposta
```

Para auditoria real futura:

```text
propagar requestId/correlationId das bordas HTTP ate a facade
usar actor resolvido pelo middleware autenticado
nao aceitar actor arbitrario em rotas externas sem validacao/autorizacao
```

## Riscos

```text
persistencia prematura pode vazar PII ou credenciais
sem retencao, auditoria pode crescer indefinidamente
sem correlationId padronizado, eventos ficam dificeis de rastrear entre rotas
falha de auditoria nao deve reverter matricula ja confirmada
logs legados com console ainda precisam saneamento antes de virarem fonte auditavel
```

## Smoke tests

Caminho adotado: contrato/documentacao preparatoria.

```text
ENROLLMENT_AUDIT_PREPARED=true
AUDIT_CONTRACT_DOCUMENTED=true
AUDIT_EVENTS_MAPPED=true
AUDIT_PAYLOAD_SAFE=true
AUDIT_PERSISTENCE_BLOCKED_BY_SCHEMA_OR_PATTERN_GAP=true
NO_AUDIT_TABLE_CREATED=true
OFFICIAL_FLOW_STILL_WORKING=true
NO_TEST_DATA_LEFT=true
```

## Lacunas

```text
sem tabela enrollment_audit_events
sem audit service compartilhado
sem politica formal de retencao
sem migration aprovada para auditoria completa
sem propagacao universal de requestId/correlationId no dominio
sem mascaramento centralizado reutilizavel por todos os dominios
```

## Proximos passos

```text
definir politica de retencao e acesso a eventos de auditoria
criar migration somente depois de aprovar tabela e indices
implementar service de auditoria tolerante a falha
propagar actor/correlationId a partir das rotas admin/internal
registrar eventos reais em DRAFT_CREATED, DRAFT_REUSED, DRAFT_CONFIRMED e bloqueios
padronizar logs estruturados fora do legado antes de usar como trilha operacional
```
