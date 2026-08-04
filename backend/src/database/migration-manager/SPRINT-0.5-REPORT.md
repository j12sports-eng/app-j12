# Sprint 0.5 — Reconciliação segura do Auth Runtime

## Diagnóstico final do Auth Runtime

A migration histórica `20260712184500_create_auth_runtime_tables` foi lida integralmente e
comparada ao manifesto versionado. O snapshot confirmado nesta sprint indica as quatro tabelas,
suas colunas principais e seus índices presentes. O desvio confirmado limita-se a charset e
collation de `users`, `user_sessions` e `password_reset_tokens`. `j12_usuarios` já está no
padrão esperado e não pertence à migration corretiva.

Nenhuma consulta foi feita ao banco real. A conclusão sobre o estado atual está limitada ao
snapshot local confirmado no início da sprint. O novo preflight aborta diante de coluna textual
extra, engine inesperado, FK que exija revisão, charset/collation não revisados ou índice que possa
estourar após utf8mb4.

## Diferenças reais

| Artefato                             | Atual confirmado                                                                                                                                                                                                  | Esperado pelo SQL/manifesto               | Compatível | Ação                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ---------- | ------------------------ |
| `j12_usuarios`                       | tabela presente                                                                                                                                                                                                   | tabela presente                           | sim        | nenhuma                  |
| colunas de `j12_usuarios`            | `id bigint unsigned AI`; `nome/email varchar(191)`; `senha_hash varchar(255)`; `perfil varchar(50) default aluno`; IDs relacionados `varchar(64) null`; `status varchar(30) default ativo`; timestamps `datetime` | mesmas definições, nullability e defaults | sim        | nenhuma                  |
| índices de `j12_usuarios`            | PK, unique email e índices de perfil/aluno/professor/responsável                                                                                                                                                  | mesmos nomes, ordem e unicidade           | sim        | nenhuma                  |
| opções de `j12_usuarios`             | InnoDB, utf8mb4, utf8mb4_unicode_ci                                                                                                                                                                               | InnoDB, utf8mb4, utf8mb4_unicode_ci       | sim        | fora do escopo corretivo |
| `users`                              | tabela presente                                                                                                                                                                                                   | tabela presente                           | sim        | nenhuma recriação        |
| colunas de `users`                   | IDs, name/email/login, password hash/salt, role, vínculos, scope JSON, WhatsApp, status e timestamps conforme SQL                                                                                                 | mesmos tipos, nullability e defaults      | sim        | preservar integralmente  |
| índices de `users`                   | PK; unique email/login; índices role/aluno/professor/responsável                                                                                                                                                  | mesmos nomes, ordem e unicidade           | sim        | preservar integralmente  |
| engine de `users`                    | InnoDB                                                                                                                                                                                                            | InnoDB                                    | sim        | validar antes do DDL     |
| charset de `users`                   | utf8                                                                                                                                                                                                              | utf8mb4                                   | não        | conversão versionada     |
| collation de `users`                 | utf8_unicode_ci                                                                                                                                                                                                   | utf8mb4_unicode_ci                        | não        | conversão versionada     |
| `user_sessions`                      | tabela, token/user/timestamps e PK/índices user/expires presentes                                                                                                                                                 | mesmas definições                         | sim        | preservar integralmente  |
| engine de `user_sessions`            | InnoDB                                                                                                                                                                                                            | InnoDB                                    | sim        | validar antes do DDL     |
| charset de `user_sessions`           | utf8                                                                                                                                                                                                              | utf8mb4                                   | não        | conversão versionada     |
| collation de `user_sessions`         | utf8_unicode_ci                                                                                                                                                                                                   | utf8mb4_unicode_ci                        | não        | conversão versionada     |
| `password_reset_tokens`              | tabela, token/user/channel/timestamps e PK/índices user/expires presentes                                                                                                                                         | mesmas definições                         | sim        | preservar integralmente  |
| engine de `password_reset_tokens`    | InnoDB                                                                                                                                                                                                            | InnoDB                                    | sim        | validar antes do DDL     |
| charset de `password_reset_tokens`   | utf8                                                                                                                                                                                                              | utf8mb4                                   | não        | conversão versionada     |
| collation de `password_reset_tokens` | utf8_unicode_ci                                                                                                                                                                                                   | utf8mb4_unicode_ci                        | não        | conversão versionada     |

Não foi identificada outra diferença na evidência local disponível. Dados, valores de hash,
senhas e tokens não foram lidos.

## Classificação TABLE_OPTION_DRIFT

O Doctor agora classifica separadamente:

- `STRUCTURAL_DRIFT`: ausência/incompatibilidade de tabela, coluna, PK/índice, FK ou generated
  column;
