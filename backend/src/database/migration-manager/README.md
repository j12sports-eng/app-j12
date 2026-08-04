# J12 Migration Manager

Ferramenta complementar ao J12 Doctor para administrar o ciclo de vida das migrations canÃ´nicas. Os comandos plan, baseline --dry-run, apply-one --dry-run e validate sÃ£o estritamente somente leitura. O comando baseline --write registra exclusivamente um baseline formal no ledger canÃ´nico: ele nunca chama up(), nunca executa o SQL de uma migration e nunca escreve em tabelas de domÃ­nio ou legadas. O comando apply-one --write foi implementado para uma aplicaÃ§Ã£o unitÃ¡ria futura, mas nÃ£o foi executado nesta sprint.

## Comandos

```powershell
node backend/src/database/migration-manager/cli.js plan --confirm-database=j12_sports
node backend/src/database/migration-manager/cli.js baseline --dry-run --confirm-database=j12_sports
node backend/src/database/migration-manager/cli.js apply-one --dry-run --migration=<MIGRATION_ID> --confirm-database=j12_sports
node backend/src/database/migration-manager/cli.js validate --confirm-database=j12_sports
```

Use --format=json para saÃ­da estruturada. Em host remoto, --allow-remote tambÃ©m Ã© obrigatÃ³rio. A confirmaÃ§Ã£o informada em --confirm-database deve coincidir exatamente com DB_NAME.

Os comandos apply e report continuam reservados e bloqueados. Rollback automÃ¡tico de migrations nÃ£o estÃ¡ disponÃ­vel.

## Apply-one controlado

O dry-run unitÃ¡rio mostra a migration selecionada, checksum, dependÃªncias, estado no ledger, estado fÃ­sico, aÃ§Ãµes previstas resumidas, risco, elegibilidade, bloqueios e token esperado. Ele nÃ£o cria cliente de escrita e nÃ£o chama executor ou ledger.

Uma escrita futura exige todas as confirmaÃ§Ãµes abaixo:

```powershell
node backend/src/database/migration-manager/cli.js apply-one --write --migration=<MIGRATION_ID> --confirm-database=j12_sports --confirm-apply=<TOKEN_DO_DRY_RUN> --confirm-backup=<IDENTIFICADOR_EXTERNO>
```

Para a reconciliaÃ§Ã£o do Auth Runtime, o escopo tambÃ©m precisa ser confirmado literalmente e,
quando o alvo for remoto, `--allow-remote` Ã© obrigatÃ³rio:

```powershell
node backend/src/database/migration-manager/cli.js apply-one --write --migration=20260803133000_reconcile_auth_runtime_charset_collation --confirm-database=j12_sports --allow-remote --confirm-backup=<IDENTIFICADOR_EXTERNO> --confirm-apply=<TOKEN_DO_DRY_RUN> --confirm-tables=users,user_sessions,password_reset_tokens
```

Antes de criar o cliente de escrita, o Manager verifica:

- migration existente no catÃ¡logo e com manifest completo;
- estado LEDGER_PENDING e checksum compatÃ­vel;
- todas as dependÃªncias em LEDGER_APPLIED com checksum compatÃ­vel;
- ausÃªncia de ownership ambÃ­guo;
- estado fÃ­sico ausente para migrations normais;
- apenas drift e achados explicitamente revisados para migrations corretivas;
- token vigente e plano inalterado em uma segunda coleta imediata;
- confirmaÃ§Ã£o de backup externo.

O token apply-one Ã© SHA-256 determinÃ­stico de banco, migrationId, checksum, dependÃªncias com checksums/estado e snapshot integral do plano com checksums e estados formal/fÃ­sico. Qualquer mudanÃ§a invalida a confirmaÃ§Ã£o.

Depois da execuÃ§Ã£o, o Manager exige que exatamente o ID selecionado tenha sido retornado pelo runner oficial, esteja APPLIED com o checksum correto e fisicamente presente. TambÃ©m compara o fingerprint das tabelas nÃ£o afetadas e das tabelas legadas. Falha posterior Ã© crÃ­tica e requer intervenÃ§Ã£o manual.

