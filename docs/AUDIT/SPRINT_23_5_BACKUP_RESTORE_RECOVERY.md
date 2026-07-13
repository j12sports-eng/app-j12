# Sprint 23.5 — Backup, restore, integridade e recuperação comprovável

Data: 2026-07-12.

## Decisão executiva

A automação reprodutível de backup e recuperação foi implementada, com guardas contra produção, manifesto, SHA-256, gzip nativo, restore somente em banco explicitamente descartável, verificação estrutural, `mysqlcheck`, smoke read-only, RPO/RTO e retenção configurável.

**Restore real não foi comprovado.** Esta máquina não possui `mysqldump`, `mysql`, `mysqlcheck`, `gzip`, `gpg` ou `7z`; somente OpenSSL está disponível. Também não foi fornecido MySQL isolado. Nenhum banco, dado pessoal, `.env` compartilhado ou serviço externo foi acessado.

O P0 muda de “sem automação” para “automação implementada, ensaio operacional pendente”, mas não pode ser encerrado até um drill aprovado passar em banco descartável e armazenamento offsite/encriptado ser comprovado.

## Base inicial

- Branch: `sprint-23`.
- HEAD inicial: `d7f173c9907f132696494961f9bc0870e5979131`.
- Working tree inicial limpo; artefatos anteriores já estavam no HEAD.
- Nenhum commit, push, tag, backup real, restore real ou conexão de banco foi executado.

## Auditoria

### Estado anterior

| Capacidade        | Evidência anterior                                       | Classificação inicial |
| ----------------- | -------------------------------------------------------- | --------------------- |
| Backup MySQL      | comando manual em `docs/DEPLOY/BACKUP.md` e runbook 22.9 | documentado           |
| Restore           | pipe manual `gunzip/mysql`                               | documentado           |
| Validação         | `gzip -t` e checksum sugeridos                           | documentado           |
| Integridade       | `mysqlcheck` sugerido                                    | documentado           |
| Manifesto         | campos recomendados, sem formato/script                  | não implementado      |
| Storage offsite   | recomendação genérica                                    | não comprovado        |
| Criptografia      | recomendação de volume/objeto criptografado              | não comprovado        |
| Retenção          | exigida, sem job/política executável                     | não implementado      |
| RPO/RTO           | exigidos, sem valores aprovados ou medição               | não comprovado        |
| Logs              | comandos manuais, sem sanitização específica             | não implementado      |
| Drill descartável | checklist conceitual                                     | não comprovado        |

Não havia scripts de backup/restore no repositório. `docs/DEPLOY/BACKUP.md` passava senha por prompt (`-p`) e não gerava manifesto. O runbook 22.9 já declarava corretamente que gzip/checksum não provam restaurabilidade.

### Ferramentas locais detectadas

- `mysqldump`: ausente;
- `mysql`: ausente;
- `mysqlcheck`: ausente;
- `gzip`: ausente, substituído na automação pela biblioteca nativa Node;
- `gpg`/`7z`: ausentes;
- OpenSSL: presente, mas não usado sem política/chave aprovada.

## Implementação

### Backup

`createBackup()` executa `mysqldump` com:

- `--defaults-extra-file=<absoluto>`; nenhuma senha em argumento;
- `--single-transaction`, `--quick`, routines, triggers, events e hex blob;
- stdout canalizado para gzip nativo nível 9;
- arquivo com modo 600 e diretório solicitado com modo 700;
- remoção do artefato parcial em falha;
- saída obrigatoriamente fora do workspace Git;
- confirmação obrigatória de storage criptografado.

O script não copia o artefato para storage externo: bucket/volume, KMS, replicação e credenciais dependem da infraestrutura autorizada. `--storage-encrypted` é um aceite operacional, não prova criptografia.

### Manifesto e validação

O manifesto JSON registra versão, timestamp UTC, banco, release Git, formato, tamanho, SHA-256, tabelas encontradas, tabelas mínimas esperadas e declaração de criptografia do storage.

`validateArtifact()`:

- rejeita arquivo ausente/vazio;
- descomprime integralmente via Node, comprovando integridade gzip;
- exige conteúdo compatível com dump lógico MySQL;
- extrai `CREATE TABLE` sem consultar banco;
- recalcula SHA-256 e compara ao manifesto.

### Restore descartável

`restoreArtifact()` exige simultaneamente:

1. nome contendo marcador `restore`, `scratch`, `disposable` ou `test`;
2. `--confirm-database` idêntico;
3. defaults file absoluto;
4. artefato previamente validado.

O script não cria nem remove bancos. O operador deve provisionar previamente uma instância/banco vazio, isolado, sem jobs, Pix, Inter, webhook, e-mail ou n8n.

### Estrutura, integridade e smoke

`verifyRestoredDatabase()` lista apenas nomes de tabelas em `information_schema`, exige tabelas críticas e executa `mysqlcheck --check`. Nenhum registro pessoal é exportado para logs.

`runPostRestoreSmoke()` executa somente contagens agregadas de tabelas e presença do ledger. O comando `drill` encadeia validação, restore, integridade e smoke e mede:

- idade do backup contra `--rpo-hours`;
- duração total contra `--rto-minutes`.

Somente uma execução real bem-sucedida do `drill` pode produzir classificação `proved_on_disposable_database`.

### Logs seguros

