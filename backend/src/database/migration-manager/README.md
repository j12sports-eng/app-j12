# J12 Migration Manager

Ferramenta complementar ao J12 Doctor para administrar o ciclo de vida das migrations canônicas. Os comandos plan, baseline --dry-run, apply-one --dry-run e validate são estritamente somente leitura. O comando baseline --write registra exclusivamente um baseline formal no ledger canônico: ele nunca chama up(), nunca executa o SQL de uma migration e nunca escreve em tabelas de domínio ou legadas. O comando apply-one --write foi implementado para uma aplicação unitária futura, mas não foi executado nesta sprint.

## Comandos

```powershell
node backend/src/database/migration-manager/cli.js plan --confirm-database=j12_sports
node backend/src/database/migration-manager/cli.js baseline --dry-run --confirm-database=j12_sports
node backend/src/database/migration-manager/cli.js apply-one --dry-run --migration=<MIGRATION_ID> --confirm-database=j12_sports
node backend/src/database/migration-manager/cli.js validate --confirm-database=j12_sports
```

Use --format=json para saída estruturada. Em host remoto, --allow-remote também é obrigatório. A confirmação informada em --confirm-database deve coincidir exatamente com DB_NAME.

Os comandos apply e report continuam reservados e bloqueados. Rollback automático de migrations não está disponível.

## Apply-one controlado

O dry-run unitário mostra a migration selecionada, checksum, dependências, estado no ledger, estado físico, ações previstas resumidas, risco, elegibilidade, bloqueios e token esperado. Ele não cria cliente de escrita e não chama executor ou ledger.

Uma escrita futura exige todas as confirmações abaixo:

```powershell
node backend/src/database/migration-manager/cli.js apply-one --write --migration=<MIGRATION_ID> --confirm-database=j12_sports --confirm-apply=<TOKEN_DO_DRY_RUN> --confirm-backup=<IDENTIFICADOR_EXTERNO>
```

Para a reconciliação do Auth Runtime, o escopo também precisa ser confirmado literalmente e,
quando o alvo for remoto, `--allow-remote` é obrigatório:

```powershell
node backend/src/database/migration-manager/cli.js apply-one --write --migration=20260803133000_reconcile_auth_runtime_charset_collation --confirm-database=j12_sports --allow-remote --confirm-backup=<IDENTIFICADOR_EXTERNO> --confirm-apply=<TOKEN_DO_DRY_RUN> --confirm-tables=users,user_sessions,password_reset_tokens
```

Antes de criar o cliente de escrita, o Manager verifica:

- migration existente no catálogo e com manifest completo;
- estado LEDGER_PENDING e checksum compatível;
- todas as dependências em LEDGER_APPLIED com checksum compatível;
- ausência de ownership ambíguo;
- estado físico ausente para migrations normais;
- apenas drift e achados explicitamente revisados para migrations corretivas;
- token vigente e plano inalterado em uma segunda coleta imediata;
- confirmação de backup externo.

O token apply-one é SHA-256 determinístico de banco, migrationId, checksum, dependências com checksums/estado e snapshot integral do plano com checksums e estados formal/físico. Qualquer mudança invalida a confirmação.

Depois da execução, o Manager exige que exatamente o ID selecionado tenha sido retornado pelo runner oficial, esteja APPLIED com o checksum correto e fisicamente presente. Também compara o fingerprint das tabelas não afetadas e das tabelas legadas. Falha posterior é crítica e requer intervenção manual.

## Backup e rollback operacional

O parâmetro --confirm-backup registra um identificador de backup externo já concluído; ele não cria nem simula um backup. Antes de qualquer autorização futura:

1. gerar dump somente do schema;
2. gerar dump das tabelas que o dry-run listou como afetadas;
3. validar integridade, leitura e restauração dos dumps em ambiente isolado;
4. registrar um identificador imutável do backup;
5. executar somente o apply-one autorizado;
6. executar Doctor, validate e validações funcionais;
7. se necessário, seguir um plano manual revisado de rollback/restauração.

ALTER TABLE e CREATE TABLE podem causar commit implícito no MySQL. Por isso o fluxo declara ddlImplicitCommit=true e automaticRollback=false. As migrations corretivas desta sprint possuem down fail-closed: não removem artefatos nem fingem atomicidade que o banco não oferece.

## Reconciliação do Auth Runtime

