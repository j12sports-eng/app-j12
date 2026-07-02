# Sprint 9.19 - Migration Standard

## Objetivo

Definir o padrao oficial de migrations SQL do backend J12, desbloqueando
sprints futuras sem criar tabela de negocio nesta etapa.

## Decisao Tomada

O caminho oficial de migrations passa a ser:

```text
backend/src/database/migrations/
```

Motivo:

- segue a arquitetura alvo documentada em `docs/ARQUITETURA/PADROES_BACKEND.md`;
- resolve o bloqueio da Sprint 9.18;
- evita criar um segundo caminho em `backend/database/migrations/`;
- mantem migrations dentro da estrutura backend nova em `backend/src`.

## Padrao Definido

Nomenclatura obrigatoria:

```text
YYYYMMDDHHMMSS_descricao_da_migration.sql
```

Exemplo futuro:

```text
20260101090000_create_enrollments_table.sql
```

Formato obrigatorio:

```sql
-- UP
-- SQL aprovado para aplicar a alteracao.

-- DOWN
-- SQL aprovado para rollback da alteracao.
```

Execucao:

- manual;
- revisada antes de aplicar;
- registrada por ambiente;
- nunca automatica por build, startup, dev server ou deploy sem aprovacao
  especifica.

Rollback:

- deve ficar no mesmo arquivo, na secao `-- DOWN`;
- deve ser SQL reversivel quando seguro;
- deve virar plano manual documentado quando rollback automatico puder causar
  perda de dados;
- se rollback nao estiver claro, a migration nao deve ser executada.

## Arquivos Criados Ou Alterados

Criado:

```text
backend/src/database/migrations/README.md
docs/BACKEND/SPRINT_9_19.md
```

Alterado:

```text
docs/BANCO/MIGRACOES.md
```

## Itens Nao Implementados

Nao foi criado nesta sprint:

- tabela `enrollments`;
- migration de negocio;
- SQL de criacao de tabela;
- execucao automatica;
- script runner;
- repository;
- Prisma;
- adapter;
- endpoint;
- controller;
- rota;
- API;
- frontend;
- alteracao em legado.

## Auditoria

Confirmado:

- nenhuma tabela foi criada;
- nenhum SQL de negocio foi criado;
- nenhum SQL foi executado;
- nenhuma migration de negocio foi adicionada;
- nenhum repository foi criado;
- nenhum endpoint, controller, rota, API ou frontend foi alterado;
- nenhum legado foi alterado;
- `/public/enrollments` nao foi alterado.

Validacao:

```bash
npm run build
```

Resultado: aprovado.

`node --check` nao se aplica porque nenhum JS foi criado ou alterado.

## Proximos Passos

1. Criar a migration de `enrollments` em sprint posterior.
2. Usar o caminho `backend/src/database/migrations/`.
3. Nomear o arquivo no padrao `YYYYMMDDHHMMSS_create_enrollments_table.sql`.
4. Incluir `-- UP` e `-- DOWN`.
5. Manter a migration sem execucao automatica ate aprovacao operacional.