- JSON de saída não inclui defaults path absoluto;
- caminhos de artefatos são reduzidos ao basename no CLI;
- stderr é limitado e sanitiza passwords e URLs com credenciais;
- argumentos nunca incluem senha;
- queries de verificação retornam somente metadados/contagens.

### Retenção

Retenção aceita 1–3650 dias, opera somente fora do repositório e reconhece exclusivamente `j12-backup-YYYYMMDDTHHMMSSZ.sql.gz` e seu manifesto. O padrão é dry-run; exclusão exige `--apply`. Arquivos não relacionados são preservados.

## Comandos

Documentação completa: `scripts/recovery/README.md`.

```text
node scripts/recovery/j12-recovery.cjs backup ...
node scripts/recovery/j12-recovery.cjs validate ...
node scripts/recovery/j12-recovery.cjs restore ...
node scripts/recovery/j12-recovery.cjs verify ...
node scripts/recovery/j12-recovery.cjs smoke ...
node scripts/recovery/j12-recovery.cjs drill ...
node scripts/recovery/j12-recovery.cjs retention ...
```

Nenhum comando operacional acima foi executado com ferramentas/banco reais nesta Sprint.

## Testes locais

Processos falsos e artefatos sintéticos temporários cobrem:

1. argumentos seguros de `mysqldump` sem password;
2. gzip, SHA-256 e manifesto;
3. bloqueio de output dentro do Git;
4. exigência de storage criptografado;
5. checksum divergente;
6. bloqueio de produção e confirmação descartável;
7. restore com stream sintético;
8. inventário estrutural e `mysqlcheck` simulados;
9. retenção dry-run/aplicada sem remover arquivo alheio;
10. sanitização de logs.

Resultado final: **8/8 testes**, agregando os cenários relacionados acima.

## Gates executados

| Gate                              | Resultado                                                                        |
| --------------------------------- | -------------------------------------------------------------------------------- |
| Testes focados de recovery        | **8/8 aprovados**                                                                |
| Backend completo                  | **589/589 aprovados**                                                            |
| Frontend completo                 | **78/78 aprovados**                                                              |
| ESLint focado                     | **aprovado**                                                                     |
| Prettier focado                   | **aprovado**                                                                     |
| `git diff --check`                | **aprovado**                                                                     |
| Build oficial Client/SSR          | **aprovado**; Client com 3.737 módulos e apenas avisos preexistentes do TanStack |
| Restore real em banco descartável | **não executado / não comprovado**                                               |

## Matriz de evidência final

| Capacidade              |     Implementado     | Simulado | Executado localmente  | Banco descartável | Estado real                         |
| ----------------------- | :------------------: | :------: | :-------------------: | :---------------: | ----------------------------------- |
| Backup orchestration    |         sim          |   sim    |  com dump sintético   |        não        | implementado/simulado               |
| Gzip e SHA-256          |         sim          |   não    |          sim          |        não        | comprovado localmente sobre fixture |
| Manifesto               |         sim          |   não    |          sim          |        não        | comprovado localmente sobre fixture |
| Restore orchestration   |         sim          |   sim    |   stream sintético    |        não        | implementado/simulado               |
| Schema mínimo           |         sim          |   sim    |  query runner falso   |        não        | implementado/simulado               |
| `mysqlcheck`            |         sim          |   sim    |    processo falso     |        não        | não comprovado com MySQL            |
| Smoke pós-restore       |         sim          |   sim    |    contrato local     |        não        | não comprovado com aplicação/banco  |
| Retenção                |         sim          |   não    | filesystem temporário |        não        | comprovado localmente               |
| Logs sanitizados        |         sim          |   não    |          sim          |        não        | comprovado localmente               |
| Storage offsite         |         não          |   não    |          não          |        não        | não comprovado                      |
| Criptografia do storage |    aceite/guarda     |   não    |          não          |        não        | não comprovado                      |
| RPO/RTO                 | medição implementada |   não    |          não          |        não        | objetivos/resultado não comprovados |
| Drill completo          |     implementado     |   não    |          não          |        não        | não comprovado                      |

## Critério para eliminar o P0

Ainda é necessário:

1. instalar clientes MySQL compatíveis;
2. aprovar RPO, RTO, retenção e owner;
3. configurar defaults files com privilégio mínimo;
4. configurar storage criptografado e offsite com monitoramento;
5. gerar backup de dados exclusivamente sintéticos/controlados;
6. executar `drill` em MySQL descartável vazio;
7. anexar manifesto, logs sanitizados, duração, RPO/RTO e resultados;
8. descartar o ambiente com aprovação após preservar a evidência.

Até isso ocorrer, o P0 permanece operacionalmente aberto.

## Arquivos da Sprint 23.5

- `scripts/recovery/recovery-core.cjs` — implementação principal.
- `scripts/recovery/j12-recovery.cjs` — CLI.
- `scripts/recovery/recovery-core.test.cjs` — testes locais com fixtures/processos falsos.
- `scripts/recovery/README.md` — operação e pré-requisitos.
- `docs/AUDIT/SPRINT_23_5_BACKUP_RESTORE_RECOVERY.md` — auditoria e evidências.

## Percentual real

- Automação e testes locais: **90%**.
- Storage/offsite/criptografia operacional: **0% comprovado**.
- Restore em banco descartável: **0% comprovado**.
- Eliminação operacional do P0: **0%** até o drill real.
- Sprint 23.5: **62%** — implementação local completa, comprovação externa pendente.

A Sprint 23.6 não foi iniciada.