O Doctor separa `STRUCTURAL_DRIFT`, `TABLE_OPTION_DRIFT` e `FORMAL_DRIFT`.
Diferenças de engine, charset, collation, row format ou create options nunca são aceitas
silenciosamente. Por padrão, o baseline retorna
`TABLE_OPTION_RECONCILIATION_REQUIRED`. A única exceção atual é o manifesto versionado do
Auth Runtime, fechado pelo ID e checksum da migration histórica, pelas diferenças temporárias
aceitas e pela migration corretiva obrigatória.

A ordem formal é:

1. baseline controlado de `20260712184500_create_auth_runtime_tables` com a exceção auditada;
2. apply-one de `20260803133000_reconcile_auth_runtime_charset_collation`;
3. somente depois, evolução para `20260724120000_create_auth_identities_table`.

Essa ordem evita registrar a corretiva antes de sua dependência histórica e preserva o que
realmente ocorreu no banco. Não existe `--force`.

O dry-run da corretiva executa um preflight somente leitura. Ele coleta metadados de tamanho,
estimativa de linhas, engine, charset/collation, row format, índices, FKs, colunas textuais,
comprimentos máximos agregados não sensíveis, versão do MySQL e `sql_mode`. O risco é expresso
apenas como LOW, MEDIUM ou HIGH. Senhas, hashes e tokens não são consultados em tabelas
operacionais nem impressos. Espaço livre do filesystem é informado somente quando disponível;
caso contrário, o write permanece condicionado a uma verificação externa.

`ALTER TABLE ... CONVERT TO CHARACTER SET` pode reconstruir toda a tabela, consumir espaço
temporário, aguardar ou manter metadata lock, interromper escritas e efetuar commit implícito.
Por isso, mesmo um risco qualitativo LOW exige janela de manutenção e backup validado.

### Backup, aplicação e validação

Antes de qualquer autorização real:

1. gerar dump do schema somente de `users`, `user_sessions` e `password_reset_tokens`;
2. gerar dump dos dados somente dessas três tabelas;
3. validar integridade e restauração dos dumps em ambiente isolado;
4. registrar identificador imutável, checksum, local e horário do backup;
5. abrir janela de manutenção e interromper ou drenar escritas de autenticação;
6. executar exatamente o apply-one confirmado;
7. repetir Doctor/preflight e validar login e renovação/uso de sessões;
8. validar solicitação e consumo de recuperação de senha.

Não há rollback automático confiável para esse DDL. Converter de volta para `utf8` pode perder
caracteres que passaram a ser válidos em `utf8mb4`. Após sucesso, prefira forward-fix; diante de
falha irrecuperável, execute restauração via backup validado, em janela controlada e com revisão
manual.

## Limite legado

As tabelas j12_alunos, j12_matricula_numeros e j12_matriculas_publicas são somente observadas no fingerprint de segurança. Nenhuma migration ou writer desta sprint escreve nelas.

O relatório técnico do Auth Runtime está em [SPRINT-0.5-REPORT.md](./SPRINT-0.5-REPORT.md).
O ajuste de normalização e adoção exata está em
[SPRINT-0.5.1-REPORT.md](./SPRINT-0.5.1-REPORT.md).
O relatório da cadeia DRAFT permanece em [SPRINT-0.4-REPORT.md](./SPRINT-0.4-REPORT.md).

## Dry-run e token

O dry-run recalcula o catálogo, o ledger e o schema físico pelo J12 Doctor, aplica a policy central e exibe:

- as candidatas BASELINE_READY em ordem canônica;
- os bloqueios objetivos de cada migration não elegível;
- a lista exata para --only em confirmation.only;
- o token esperado em confirmation.expectedToken.

O token é o SHA-256 do JSON estável abaixo:

```json
{
  "version": "J12_BASELINE_V1",
  "databaseName": "<nome exato>",
  "count": 1,
  "migrations": [
    {
      "id": "<id em ordem canônica>",
      "checksum": "<sha256 do arquivo>"
    }
  ]
}
```

Banco, quantidade, IDs, checksums ou ordem diferentes produzem outro token.

## Baseline controlado

Somente depois de revisar o dry-run, a escrita pode ser solicitada com a lista completa e o token exibidos:

```powershell
node backend/src/database/migration-manager/cli.js baseline --write --confirm-database=j12_sports --only=<id1,id2> --confirm-baseline=<TOKEN_EXIBIDO_NO_DRY_RUN>
```

As quatro confirmações são obrigatórias:

1. o modo --write;
2. o banco exato em --confirm-database;
3. a lista completa e ordenada em --only;
4. o token vigente em --confirm-baseline.

