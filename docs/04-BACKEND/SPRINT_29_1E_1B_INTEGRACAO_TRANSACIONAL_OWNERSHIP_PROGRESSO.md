# Sprint 29.1E.1B — Integração transacional

## Auditoria

People, Profile e Relationship aceitam `queryRunner`. Enrollment também aceita
runner explícito, mas seu método de idempotência com `GET_LOCK` abre e libera
uma conexão dedicada. Ele não pode ser chamado dentro de outra transação.

## Unit of Work

`createDigitalEnrollmentTransactionRunner` obtém uma conexão, inicia a
transação e cria todos os repositories ligados ao mesmo executor. Em sucesso
faz commit; em erro faz rollback; sempre libera a conexão. Erros inesperados
são sanitizados.

O `GET_LOCK` existente continua sendo usado pelos fluxos administrativos
atuais. A futura composition transacional deve usar o unique index do DRAFT e
resolver `ER_DUP_ENTRY` na mesma conexão, evitando nested connection/release.

## Ownership e progresso

O repository de Enrollment agora mapeia os três vínculos de forma aditiva.
Valores nulos continuam compatíveis com DRAFTs antigos. O gateway carrega
somente DRAFT com relacionamento/progresso coerentes e libera internamente
apenas `getForm`; comandos cadastrais continuam bloqueados.

## Limite da integração

`PreEnrollmentApplicationService` ainda não foi redirecionado para a Unit of
Work. A migration 29.1E.1A não foi executada e o fluxo atual não possui uma
composition root capaz de substituir todos os services por versões bound sem
alterar o runtime antes do schema.

Assim, ownership e progresso não são gravados pela pré-matrícula nesta entrega
parcial. Integrá-los depois do DRAFT violaria atomicidade, por isso o sistema
permanece fail-closed.

## Segurança e escopo

Nenhum endpoint público de escrita, frontend, documento, contrato, financeiro,
ativação, tabela legada ou marcação `USED` foi introduzido. Nenhuma migration
foi executada.

## Próximos passos

Criar uma composition da pré-matrícula que monte os application services com
os repositories bound recebidos pela Unit of Work, implementar create/find
idempotente sem abrir conexão dedicada e executar essa composição somente após
a migration canônica estar aplicada pelo processo operacional aprovado.
