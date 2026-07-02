# Migracoes

Padrao oficial de migrations SQL do backend J12.

## Indice

- [Decisao Oficial](#decisao-oficial)
- [Estado Atual](#estado-atual)
- [Pasta Oficial](#pasta-oficial)
- [Nomenclatura](#nomenclatura)
- [Formato Dos Arquivos](#formato-dos-arquivos)
- [Criacao De Nova Migration](#criacao-de-nova-migration)
- [Revisao Antes Da Execucao](#revisao-antes-da-execucao)
- [Execucao Manual](#execucao-manual)
- [Rollback](#rollback)
- [Regras De Seguranca](#regras-de-seguranca)
- [ensureSchema](#ensureschema)
- [schema.sql](#schemasql)
- [Checklist De Migration](#checklist-de-migration)
- [Links Relacionados](#links-relacionados)

## Decisao Oficial

A partir da Sprint 9.19, o caminho oficial para migrations SQL versionadas e:

```text
backend/src/database/migrations/
```

Essa decisao segue a arquitetura alvo ja documentada em
`docs/ARQUITETURA/PADROES_BACKEND.md` e remove a ambiguidade levantada na
Sprint 9.18 entre `backend/database/migrations/` e
`backend/src/database/migrations/`.

Migrations sao arquivos SQL revisaveis e aplicados manualmente. Nenhuma sprint
deve executar SQL automaticamente sem aprovacao explicita.

## Estado Atual

O projeto ainda nao possui runner de migrations, controle automatico de versao
de banco ou ferramenta como Prisma.

O schema atual tambem possui criacao/alteracao em runtime por funcoes legadas
do backend. Esse comportamento deve ser preservado ate uma migracao controlada,
sem misturar novas alteracoes estruturais dentro de `ensureSchema`.

## Pasta Oficial

Pasta oficial:

```text
backend/src/database/migrations/
```

Uso esperado:

- guardar migrations SQL versionadas;
- manter historico incremental de alteracoes de schema;
- permitir code review antes de qualquer execucao;
- manter rollback documentado no mesmo arquivo.

Nao usar para:

- propostas ainda nao aprovadas;
- snapshots legados;
- scripts temporarios;
- seeds;
- queries operacionais;
- dumps de producao.

Propostas SQL continuam em pastas documentais, como:

```text
docs/BACKEND/sql/proposals/
```

## Nomenclatura

Formato obrigatorio:

```text
YYYYMMDDHHMMSS_descricao_da_migration.sql
```

Regras:

- timestamp em 14 digitos, no horario local da criacao;
- descricao em minusculas;
- usar `_` como separador;
- nao usar espacos;
- nao usar acentos;
- uma migration deve representar uma alteracao coesa.

Exemplo futuro:

```text
20260101090000_create_enrollments_table.sql
```

## Formato Dos Arquivos

Cada migration deve conter as secoes:

```sql
-- UP
-- SQL aprovado para aplicar a alteracao.

-- DOWN
-- SQL aprovado para rollback da alteracao.
```

Regras do formato:

- `-- UP` deve conter somente a alteracao que sera aplicada;
- `-- DOWN` deve conter o rollback correspondente ou uma justificativa quando
  rollback automatico nao for seguro;
- comentarios devem explicar riscos, pre-condicoes e dependencias relevantes;
- SQL deve ser compativel com MySQL e com o driver atual `mysql2`;
- DDL deve declarar indices, chaves e defaults explicitamente;
- alteracoes destrutivas exigem plano de backup e aprovacao especifica.

## Criacao De Nova Migration

Fluxo obrigatorio:

1. Confirmar que a alteracao pertence ao backend MySQL atual.
2. Confirmar se ha contrato tecnico aprovado em documentacao.
3. Criar um arquivo em `backend/src/database/migrations/`.
4. Usar o padrao `YYYYMMDDHHMMSS_descricao_da_migration.sql`.
5. Escrever secoes `-- UP` e `-- DOWN`.
6. Documentar FKs, indices, defaults, impacto e rollback.
7. Nao conectar a migration a startup, build, deploy ou endpoint.
8. Rodar build/testes aplicaveis sem executar SQL.

## Revisao Antes Da Execucao

Antes de aplicar uma migration em qualquer ambiente:

- revisar o diff do arquivo SQL;
- validar compatibilidade com tabelas existentes;
- validar tipos das FKs;
- validar nomes de indices e constraints;
- validar impacto de locks;
- validar se existe backfill;
- validar se o rollback e seguro;
- criar backup quando houver risco de perda de dados;
- registrar ambiente, data, operador e hash/commit usado.

## Execucao Manual

Enquanto nao existir runner aprovado, a execucao e manual e controlada.

Regras:

- `npm run build`, `npm start`, `npm run dev` e scripts de bootstrap nao devem
  executar migrations;
- uma sprint pode criar arquivo SQL, mas nao deve aplicar SQL sem pedido
  explicito;
- aplicacao em homologacao deve ocorrer antes de producao;
- producao exige backup e janela operacional quando houver DDL sensivel;
- o resultado da execucao deve ser registrado na documentacao da sprint ou no
  processo operacional correspondente.

## Rollback

Toda migration deve ter rollback na secao `-- DOWN`.

Rollback pode ser:

- SQL reversivel direto, quando seguro;
- plano manual documentado, quando a reversao automatica puder causar perda de
  dados;
- bloqueio explicito, quando a migration nao puder ser revertida com seguranca.

Regra: se o rollback nao estiver claro, a migration nao deve ser executada.

## Regras De Seguranca

- Nao executar SQL automaticamente por sprint.
- Nao criar tabela de negocio sem contrato aprovado.
- Nao alterar `ensureSchema` para novas estruturas versionadas.
- Nao misturar migration com repository, controller, rota, API ou frontend.
- Nao reutilizar tabelas legadas como destino de aggregates novos sem decisao
  arquitetural documentada.
- Nao remover tabelas ou colunas sem plano de backup, compatibilidade e
  rollback.
- Nao incluir dados sensiveis, dumps ou credenciais em migrations.

## ensureSchema

Arquivo legado:

```text
backend/src/config/db.js
```

Funcoes relacionadas:

- `ensureSchema`;
- `ensureAuthSchema`;
- `ensureColumn`;
- `ensureIndex`;
- `dropForeignKeyIfExists`.

Essas funcoes permanecem para compatibilidade temporaria. Novas alteracoes de
schema devem preferir migrations versionadas no caminho oficial definido nesta
sprint.

## schema.sql

Arquivo legado:

```text
backend/sql/schema.sql
```

Uso atual:

- define tabelas legadas basicas;
- nao representa o padrao oficial de migrations versionadas.

Novas migrations nao devem ser adicionadas a esse arquivo.

## Checklist De Migration

- [ ] Contrato tecnico aprovado.
- [ ] Arquivo criado em `backend/src/database/migrations/`.
- [ ] Nome no padrao `YYYYMMDDHHMMSS_descricao_da_migration.sql`.
- [ ] Secao `-- UP` definida.
- [ ] Secao `-- DOWN` definida.
- [ ] FKs revisadas.
- [ ] Indices revisados.
- [ ] Impacto de lock avaliado.
- [ ] Backup planejado quando aplicavel.
- [ ] Homologacao validada antes de producao.
- [ ] Execucao registrada.
- [ ] Nenhum SQL executado automaticamente por build/startup.

## Links Relacionados

- [Modelo](./MODELO.md)
- [Integridade](./INTEGRIDADE.md)
- [Padroes Backend](../ARQUITETURA/PADROES_BACKEND.md)
- [Sprint 9.18](../BACKEND/SPRINT_9_18.md)
