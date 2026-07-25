# Sprint 29.1E.1C.2 — Validação segura do ambiente HML

## Resultado

A HML está preparada em código, mas não foi comprovada operacionalmente nesta
sessão. Por isso nenhuma conexão MySQL foi aberta, nenhuma consulta foi
executada e nenhuma informação de banco, schema ou ledger foi inferida a
partir de nomes.

O perfil secreto esperado (`.env.hml` ou arquivo equivalente fora do Git) não
foi encontrado nem informado. Os diretórios operacionais `app-j12` e
`app-j12-hml` também não existem nesta estação. O domínio e o processo HML
documentados não provam, isoladamente, a identidade do banco.

## Perfis e arquivos mapeados

| Perfil | Seleção | Arquivos públicos | Arquivos potencialmente secretos |
|---|---|---|---|
| Produção | `ecosystem.config.cjs`, processo `j12-api`, `--env-file=.env` | `.env.production.example`, `.env.api.production.example` | `.env` |
| HML preparada | `ecosystem.hml.config.cjs`, processo `j12-api-hml`, `J12_ENVIRONMENT=hml`, `--env-file=.env.hml` | `config/hml/hml.env.example`, `deploy/hml/docker-compose.hml.yml` | `.env.hml` ou secret file externo |
| Local/desenvolvimento | comandos npm e defaults locais | `.env.example` | `.env.local` |

Também existem `.env.codex-backup-*` e arquivos reais `.env*` ignorados. Eles
foram identificados apenas pelo caminho e não tiveram conteúdo lido. Não se
deve exibir ou copiar desses arquivos `DATABASE_URL`, senhas, tokens, chaves ou
credenciais.

## Mecanismo HML e isolamento

O contrato canônico é:

1. criar um secret file fora do Git a partir de
   `config/hml/hml.env.example`;
2. carregar esse arquivo explicitamente com `node --env-file=<caminho>`;
3. validar com `scripts/hml/j12-hml.cjs validate`;
4. somente depois usar o mesmo processo/ambiente no runner.

`scripts/hml/hml-core.cjs` falha fechado quando:

- `J12_ENVIRONMENT` não é `hml`;
- `HML_ISOLATED` não é `true`;
- integrações reais não estão desabilitadas;
- `HML_INSTANCE_ID` não possui identidade HML válida;
- o banco não termina em `_hml`, `_homolog` ou `_homologation`;
- `DB_HOST` não é loopback;
- URLs apontam para hosts produtivos conhecidos;
- secrets obrigatórios estão ausentes ou ainda são placeholders;
- credenciais de integrações reais estão presentes.

O Compose preparado usa MySQL 8.4, publica somente em loopback, possui rede
interna, volume próprio e labels de homologação descartável. Ele não foi
provisionado nem consultado nesta sprint.

O composition root `backend/server.js` executa o guard antes de carregar a
aplicação quando `J12_ENVIRONMENT=hml`. O arquivo
`ecosystem.hml.config.cjs` separa `.env.hml` de `.env`, define os processos
`j12-api-hml`/`j12-frontend-hml` e desliga integrações reais.

## Runner canônico

Comandos conceituais, ainda não autorizados para conexão:

```text
node --env-file=<hml-secret-file> scripts/hml/j12-hml.cjs validate
node --env-file=<hml-secret-file> scripts/hml/j12-hml.cjs plan-migrations
node --env-file=<hml-secret-file> backend/src/database/migration-runner/cli.js status --confirm-database=<DB_NAME_EXATO>
```

`plan` e `up --dry-run` são offline: não importam a configuração de banco,
não criam pool e não leem o ledger. `status` é read-only e consulta o ledger,
mas só poderá ser usado depois da comprovação conjunta do perfil HML.

O runner exige confirmação exata de `DB_NAME`; host não loopback requer
`--allow-remote`. Para o perfil descartável canônico, `--allow-remote` não deve
ser usado. O CLI isolado não substitui o guard HML: a validação do perfil deve
ser executada antes no mesmo conjunto de variáveis.

O comando `up` aplica todas as migrations pendentes em ordem topológica. Não
há opção para selecionar somente
`20260724150000_create_digital_enrollment_progress`. Se o futuro `status`
mostrar mais de uma pendência, a aplicação deve ser bloqueada para nova
revisão.

O ledger canônico é `j12_schema_migrations`. Ele registra `APPLYING`,
`APPLIED` e `FAILED`, checksum, timestamps, duração e erro sanitizado. O runner
também bloqueia checksum divergente, registro órfão e estados
`APPLYING`/`FAILED`. O `up` pode criar o ledger; portanto não é read-only e não
foi executado.

## Estado operacional não comprovado

| Evidência | Estado |
|---|---|
| Perfil secreto HML | não localizado/informado |
| Host HML real | desconhecido |
| Banco HML real | desconhecido; nenhum nome utilizado |
| Banco diferente da produção | não comprovado |
| Processo/diretório HML provisionado | não comprovado |
| Versão MySQL | não consultada |
| `enrollments` | não consultada |
| `people` | não consultada |
| `person_profiles` | não consultada |
| `person_relationships` | não consultada |
| `enrollment_digital_invitations` | não consultada |
| `j12_unidades` | não consultada |
| `digital_enrollment_progress` | não consultada |
| `j12_schema_migrations` | não consultado |
| Migrations pendentes na HML | desconhecidas |

Um plano offline lista o catálogo atual, mas não prova quais migrations estão
pendentes em HML, pois não consulta ledger.

## Dados necessários para desbloqueio

1. Caminho explícito do secret file HML, fora do Git.
2. Confirmação de que ele é o perfil do processo `j12-api-hml`.
3. Evidência não secreta de `J12_ENVIRONMENT=hml`,
   `HML_ISOLATED=true` e integrações reais desabilitadas.
4. Identidade mascarada do host e banco, comparada com a produção conhecida.
5. Evidência de que o host é o loopback do Compose isolado ou outro ambiente
   formalmente aprovado com proteção equivalente.
6. Confirmação do diretório/processo/namespace HML efetivamente provisionado.

Após isso, a próxima sprint pode validar o perfil sem rede, abrir conexão
read-only, conferir identidade/versão e então inspecionar tabelas e ledger. Só
depois cabe preparar backup e revisar a aplicação.

## Confirmações

- Nenhuma migration foi executada.
- Nenhum DDL ou DML foi executado.
- Nenhuma conexão ou consulta MySQL foi realizada.
- Produção, homologação, VPS, PM2 e Docker não foram alterados.
- Nenhum `.env` foi lido, criado ou alterado.
- Nenhum secret foi registrado neste documento.