Antes de criar o cliente de escrita, o Manager faz uma coleta atual e uma segunda revalidação imediata. A lista deve coincidir integralmente com o plano BASELINE_READY. Migrations extras, ausentes, fora de ordem, UNKNOWN, bloqueadas, com drift estrutural, checksum divergente, dependência não satisfeita ou ownership ambíguo abortam a operação.

## Ledger canônico

O modo write reutiliza MySqlMigrationLedger e somente a tabela oficial j12_schema_migrations. Nenhum ledger paralelo é criado. Um registro de baseline é gravado como APPLIED, com started_at e applied_at iguais, execution_ms = 0 e o checksum canônico.

O Manager obtém o lock canônico antes de qualquer mutação. Como CREATE TABLE pode causar commit implícito no MySQL, a criação do ledger, quando necessária e explicitamente autorizada pelo modo write, ocorre e é validada em uma etapa DDL separada. Os registros são então inseridos dentro de uma transação:

1. reler o ledger sob lock;
2. iniciar a transação;
3. validar novamente status e checksums;
4. inserir na ordem canônica;
5. reler e verificar todos os registros;
6. fazer commit.

Erro durante os inserts provoca rollback. Se a validação após o commit falhar, os registros não são apagados automaticamente; o comando retorna erro crítico e exige intervenção manual.

## Idempotência e validação posterior

Repetir a mesma lista confirmada após um baseline bem-sucedido não duplica registros. O comando só retorna sucesso sem escrita se todos os IDs estiverem APPLIED, com os mesmos checksums e sem drift estrutural.

Depois do commit, o estado é coletado novamente. A operação só é aprovada quando:

- todos os IDs solicitados estão APPLIED com os checksums esperados;
- as contagens de aplicadas e pendentes refletem somente os registros inseridos;
- o drift formal das candidatas desapareceu;
- as candidatas deixaram de ser BASELINE_READY;
- o drift estrutural global permaneceu igual;
- o fingerprint de todas as tabelas, exceto o próprio ledger, permaneceu idêntico.

A saída de auditoria contém banco, host/remoto, IDs, checksums, criação do ledger, contagens antes/depois, token confirmado, indicação de escrita, timestamp e resultado da validação posterior. Credenciais nunca são impressas.

## Arquitetura

- baseline-eligibility-policy.js: fonte única de BASELINE_READY e BASELINE_BLOCKED.
- baseline-token.js: payload determinístico e SHA-256.
- baseline-write-manager.js: dupla revalidação, confirmação, escrita e pós-validação.
- baseline-ledger-writer.js: lock, DDL separado, transação, idempotência e verificação.
- write-database-client.js: pool exclusivo de escrita e adapter oficial do ledger.
- apply-manager.js: policy, token, dupla revalidação, execução unitária e pós-validação.
- apply-one-database-client.js: composição do runner, executor e ledger oficiais.
- apply-one-token.js: payload determinístico do plano unitário.
- draft-chain.js: cálculo transitivo e classificação da cadeia mínima de DRAFT.
- report-manager.js: J12 Doctor e plano dry-run do runner canônico.
- cli.js: guardas do alvo, flags explícitas, auditoria e exit codes.

## Testes

```powershell
npm test
npm run migration-manager:test
```

Os testes usam somente fakes e inspeção estática. Eles não carregam credenciais reais, não abrem conexão real, não criam ledger, não aplicam migration e não alteram schema ou dados.

<!-- SPRINT-0.6-AUTH-BOUNDARY:START -->

## Fronteira de autenticação legada

`j12_usuarios` é tratada como `LEGACY_AUTH_TABLE` até a conclusão da auditoria e da adoção formal.

### Regras

- não modernizar a tabela automaticamente;
- não criar novas dependências canônicas diretas;
- não converter IDs, ENUMs ou timestamps sem preflight;
- não adicionar `UNIQUE(email)` sem validar duplicidade;
- não executar a migration histórica para recriar estruturas existentes.

### Ordem operacional

```text
Adoção auditada do legado
→ reconciliação das tabelas modernas de autenticação
→ auth_identities
→ user_unit_memberships
→ ownership
→ DRAFT canônico
```

### Segurança

Toda escrita futura exige:

- plano em `--dry-run`;
- backup validado;
- token de confirmação;
- revalidação imediatamente antes da execução;
- validação funcional após a operação.

<!-- SPRINT-0.6-AUTH-BOUNDARY:END -->
