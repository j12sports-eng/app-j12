# ADR-0007 â€” EstratÃ©gia do Auth Runtime Legado

## Status

Proposto para validaÃ§Ã£o final da Sprint 0.6.

## Contexto

Durante a implantaÃ§Ã£o da MatrÃ­cula Digital CanÃ´nica, foi identificado que a tabela `j12_usuarios` possui um contrato estrutural diferente do manifesto da migration histÃ³rica `20260712184500_create_auth_runtime_tables`.

O banco real mantÃ©m `j12_usuarios` com tipos e regras legadas, incluindo IDs numÃ©ricos, campos `ENUM`, `TIMESTAMP` e ausÃªncia do Ã­ndice Ãºnico esperado no manifesto moderno.

Alterar essa tabela automaticamente poderia quebrar login, permissÃµes, portais e vÃ­nculos existentes.

## DecisÃ£o

A tabela `j12_usuarios` serÃ¡ tratada como uma fronteira de compatibilidade legada atÃ© a conclusÃ£o da auditoria de todos os seus consumidores.

ClassificaÃ§Ã£o proposta:

**LEGACY_AUTH_TABLE**

O nÃºcleo canÃ´nico de identidade e acesso serÃ¡ formado por:

- `people`
- `person_profiles`
- `auth_identities`
- `user_unit_memberships`
- `users`
- `enrollments`

## Regras

1. Nenhum mÃ³dulo canÃ´nico novo deve criar dependÃªncia direta de `j12_usuarios`.
2. A tabela nÃ£o deve ser alterada automaticamente para imitar o manifesto moderno.
3. ConversÃµes de ID, `ENUM`, `TIMESTAMP` ou unicidade de e-mail exigem preflight de dados e migration especÃ­fica.
4. A migration histÃ³rica somente poderÃ¡ ser registrada apÃ³s uma adoÃ§Ã£o auditada que represente fielmente o estado real.
5. A autenticaÃ§Ã£o legada deve continuar funcional durante toda a transiÃ§Ã£o.

## ConsequÃªncias

### BenefÃ­cios

- preservaÃ§Ã£o do login existente;
- reduÃ§Ã£o do risco de regressÃ£o;
- separaÃ§Ã£o clara entre legado e canÃ´nico;
- transiÃ§Ã£o gradual para `auth_identities` e memberships por unidade.

### RestriÃ§Ãµes

- manutenÃ§Ã£o temporÃ¡ria de dois modelos de autenticaÃ§Ã£o;
- necessidade de guards arquiteturais;
- necessidade de preflight antes de qualquer alteraÃ§Ã£o em `j12_usuarios`;
- necessidade de validaÃ§Ã£o funcional de login, sessÃ£o e recuperaÃ§Ã£o de senha.
