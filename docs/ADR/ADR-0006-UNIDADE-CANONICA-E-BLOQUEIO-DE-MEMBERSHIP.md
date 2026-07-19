# ADR 0006 — Unidade canônica e bloqueio do membership usuário–unidade

## Status

Aceita em 19/07/2026 para a decisão de unidade; bloqueada para a identidade de usuário e para a implementação do membership.

## Contexto

A pré-matrícula interna precisa de autorização persistida por unidade. O runtime possui duas tabelas de unidade (`j12_unidades` e `unidades`) e duas fontes autenticáveis de usuário (`users` e `j12_usuarios`). Uma FK de membership só é segura quando aponta para identidades canônicas e estáveis.

## Alternativas avaliadas

1. Usar `j12_unidades` como unidade operacional.
2. Usar `unidades` como unidade operacional.
3. Tratar as duas tabelas de unidade como escopos autenticáveis distintos.
4. Adiar a decisão de unidade.
5. Vincular o membership a `users`.
6. Vincular o membership a `j12_usuarios`.
7. Criar FK polimórfica ou relacionar identidades por e-mail.

## Decisão

`j12_unidades` é formalizada como a entidade canônica de unidade operacional. A tabela `unidades` permanece legada, não será removida nem migrada nesta Sprint e não poderá ser usada como fallback pelo futuro membership.

A implementação do membership é bloqueada até que exista uma identidade autenticável canônica, com mapeamento físico estável entre as origens legadas. Não será criada FK para apenas uma origem enquanto a outra continuar emitindo identidades válidas, nem FK polimórfica, vínculo por e-mail ou conversão implícita de IDs.

## Evidências

- A rota montada `/unidades`, o catálogo público, Turmas, Pessoas, BI e Financeiro consultam `j12_unidades`.
- O frontend consome `/unidades`, cuja composição principal usa `backend/src/routes/unidades.routes.js` e `j12_unidades`.
- Nenhuma consulta de runtime encontrada usa `unidades` como catálogo operacional.
- No banco auditado, `j12_unidades` contém 3 registros (IDs 3, 4 e 5) e `unidades` contém 0.
- Não existem FKs para nenhuma das duas tabelas; há referências lógicas a unidade em vários domínios.
- O banco executa Percona Server 5.7.44-48.
- O schema real de `j12_unidades.status` é `ENUM('ativa','inativa')`, enquanto o DDL de runtime e rotas usam o vocabulário `ativo`/`inativo`; os 3 registros auditados têm status vazio. Esse drift impede afirmar unidade ativa de forma segura sem saneamento aprovado.
- `authenticateUserDetailed` autentica primeiro em `j12_usuarios` e depois em `users`; ambas são fontes válidas.
- `createSession` emite JWT com `sub` e `source` da origem autenticada; `getUserBySessionToken` relê a mesma origem.
- No banco auditado há 201 linhas em `users` e 97 em `j12_usuarios`: 94 correspondem por e-mail, 107 existem apenas em `users` e 3 apenas em `j12_usuarios`.
- Nenhuma das 94 correspondências possui o ID de espelho determinístico `j12u-<id>`; há pares com status divergente.
- E-mail é PII mutável e não constitui chave estrangeira ou mapeamento de identidade aprovado.
- `user_sessions` referencia logicamente apenas `users`, mas JWTs válidos podem referenciar diretamente `j12_usuarios`; não há FK física em `user_sessions`.
- O banco não possui ledger `j12_schema_migrations`; o runner lista as 23 migrations catalogadas como pendentes.

## Consequências

- A escolha da unidade canônica fica disponível para convergência futura sem apagar o legado.
- Nenhuma tabela, migration, repository, Application Service, resolvedor ou middleware de membership será criada nesta Sprint sob identidade ambígua.
- `/internal/pre-enrollments` permanece desmontada e fail-closed.
- Admin ou coordenador global não recebe bypass de unidade.
- Nenhum usuário existente é associado automaticamente a qualquer unidade.
- O futuro modelo deverá suportar N:N, vínculo ativo/inativo, unidade ativa, papel contextual e seleção explícita quando houver múltiplas unidades.

## Compatibilidade

Não há alteração de contrato HTTP, JWT, sessão, tabela, dado ou rota. A decisão preserva integralmente as duas origens de autenticação e a tabela legada de unidade.

## Riscos

- O drift de status de `j12_unidades` precisa ser resolvido sem converter valores silenciosamente.
- A adoção do migration runner precisa de baseline operacional; executar `up` hoje tentaria aplicar o catálogo inteiro.
- Escolher `users` ou `j12_usuarios` sem reconciliação excluiria usuários autenticáveis válidos ou autorizaria a identidade errada.

## Estratégia futura para entidades não canônicas

1. Criar ADR específica para identidade autenticável canônica.
2. Projetar mapeamento físico, único e auditável entre `users` e `j12_usuarios`, sem e-mail como chave.
3. Definir migração de sessões/JWT com janela de compatibilidade e revogação controlada.
4. Formalizar `j12_unidades` no catálogo canônico de migrations e reconciliar seu status por preflight explícito.
5. Inventariar dados da tabela `unidades` antes de qualquer convergência; não remover nem copiar automaticamente.
6. Somente então criar a migration do membership e habilitar a composição HTTP após rollout comprovado.

## Referências

- `docs/BACKEND/SPRINT_28_3.md`
- `docs/BACKEND/SPRINT_28_4.md`
- `docs/DEPLOY/PRE_ENROLLMENT_INTEGRITY_MIGRATIONS_RUNBOOK.md`
- `backend/auth.js`
- `backend/src/config/db.js`
- `backend/src/server.js`