- `TABLE_OPTION_DRIFT`: engine, charset, collation, row format ou create options;
- `FORMAL_DRIFT`: estrutura fisicamente presente com ledger pendente.

`TABLE_OPTION_DRIFT` não equivale a `PHYSICALLY_PRESENT`. Sem decisão específica, o baseline é
bloqueado com `TABLE_OPTION_RECONCILIATION_REQUIRED`.

## Migration corretiva criada

`20260803133000_reconcile_auth_runtime_charset_collation` atua exclusivamente em:

- `users`;
- `user_sessions`;
- `password_reset_tokens`.

Ela valida existência, InnoDB, definição das colunas textuais, uniformidade de charset/collation,
índices sob o limite conservador de utf8mb4, FKs, versão/`sql_mode` e metadados de tamanho.
Situação não revisada aborta antes do DDL. Quando segura, usa somente
`ALTER TABLE ... CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`. Estado já canônico
gera zero ALTER. Não há DML, recriação, rename ou alteração de nullability/default.

## Estratégia de ledger/baseline

Aplicar a corretiva antes de formalizar sua dependência histórica produziria uma linha do tempo
incoerente. A ordem escolhida é:

1. baseline controlado da histórica com exceção auditada;
2. apply-one da corretiva;
3. Doctor confirma as três tabelas exatamente em utf8mb4/utf8mb4_unicode_ci;
4. migrations dependentes do Auth Runtime podem prosseguir.

A corretiva depende da histórica. `create_auth_identities_table` passou a depender da corretiva,
fechando a ordem formal e impedindo evolução do domínio no intervalo.

## Política de exceção auditada

O manifesto de adoção contém ID, checksum SHA-256 histórico, confirmação estrutural, as seis
diferenças temporárias aceitas, migration corretiva obrigatória, ordem, prazo, justificativa e
evidência. A exceção é fechada para esse ID/checksum e exige que a corretiva exista no catálogo,
tenha manifesto e dependa da histórica. Diferença adicional, checksum diferente ou outro ID
permanece bloqueado. Não existe `--force`.

## Preflight operacional

O `apply-one --dry-run` da corretiva integra um preflight somente leitura e inclui seu snapshot no
token. A saída apresenta tabelas, opções atuais/esperadas, contagem, linhas/tamanhos estimados,
row format, maior índice projetado, FKs, risco LOW/MEDIUM/HIGH, risco de lock, commit implícito,
backup obrigatório, versão MySQL, `sql_mode`, bloqueios e token.

Comprimentos máximos são agregados somente para colunas não secretas. Password hash/salt e token
não são consultados nas tabelas operacionais. Espaço livre de filesystem fica explicitamente
indisponível quando não houver fonte portátil; deve ser validado externamente.

## Procedimento de backup

1. dump de schema das três tabelas;
2. dump de dados das três tabelas;
3. teste de integridade e restauração isolada;
4. registro de identificador, checksum, local e horário;
5. janela de manutenção com escritas drenadas;
6. apply-one com banco, remoto, backup, token e tabelas confirmados.

## Procedimento de validação pós-aplicação

1. confirmar exatamente utf8mb4/utf8mb4_unicode_ci nas três tabelas;
2. confirmar ledger APPLIED somente para a corretiva;
3. confirmar fingerprints das tabelas não selecionadas e legadas;
4. executar Doctor e validate;
5. validar login;
6. validar criação/uso/expiração de sessões;
7. validar solicitação e consumo de recuperação de senha.

MySQL DDL pode reconstruir tabelas, consumir espaço temporário, obter metadata lock, interromper
escritas e efetuar commit implícito. Não se promete rollback automático. Converter de volta para
utf8 pode perder caracteres; após sucesso, prefere-se forward-fix. Em falha irrecuperável, usar
restauração via backup validado.

## Testes executados

A suíte dedicada contém os 24 casos obrigatórios da Sprint 0.5. Todos usam fakes, inspeção estática
e injeção de dependências. Os gates finais são `npm test`, `node --check` em todos os JS/CJS/MJS
alterados e `git diff --check`.

## Arquivos criados

- migration corretiva;
- policy e manifesto de baseline adoption;
- integração de preflight;
- suíte Sprint 0.5;
- este relatório.

## Arquivos alterados

- classificação/inspeção do Doctor;
- manifestos e dependências canônicas;
- baseline/apply-one/token/CLI/formatter;
- README e snapshots de testes existentes.

## Riscos restantes

- duração e espaço temporário dependem do ambiente real e não foram estimados com falsa precisão;
- concorrência pode ampliar a espera por metadata lock;
- espaço livre deve ser confirmado externamente;
- backup e janela devem ser autorizados e executados antes de qualquer write;
- nenhum write foi autorizado nesta sprint.
