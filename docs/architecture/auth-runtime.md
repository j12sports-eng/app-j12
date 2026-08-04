# DomÃ­nio Auth Runtime

## Fronteira legada

### `j12_usuarios`

ClassificaÃ§Ã£o proposta: `LEGACY_AUTH_TABLE`.

Responsabilidades atuais a confirmar por auditoria:

- autenticaÃ§Ã£o e autorizaÃ§Ã£o legadas;
- compatibilidade com portais existentes;
- vÃ­nculos numÃ©ricos com aluno, professor e responsÃ¡vel;
- manutenÃ§Ã£o do contrato usado por cÃ³digo antigo.

Regra: novos repositories canÃ´nicos nÃ£o devem depender diretamente desta tabela.

## Runtime de autenticaÃ§Ã£o

### `users`

Responsabilidade proposta:

- conta de usuÃ¡rio do runtime moderno;
- credenciais e dados operacionais de autenticaÃ§Ã£o;
- integraÃ§Ã£o gradual com identidades canÃ´nicas.

### `user_sessions`

Responsabilidade:

- sessÃµes de usuÃ¡rio.

### `password_reset_tokens`

Responsabilidade:

- recuperaÃ§Ã£o de senha.

## Identidade e acesso canÃ´nicos

### `auth_identities`

Responsabilidade:

- identidade autenticÃ¡vel vinculada a uma pessoa.

### `user_unit_memberships`

Responsabilidade:

- vÃ­nculo do usuÃ¡rio com unidades;
- escopo de acesso;
- permissÃµes por unidade.

## Fluxo canÃ´nico desejado

```text
people
  â†“
person_profiles
  â†“
auth_identities
  â†“
user_unit_memberships
  â†“
users
  â†“
enrollments
```

## Fluxo legado durante a transiÃ§Ã£o

```text
j12_usuarios
  â†“
compatibilidade de autenticaÃ§Ã£o existente
```

## Regra arquitetural

O legado permanece funcional, mas nÃ£o deve receber novas responsabilidades do domÃ­nio canÃ´nico.