## Backup e rollback operacional

O parÃ¢metro --confirm-backup registra um identificador de backup externo jÃ¡ concluÃ­do; ele nÃ£o cria nem simula um backup. Antes de qualquer autorizaÃ§Ã£o futura:

1. gerar dump somente do schema;
2. gerar dump das tabelas que o dry-run listou como afetadas;
3. validar integridade, leitura e restauraÃ§Ã£o dos dumps em ambiente isolado;
4. registrar um identificador imutÃ¡vel do backup;
5. executar somente o apply-one autorizado;
6. executar Doctor, validate e validaÃ§Ãµes funcionais;
7. se necessÃ¡rio, seguir um plano manual revisado de rollback/restauraÃ§Ã£o.

ALTER TABLE e CREATE TABLE podem causar commit implÃ­cito no MySQL. Por isso o fluxo declara ddlImplicitCommit=true e automaticRollback=false. As migrations corretivas desta sprint possuem down fail-closed: nÃ£o removem artefatos nem fingem atomicidade que o banco nÃ£o oferece.

## ReconciliaÃ§Ã£o do Auth Runtime

O Doctor separa `STRUCTURAL_DRIFT`, `TABLE_OPTION_DRIFT` e `FORMAL_DRIFT`.
DiferenÃ§as de engine, charset, collation, row format ou create options nunca sÃ£o aceitas
silenciosamente. Por padrÃ£o, o baseline retorna
`TABLE_OPTION_RECONCILIATION_REQUIRED`. A Ãºnica exceÃ§Ã£o atual Ã© o manifesto versionado do
Auth Runtime, fechado pelo ID e checksum da migration histÃ³rica, pelas diferenÃ§as temporÃ¡rias
aceitas e pela migration corretiva obrigatÃ³ria.

A ordem formal Ã©:

1. baseline controlado de `20260712184500_create_auth_runtime_tables` com a exceÃ§Ã£o auditada;
2. apply-one de `20260803133000_reconcile_auth_runtime_charset_collation`;
3. somente depois, evoluÃ§Ã£o para `20260724120000_create_auth_identities_table`.

Essa ordem evita registrar a corretiva antes de sua dependÃªncia histÃ³rica e preserva o que
realmente ocorreu no banco. NÃ£o existe `--force`.

O dry-run da corretiva executa um preflight somente leitura. Ele coleta metadados de tamanho,
estimativa de linhas, engine, charset/collation, row format, Ã­ndices, FKs, colunas textuais,
comprimentos mÃ¡ximos agregados nÃ£o sensÃ­veis, versÃ£o do MySQL e `sql_mode`. O risco Ã© expresso
apenas como LOW, MEDIUM ou HIGH. Senhas, hashes e tokens nÃ£o sÃ£o consultados em tabelas
operacionais nem impressos. EspaÃ§o livre do filesystem Ã© informado somente quando disponÃ­vel;
caso contrÃ¡rio, o write permanece condicionado a uma verificaÃ§Ã£o externa.

`ALTER TABLE ... CONVERT TO CHARACTER SET` pode reconstruir toda a tabela, consumir espaÃ§o
temporÃ¡rio, aguardar ou manter metadata lock, interromper escritas e efetuar commit implÃ­cito.
Por isso, mesmo um risco qualitativo LOW exige janela de manutenÃ§Ã£o e backup validado.

### Backup, aplicaÃ§Ã£o e validaÃ§Ã£o

Antes de qualquer autorizaÃ§Ã£o real:

1. gerar dump do schema somente de `users`, `user_sessions` e `password_reset_tokens`;
2. gerar dump dos dados somente dessas trÃªs tabelas;
3. validar integridade e restauraÃ§Ã£o dos dumps em ambiente isolado;
4. registrar identificador imutÃ¡vel, checksum, local e horÃ¡rio do backup;
5. abrir janela de manutenÃ§Ã£o e interromper ou drenar escritas de autenticaÃ§Ã£o;
6. executar exatamente o apply-one confirmado;
7. repetir Doctor/preflight e validar login e renovaÃ§Ã£o/uso de sessÃµes;
8. validar solicitaÃ§Ã£o e consumo de recuperaÃ§Ã£o de senha.

