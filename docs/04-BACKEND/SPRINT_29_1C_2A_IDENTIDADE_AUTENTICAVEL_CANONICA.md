# Sprint 29.1C.2A - Identidade autenticavel canonica

## Problema

O runtime de autenticacao do J12 ainda aceita usuarios de duas origens reais:
`users` e `j12_usuarios`. Os dois modelos continuam operacionais, possuem tipos
de chave primaria diferentes e podem ter IDs colidentes. Usar apenas `sub` do JWT,
e-mail, CPF, telefone ou nome como chave canonica cria ambiguidade e acopla
autorizacao futura a dados pessoais mutaveis.

## Decisao

Criar a tabela interna `auth_identities` e o dominio `domains/auth` para representar
uma identidade autenticavel estavel por par `(source, source_user_id)`.

Campos minimos:

- `id`: identificador canonico estavel, `VARCHAR(64)`.
- `source`: origem real permitida (`users` ou `j12_usuarios`).
- `source_user_id`: PK real da origem preservada como string.
- `status`: estado da identidade canonica (`ACTIVE` ou `DISABLED`).
- `disabled_at`, `created_at`, `updated_at`.

## Por que nao e-mail

E-mail aparece nos fluxos atuais de login e sincronizacao, mas nao e chave canonica.
Ele pode mudar, pode existir em tabelas diferentes e tambem e PII. A identidade
canonica nao copia e-mail, nome, telefone, CPF, role, perfil, unidade ou escopo.

## Por que nao FK polimorfica

`source_user_id` aponta para duas tabelas com tipos fisicos diferentes. Uma FK falsa
ou por e-mail criaria integridade enganosa. A integridade e aplicada pelo service,
que resolve a origem real via adapters e falha fechado para origem desconhecida,
resolver ausente, usuario inexistente ou usuario inativo.

## Invariantes

- `source` usa allowlist estrita.
- `source_user_id` e string e respeita o formato da origem.
- `UNIQUE(source, source_user_id)` impede duas identidades para o mesmo usuario real.
- `resolveOrCreateIdentity` e idempotente.
- Corrida de criacao simultanea e tratada por duplicate key + releitura.
- Identidade `DISABLED` nao e retornada como utilizavel.
- Usuario de origem removido ou inativo impede nova resolucao.

## Seguranca

Logs e eventos seguros podem conter somente:

- `action`
- `authIdentityId`
- `source`
- `actorId`
- `requestId`
- `correlationId`
- `result`

Nao registrar `sourceUserId`, e-mail, token, senha, CPF, telefone, unidade, metadata
livre ou payloads brutos.

## Compatibilidade

Esta sprint nao altera login, emissao de JWT, `requireAuth`, `req.user`, `req.auth`,
sessoes legadas, rotas existentes ou autorizacao. O novo dominio fica disponivel
como fundacao interna para consumidores futuros.

## Backfill futuro

Nenhum backfill real foi executado. Uma sprint futura pode criar um processo
idempotente para materializar identidades existentes, sempre por `(source, id)` e
sem usar e-mail como vinculo.

## Membership futuro

Membership, unidade ativa, selecao de unidade e permissao por unidade continuam fora
do escopo. A identidade canonica e apenas o sujeito autenticavel estavel sobre o qual
essas capacidades poderao se apoiar.

## Fora de escopo

- Alterar login ou senha.
- Alterar JWT.
- Alterar `req.user`.
- Criar frontend.
- Criar rotas publicas.
- Criar membership.
- Criar unidade ativa.
- Fazer backfill em banco real.
- Consolidar fisicamente `users` e `j12_usuarios`.

## Proxima Sprint 29.1C.2B

Mapear a identidade canonica para membership por unidade, definindo contratos de
leitura, regras de escopo, migracao segura e rollout sem trocar o runtime de auth
existente.
