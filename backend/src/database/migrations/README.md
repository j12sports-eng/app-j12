# Backend SQL Migrations

Pasta oficial para migrations SQL versionadas do backend J12.

## Caminho Oficial

```text
backend/src/database/migrations/
```

## Nome Dos Arquivos

Use sempre:

```text
YYYYMMDDHHMMSS_descricao_da_migration.sql
```

Exemplo de nome futuro:

```text
20260101090000_create_enrollments_table.sql
```

## Formato

Cada arquivo deve ter:

```sql
-- UP
-- SQL aprovado para aplicar a alteracao.

-- DOWN
-- SQL aprovado para rollback da alteracao.
```

## Regras

- Esta pasta nao possui runner automatico.
- Migrations nao devem ser executadas por build, startup, dev server ou deploy.
- A execucao deve ser manual, revisada e registrada.
- Toda migration deve ter rollback ou plano manual documentado.
- Nao criar scripts temporarios, seeds, dumps ou propostas nesta pasta.
- Propostas ainda nao aprovadas devem ficar em `docs/BACKEND/sql/proposals/`.

## Sprint 9.19

Esta sprint criou apenas o padrao e esta orientacao. Nenhuma migration de
negocio foi adicionada.