NÃ£o hÃ¡ rollback automÃ¡tico confiÃ¡vel para esse DDL. Converter de volta para `utf8` pode perder
caracteres que passaram a ser vÃ¡lidos em `utf8mb4`. ApÃ³s sucesso, prefira forward-fix; diante de
falha irrecuperÃ¡vel, execute restauraÃ§Ã£o via backup validado, em janela controlada e com revisÃ£o
manual.

## Limite legado

As tabelas j12_alunos, j12_matricula_numeros e j12_matriculas_publicas sÃ£o somente observadas no fingerprint de seguranÃ§a. Nenhuma migration ou writer desta sprint escreve nelas.

O relatÃ³rio tÃ©cnico do Auth Runtime estÃ¡ em [SPRINT-0.5-REPORT.md](./SPRINT-0.5-REPORT.md).
O ajuste de normalizaÃ§Ã£o e adoÃ§Ã£o exata estÃ¡ em
[SPRINT-0.5.1-REPORT.md](./SPRINT-0.5.1-REPORT.md).
O relatÃ³rio da cadeia DRAFT permanece em [SPRINT-0.4-REPORT.md](./SPRINT-0.4-REPORT.md).

## Dry-run e token

O dry-run recalcula o catÃ¡logo, o ledger e o schema fÃ­sico pelo J12 Doctor, aplica a policy central e exibe:

- as candidatas BASELINE_READY em ordem canÃ´nica;
- os bloqueios objetivos de cada migration nÃ£o elegÃ­vel;
- a lista exata para --only em confirmation.only;
- o token esperado em confirmation.expectedToken.

O token Ã© o SHA-256 do JSON estÃ¡vel abaixo:

