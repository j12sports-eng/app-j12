# J12 Doctor

CLI de diagnóstico **estritamente somente leitura** para comparar o catálogo canônico de migrations, o ledger formal e o schema físico MySQL. Ele não aplica migrations, não cria ledger, não corrige drift, não executa baseline e não altera dados ou estruturas.

## Barreiras de segurança

- Todo alvo exige `--confirm-database=<nome-exato>`.
- Host diferente de `localhost`, `127.0.0.1` ou `::1` exige também `--allow-remote`.
- A confirmação acontece antes da criação do pool.
- O executor aceita uma única consulta de leitura e bloqueia DDL, DML, transações, locks e múltiplas instruções.
- Credenciais nunca entram no relatório ou na saída de console.
- `j12_alunos`, `j12_matricula_numeros` e `j12_matriculas_publicas` são apenas observadas no inventário; não são fonte do domínio canônico.

## Comandos

```powershell
npm run doctor:inspect -- --confirm-database=j12
npm run doctor:report -- --confirm-database=j12
npm run doctor:migrations -- --confirm-database=j12
npm run doctor:schema -- --confirm-database=j12
npm run doctor:drift -- --confirm-database=j12
npm run doctor:test
```

Para um banco remoto, a autorização precisa ser explícita:

```powershell
npm run doctor:report -- --confirm-database=j12_producao --allow-remote
```

Os comandos aceitam `--format=console|json`. `report` usa JSON por padrão; os demais usam console.

## Diagnóstico produzido

O snapshot consulta `INFORMATION_SCHEMA` e reúne tabelas, engine, charset, collation, colunas, tipos, nullability, defaults, chave primária, índices comuns/únicos, FKs, colunas geradas e `auto_increment`.

O catálogo, checksums e dependências vêm do migration runner já existente. Para cada migration, o relatório mantém dois eixos independentes:

- `ledgerState`: `APPLIED`, `PENDING` ou `UNKNOWN`;
- `physicalState`: `PRESENT`, `PARTIAL`, `ABSENT`, `INCOMPATIBLE` ou `NOT_ASSESSED`.

`driftDetected` sinaliza divergência entre esses eixos. Migrations sem manifest continuam no catálogo e são marcadas como `NOT_ASSESSED`, sem inferência enganosa.

Os manifests explícitos cobrem as 16 migrations críticas de matrícula canônica: pessoas, matrícula base, unicidade de DRAFT, auditoria de confirmação, identidades normalizadas, convites, identidades de autenticação, memberships, progresso digital, documentos, contratos, revisão administrativa, ownership de unidade, FK de unidade, invariantes multiunidade e campos digitais de pessoas.

## Severidades e códigos de saída

| Código | Significado                   |
| ------ | ----------------------------- |
| `0`    | limpo                         |
| `1`    | warnings ou drift não crítico |
| `2`    | achado crítico                |
| `3`    | uso ou confirmação inválida   |
| `4`    | falha de conexão              |
| `5`    | falha interna                 |

Severidades: `INFO`, `WARNING`, `HIGH` e `CRITICAL`. Migration formalmente aplicada com artefato físico ausente/incompatível e checksum divergente são tratadas como críticas.

## Estrutura

- `cli.js`: parsing, confirmação do alvo, saída e códigos de processo.
- `database-target-guard.js`: dupla confirmação para remoto.
- `read-only-query-runner.js`: barreira SQL de leitura.
- `schema-inspector.js`: snapshot normalizado do `INFORMATION_SCHEMA`.
- `manifests/`: schema físico esperado pelas migrations críticas.
- `checks/`: checks de catálogo, ledger e artefatos físicos.
- `doctor.js`: correlação formal/física e relatório.
- `tests/`: testes unitários somente com fakes, sem conexão real.

## Como adicionar manifestos

Adicione a migration ao catÃ¡logo declarativo em `manifests/critical-enrollment.manifests.js`, usando o ID canÃ´nico completo e declarando tabelas, colunas, Ã­ndices, FKs e colunas geradas relevantes. Registre tabelas realmente criadas pela migration em `CREATED_TABLES`; tabelas apenas alteradas nÃ£o devem ser marcadas como artefato criado. Inclua um teste que cubra presenÃ§a, ausÃªncia e incompatibilidade. Migrations sem manifest permanecem `UNKNOWN` e nunca sÃ£o inferidas pelo nome do arquivo.

Artefatos opcionais devem ser listados em `optionalArtifacts` e nÃ£o podem influenciar a classificaÃ§Ã£o obrigatÃ³ria. Na V1 os 16 manifests crÃ­ticos nÃ£o possuem artefatos opcionais.

## Limites operacionais

O Doctor diagnostica; não remedia. Depois de revisar o relatório, qualquer mudança deve ser preparada como migration explícita, revisada e aplicada pelo fluxo operacional autorizado. A simples existência física de um artefato não autoriza escrever no ledger nem declarar baseline.
