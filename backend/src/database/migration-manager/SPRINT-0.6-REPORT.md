# Sprint 0.6 â€” ReconciliaÃ§Ã£o Estrutural do Auth Runtime

## Status

Parcialmente implementada. DocumentaÃ§Ã£o consolidada; validaÃ§Ã£o automatizada final ainda pendente.

## Objetivo

Definir o papel real de `j12_usuarios`, separar autenticaÃ§Ã£o legada do nÃºcleo canÃ´nico e preparar uma adoÃ§Ã£o formal sem alterar o banco.

## Causa raiz

A tabela `j12_usuarios` do banco real nÃ£o corresponde ao contrato moderno esperado pela migration histÃ³rica.

DiferenÃ§as observadas incluem:

- `id` numÃ©rico legado;
- campos `nome` e `email` menores;
- `perfil` e `status` como `ENUM`;
- vÃ­nculos `aluno_id`, `professor_id` e `responsavel_id` numÃ©ricos;
- timestamps legados;
- ausÃªncia de Ã­ndice Ãºnico de e-mail;
- charset/collation legados.

Essas diferenÃ§as nÃ£o podem ser classificadas apenas como drift de table options.

## DecisÃ£o proposta

- preservar `j12_usuarios` como `LEGACY_AUTH_TABLE`;
- impedir novas dependÃªncias canÃ´nicas diretas;
- usar `users`, `auth_identities` e `user_unit_memberships` como caminho moderno;
- nÃ£o modernizar `j12_usuarios` in-place sem preflight e necessidade funcional comprovada.

## Ordem recomendada para destravar a nova matrÃ­cula

```text
People
â†“
Enrollments
â†“
AdoÃ§Ã£o formal do Auth Runtime legado
â†“
ReconciliaÃ§Ã£o segura de charset das tabelas modernas
â†“
Auth Identities
â†“
User Unit Memberships
â†“
Ownership por unidade
â†“
DRAFT
â†“
Convite
â†“
Documentos
â†“
Contrato
â†“
RevisÃ£o administrativa
```

## OperaÃ§Ãµes proibidas sem nova aprovaÃ§Ã£o

- converter IDs de `INT` para `VARCHAR`;
- converter `ENUM` para `VARCHAR`;
- converter timestamps;
- adicionar `UNIQUE(email)` sem verificar duplicidade;
- executar a migration histÃ³rica;
- executar baseline com drift estrutural;
- alterar tabelas legadas de matrÃ­cula.

## ValidaÃ§Ãµes ainda pendentes

- auditoria completa de consumidores;
- testes da Sprint 0.6;
- `node --check`;
- Prettier;
- `git diff --check`;
- confirmaÃ§Ã£o de zero regressÃµes;
- relatÃ³rio final do preflight.
