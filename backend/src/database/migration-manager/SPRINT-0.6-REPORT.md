# Sprint 0.6 — Reconciliação Estrutural do Auth Runtime

## Status

Implementação e validação técnica concluídas em modo somente leitura. A adoção formal no ledger e a migration corretiva permanecem pendentes de aprovação operacional explícita.

## Objetivo

Definir o papel real de `j12_usuarios`, separar autenticação legada do núcleo canônico e preparar uma adoção formal sem alterar o banco.

## Causa raiz

A tabela `j12_usuarios` do banco real não corresponde ao contrato moderno esperado pela migration histórica.

Diferenças observadas incluem:

- `id` numérico legado;
- campos `nome` e `email` menores;
- `perfil` e `status` como `ENUM`;
- vínculos `aluno_id`, `professor_id` e `responsavel_id` numéricos;
- timestamps legados;
- ausência de índice único de e-mail;
- charset/collation legados.

Essas diferenças não podem ser classificadas apenas como drift de table options.

## Decisão proposta

- preservar `j12_usuarios` como `LEGACY_AUTH_TABLE`;
- impedir novas dependências canônicas diretas;
- usar `users`, `auth_identities` e `user_unit_memberships` como caminho moderno;
- não modernizar `j12_usuarios` in-place sem preflight e necessidade funcional comprovada.

## Ordem recomendada para destravar a nova matrícula

```text
People
↓
Enrollments
↓
Adoção formal do Auth Runtime legado
↓
Reconciliação segura de charset das tabelas modernas
↓
Auth Identities
↓
User Unit Memberships
↓
Ownership por unidade
↓
DRAFT
↓
Convite
↓
Documentos
↓
Contrato
↓
Revisão administrativa
```

## Operações proibidas sem nova aprovação

- converter IDs de `INT` para `VARCHAR`;
- converter `ENUM` para `VARCHAR`;
- converter timestamps;
- adicionar `UNIQUE(email)` sem verificar duplicidade;
- executar a migration histórica;
- executar baseline com drift estrutural;
- alterar tabelas legadas de matrícula.

## Validações concluídas

- auditoria dos consumidores do Auth Runtime concluída;
- guards contra novas dependências canônicas diretas em `j12_usuarios` validados;
- `npm test`: 165 testes aprovados, 0 falhas;
- testes focados da Sprint 0.6 aprovados;
- `node --check` aprovado nos arquivos do escopo;
- Prettier aprovado;
- `git diff --check` aprovado;
- zero regressões detectadas pela suíte automatizada;
- `plan` executado contra o banco real em modo somente leitura;
- `baseline --dry-run` executado contra o banco real sem escrita;
- `apply-one --dry-run` da reconciliação de charset/collation executado sem escrita;
- preflight operacional classificado como `safeToApply: true`;
- risco operacional classificado como `LOW`;
- nenhum blocker operacional encontrado no preflight da reconciliação.

## Estado observado no banco real

O Migration Manager identificou:

- 38 migrations no catálogo;
- 4 migrations aplicadas no ledger e 34 pendentes;
- 1 baseline atualmente elegível;
- 1 drift formal;
- 17 casos de drift estrutural no diagnóstico detalhado;
- 2 casos de drift de opções de tabela;
- 16 migrations com estado físico desconhecido;
- 1 diagnóstico de ownership ambíguo.

A única migration proposta pelo `baseline --dry-run` foi:

`20260712184500_create_auth_runtime_tables`

A adoção foi aceita pelos critérios:

- `AUDITED_LEGACY_AUTH_ADOPTION`;
- `AUDITED_TABLE_OPTION_ADOPTION`.

Nenhuma escrita foi realizada.

## Preflight da reconciliação do Auth Runtime

A migration:

`20260803133000_reconcile_auth_runtime_charset_collation`

foi avaliada em `apply-one --dry-run`.

Resultado observado:

- MySQL `5.7.44-48`;
- tabelas avaliadas: `users`, `user_sessions` e `password_reset_tokens`;
- 3 de 3 tabelas requerem conversão de `utf8/utf8_unicode_ci` para `utf8mb4/utf8mb4_unicode_ci`;
- `safeToApply: true`;
- risco `LOW`;
- risco de overflow de índice não identificado;
- nenhum blocker operacional;
- backup obrigatório antes de eventual execução;
- DDL possui commit implícito;
- eventual `ALTER TABLE ... CONVERT` pode obter metadata lock;
- valores sensíveis não foram consultados.

A migration permanece corretamente inelegível neste momento pelo motivo:

`DEPENDENCY_NOT_APPLIED`

Dependência pendente:

`20260712184500_create_auth_runtime_tables`

## Próxima decisão operacional

Nenhum `baseline --write` ou `apply-one --write` foi executado durante a validação da Sprint 0.6.

Antes de qualquer escrita no banco real, é necessária nova aprovação operacional explícita, revisão do backup e nova conferência dos tokens e parâmetros gerados pelo dry-run imediatamente anterior à operação.
