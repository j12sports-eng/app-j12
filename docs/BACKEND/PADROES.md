# Padroes Backend

Padroes recomendados para manutencao do backend.

## Indice

- [Objetivo](#objetivo)
- [Organizacao](#organizacao)
- [Rotas](#rotas)
- [Controllers](#controllers)
- [Services](#services)
- [SQL](#sql)
- [Erros](#erros)
- [Seguranca](#seguranca)
- [Links Relacionados](#links-relacionados)

## Objetivo

Reduzir duplicidade, preservar compatibilidade e tornar o backend previsivel.

## Organizacao

Padrao alvo:

```text
backend/src/
  config/
  controllers/
  middlewares/
  routes/
  services/
  repositories/
  utils/
```

Atualmente, tambem existem `backend/routes`, `backend/services` e `server/routes`.

## Rotas

- Devem apenas montar endpoints e middlewares.
- Devem chamar controller ou handler pequeno.
- Devem usar `requireAuth` quando protegido.
- Devem retornar contratos consistentes.

## Controllers

- Validam input.
- Definem status HTTP.
- Chamam services.
- Nao devem conter SQL extenso em modulos novos.

## Services

- Concentram regra de negocio.
- Orquestram transacoes.
- Chamam repositories ou helpers de banco.
- Nao devem acessar `req`/`res`.

## SQL

- Usar parametros, nunca concatenar valores do usuario.
- Centralizar consultas repetidas.
- Documentar indices esperados.
- Manter compatibilidade com `dateStrings: true`.

## Erros

- Erros de validacao: 400.
- Auth: 401.
- Permissao: 403.
- Recurso ausente: 404.
- Banco indisponivel: 503.
- Inesperado: 500.

## Seguranca

- Nunca logar senha, token, certificado ou chave Pix.
- Nao usar segredos hardcoded.
- Validar env no boot ou antes do fluxo sensivel.
- Proteger rotas admin com `canManageSystem`.

## Links Relacionados

- [Servicos](./SERVICOS.md)
- [Rotas](./ROTAS.md)
- [Autenticacao](./AUTENTICACAO.md)
- [Banco Integridade](../BANCO/INTEGRIDADE.md)

