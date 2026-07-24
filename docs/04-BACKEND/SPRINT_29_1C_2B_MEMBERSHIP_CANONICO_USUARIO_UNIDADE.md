# Sprint 29.1C.2B - Membership canonico usuario-unidade

## Problema

O ERP precisa autorizar escopos por unidade sem depender de `req.user`, role global,
rotas publicas de matricula ou tabelas legadas. A Sprint 29.1C.2A criou
`auth_identities`, mas ainda faltava o vinculo canonico entre a identidade
autenticavel e as unidades operacionais.

## Decisao

Criar o agregado `UserUnitMembership` no dominio `domains/auth`, com persistencia
em `user_unit_memberships`.

Campos canonicos:

- `id`: identificador do vinculo, `VARCHAR(64)`.
- `auth_identity_id`: FK para `auth_identities.id`.
- `unit_id`: FK para `j12_unidades.id`.
- `role`: role canonica do usuario dentro da unidade.
- `status`: `ACTIVE`, `INACTIVE` ou `REVOKED`.
- `is_default`: default ativo para selecao futura.
- `active_default_key`: coluna gerada para impedir mais de um default ativo por identidade.
- `created_by_auth_identity_id`: identidade canonica que concedeu o vinculo.
- `revoked_at`, `revoked_by_auth_identity_id`: auditoria minima de revogacao.

## Roles e Status

Roles permitidas nesta fundacao:

- `admin`
- `aluno`
- `coordenador`
- `professor`
- `responsavel`

Nao foi criado role novo como `secretaria` ou `viewer`, porque esses valores nao
existem como contrato canonico no runtime atual.

Status:

- `ACTIVE`: vinculo utilizavel.
- `INACTIVE`: vinculo desativado sem auditoria de revogacao.
- `REVOKED`: vinculo revogado, exige `revoked_at` e `revoked_by_auth_identity_id`.

## Invariantes

- Uma identidade so pode ter um vinculo por unidade.
- Apenas membership `ACTIVE` pode ser default.
- Uma identidade so pode ter um default ativo por vez.
- Default e alterado por operacao transacional no repository MySQL.
- Resolucao de identidade e unidade falha fechado quando adapters ausentes ou dados inativos.
- `checkActiveMembership` exige identidade ativa, unidade `ativo` e membership `ACTIVE`.
- Inputs aceitos seguem allowlist por comando para reduzir mass assignment.

## Persistencia

A migration `20260724123000_create_user_unit_memberships_table` cria:

- FK para `auth_identities`.
- FK para `j12_unidades`.
- `UNIQUE(auth_identity_id, unit_id)`.
- coluna gerada `active_default_key`.
- `UNIQUE(active_default_key)` para proteger default ativo por identidade.
- rollback fail-closed quando houver linhas.

`j12_unidades` e mantida como baseline runtime existente em `config/db.js`. Nao foi
criada migration de unidade nesta sprint.

## Seguranca

Esta sprint nao altera:

- Login.
- JWT.
- `req.user`.
- `req.auth`.
- Middlewares de auth existentes.
- Rotas publicas ou privadas.

Logs do service registram apenas ids canonicos, role, status, unidade, request id e
correlation id. Nenhum dado pessoal, token, senha, payload bruto ou metadata livre e
registrado.

## Fora de Escopo

- Criar endpoint.
- Montar rota.
- Alterar login/JWT.
- Criar seletor de unidade.
- Criar frontend.
- Criar backfill real.
- Alterar fluxos legados de matricula, documentos, contratos ou financeiro.

## Proxima Sprint 29.1C.2C

Consumir a membership canonica no runtime de autorizacao com adaptadores explicitos,
sem mudar o shape de `req.user` de forma abrupta. O passo seguinte esperado e
definir como o contexto de unidade ativa sera escolhido, validado e propagado.