```json
{
  "version": "J12_BASELINE_V1",
  "databaseName": "<nome exato>",
  "count": 1,
  "migrations": [
    {
      "id": "<id em ordem canÃ´nica>",
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

As quatro confirmaÃ§Ãµes sÃ£o obrigatÃ³rias:

1. o modo --write;
2. o banco exato em --confirm-database;
3. a lista completa e ordenada em --only;
4. o token vigente em --confirm-baseline.

Antes de criar o cliente de escrita, o Manager faz uma coleta atual e uma segunda revalidaÃ§Ã£o imediata. A lista deve coincidir integralmente com o plano BASELINE_READY. Migrations extras, ausentes, fora de ordem, UNKNOWN, bloqueadas, com drift estrutural, checksum divergente, dependÃªncia nÃ£o satisfeita ou ownership ambÃ­guo abortam a operaÃ§Ã£o.

## Ledger canÃ´nico

O modo write reutiliza MySqlMigrationLedger e somente a tabela oficial j12_schema_migrations. Nenhum ledger paralelo Ã© criado. Um registro de baseline Ã© gravado como APPLIED, com started_at e applied_at iguais, execution_ms = 0 e o checksum canÃ´nico.

O Manager obtÃ©m o lock canÃ´nico antes de qualquer mutaÃ§Ã£o. Como CREATE TABLE pode causar commit implÃ­cito no MySQL, a criaÃ§Ã£o do ledger, quando necessÃ¡ria e explicitamente autorizada pelo modo write, ocorre e Ã© validada em uma etapa DDL separada. Os registros sÃ£o entÃ£o inseridos dentro de uma transaÃ§Ã£o:

1. reler o ledger sob lock;
2. iniciar a transaÃ§Ã£o;
3. validar novamente status e checksums;
4. inserir na ordem canÃ´nica;
5. reler e verificar todos os registros;
6. fazer commit.

Erro durante os inserts provoca rollback. Se a validaÃ§Ã£o apÃ³s o commit falhar, os registros nÃ£o sÃ£o apagados automaticamente; o comando retorna erro crÃ­tico e exige intervenÃ§Ã£o manual.

## IdempotÃªncia e validaÃ§Ã£o posterior

Repetir a mesma lista confirmada apÃ³s um baseline bem-sucedido nÃ£o duplica registros. O comando sÃ³ retorna sucesso sem escrita se todos os IDs estiverem APPLIED, com os mesmos checksums e sem drift estrutural.

Depois do commit, o estado Ã© coletado novamente. A operaÃ§Ã£o sÃ³ Ã© aprovada quando:

- todos os IDs solicitados estÃ£o APPLIED com os checksums esperados;
- as contagens de aplicadas e pendentes refletem somente os registros inseridos;
- o drift formal das candidatas desapareceu;
- as candidatas deixaram de ser BASELINE_READY;
- o drift estrutural global permaneceu igual;
- o fingerprint de todas as tabelas, exceto o prÃ³prio ledger, permaneceu idÃªntico.

A saÃ­da de auditoria contÃ©m banco, host/remoto, IDs, checksums, criaÃ§Ã£o do ledger, contagens antes/depois, token confirmado, indicaÃ§Ã£o de escrita, timestamp e resultado da validaÃ§Ã£o posterior. Credenciais nunca sÃ£o impressas.

## Arquitetura

- baseline-eligibility-policy.js: fonte Ãºnica de BASELINE_READY e BASELINE_BLOCKED.
- baseline-token.js: payload determinÃ­stico e SHA-256.
- baseline-write-manager.js: dupla revalidaÃ§Ã£o, confirmaÃ§Ã£o, escrita e pÃ³s-validaÃ§Ã£o.
- baseline-ledger-writer.js: lock, DDL separado, transaÃ§Ã£o, idempotÃªncia e verificaÃ§Ã£o.
- write-database-client.js: pool exclusivo de escrita e adapter oficial do ledger.
- apply-manager.js: policy, token, dupla revalidaÃ§Ã£o, execuÃ§Ã£o unitÃ¡ria e pÃ³s-validaÃ§Ã£o.
- apply-one-database-client.js: composiÃ§Ã£o do runner, executor e ledger oficiais.
- apply-one-token.js: payload determinÃ­stico do plano unitÃ¡rio.
- draft-chain.js: cÃ¡lculo transitivo e classificaÃ§Ã£o da cadeia mÃ­nima de DRAFT.
- report-manager.js: J12 Doctor e plano dry-run do runner canÃ´nico.
- cli.js: guardas do alvo, flags explÃ­citas, auditoria e exit codes.

## Testes

```powershell
npm test
npm run migration-manager:test
```

Os testes usam somente fakes e inspeÃ§Ã£o estÃ¡tica. Eles nÃ£o carregam credenciais reais, nÃ£o abrem conexÃ£o real, nÃ£o criam ledger, nÃ£o aplicam migration e nÃ£o alteram schema ou dados.

<!-- SPRINT-0.6-AUTH-BOUNDARY:START -->

## Fronteira de autenticaÃ§Ã£o legada

`j12_usuarios` Ã© tratada como `LEGACY_AUTH_TABLE` atÃ© a conclusÃ£o da auditoria e da adoÃ§Ã£o formal.

### Regras

- nÃ£o modernizar a tabela automaticamente;
- nÃ£o criar novas dependÃªncias canÃ´nicas diretas;
- nÃ£o converter IDs, ENUMs ou timestamps sem preflight;
- nÃ£o adicionar `UNIQUE(email)` sem validar duplicidade;
- nÃ£o executar a migration histÃ³rica para recriar estruturas existentes.

### Ordem operacional

```text
AdoÃ§Ã£o auditada do legado
â†’ reconciliaÃ§Ã£o das tabelas modernas de autenticaÃ§Ã£o
â†’ auth_identities
â†’ user_unit_memberships
â†’ ownership
â†’ DRAFT canÃ´nico
```

### SeguranÃ§a

Toda escrita futura exige:

- plano em `--dry-run`;
- backup validado;
- token de confirmaÃ§Ã£o;
- revalidaÃ§Ã£o imediatamente antes da execuÃ§Ã£o;
- validaÃ§Ã£o funcional apÃ³s a operaÃ§Ã£o.

<!-- SPRINT-0.6-AUTH-BOUNDARY:END -->

