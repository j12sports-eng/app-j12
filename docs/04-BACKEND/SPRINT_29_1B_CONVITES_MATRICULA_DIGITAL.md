# Sprint 29.1B - Convites de Matrícula Digital

## Objetivo

Criar a fundação backend segura para convites de matrícula digital vinculados a `enrollments` em estado `DRAFT`, sem expor rota pública operacional.

## Decisões

- Token bruto gerado com fonte criptográfica.
- Persistência somente de `token_hash`.
- Resolução por hash, nunca por token bruto.
- Um convite ativo por `Enrollment`, com chave gerada para compatibilidade MySQL 5.7/8.0.
- Acesso administrativo fail-closed via callback.
- `unitId` aceito apenas por contexto confiável.

## Arquitetura

- `domain`: entidade e enum de status.
- `application`: contrato de repository e service de convite.
- `infrastructure`: repository em memória, repository MySQL e composition interna.
- `database`: migration dedicada e testada por contrato.

## Migration

Tabela `enrollment_digital_invitations` com:

- `id`, `enrollment_id`, `unit_id`, `token_hash`, `status`, `expires_at`;
- `created_at`, `created_by`, `revoked_at`, `revoked_by`, `used_at`, `used_by`;
- `replaced_by_invitation_id`, `metadata_json`;
- índices para `token_hash`, `enrollment_id`, `unit_id`, `status`, `expires_at`;
- coluna gerada para impedir múltiplos `ACTIVE` por enrollment.

## Contratos Internos

- `createInvitation(command, context)`
- `revokeInvitation(command, context)`
- `renewInvitation(command, context)`
- `resolveInvitationByRawToken(command)`
- `markInvitationUsed(command)` opcional

## Ameaças Mitigadas

- Enumeração de token.
- Vazamento de token bruto em logs.
- Mass assignment.
- Duplicidade concorrente de convite ativo.
- Reuso de convite revogado ou expirado.

## Bloqueio De Membership/Unidade

O fluxo operacional público continua bloqueado até existir membership canônico no runtime. Esta sprint só prepara a base interna.

## Endpoints Não Montados

- Nenhuma rota pública nova.
- Nenhum endpoint foi registrado em `server.js`.

## Testes

- service/application;
- repository MySQL;
- migration contract;
- regressão de exports do domínio.

## Fora Do Escopo

- frontend;
- documentos;
- contrato;
- aceite;
- financeiro;
- turma;
- agenda;
- notificações;
- fluxo legado `/public/enrollments`.

## Próximos Passos Para 29.1C

- expor fluxo de consumo por token somente após resolver membership/unidade;
- conectar a experiência pública ao convite canônico sem reabrir o legado.
