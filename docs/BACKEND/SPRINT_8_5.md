# Sprint 8.5 - Person Relationships

## Objetivo

Implementar o dominio isolado `Person Relationships`, responsavel por persistir relacionamentos genericos entre duas Pessoas.

Esta sprint nao integra a nova tabela com alunos, responsaveis, autenticacao, dashboard, financeiro, frontend, rotas ou APIs existentes.

## Escopo

Incluido:

- Entidade de dominio `PersonRelationship`.
- Tipos e constantes do dominio.
- Mapper entre DTO, entidade e linha SQL.
- Validator com regras estruturais minimas.
- Repository CRUD usando mysql2 por meio do wrapper atual de banco.
- Service isolado para casos de uso CRUD.
- Script SQL da tabela `person_relationships`.
- README local do dominio.

Fora do escopo:

- Foreign keys.
- Integracao com `people`.
- Integracao com alunos.
- Integracao com responsaveis.
- Integracao com login ou usuarios.
- Integracao com autenticacao.
- Integracao com dashboard.
- Integracao com financeiro.
- Rotas, endpoints, controllers ou frontend.
- Regras especificas de aluno menor, responsavel legal obrigatorio ou financeiro.

## Arquivos Criados

```text
backend/src/domains/pessoas/relationships/
|-- relationship.entity.js
|-- relationship.types.js
|-- relationship.mapper.js
|-- relationship.repository.js
|-- relationship.service.js
|-- relationship.validator.js
|-- person_relationships.sql
`-- README.md
```

| Arquivo | Finalidade |
| --- | --- |
| `relationship.entity.js` | Entidade de dominio do relacionamento. |
| `relationship.types.js` | Constantes e contratos JSDoc. |
| `relationship.mapper.js` | Mapeia entidade, DTO e linha SQL. |
| `relationship.validator.js` | Valida campos minimos e intervalo de vigencia. |
| `relationship.repository.js` | Implementa CRUD isolado da tabela `person_relationships`. |
| `relationship.service.js` | Coordena repository e validator. |
| `person_relationships.sql` | Script MySQL da tabela independente. |
| `README.md` | Documenta o dominio localmente. |

## Tabela person_relationships

Campos:

```text
id
person_id
related_person_id
relationship_type
relationship_label
priority
receives_notifications
financial_responsible
can_pick_up
emergency_contact
legal_guardian
status
valid_from
valid_until
created_at
updated_at
```

Garantias do schema:

- Sem FKs.
- Sem relacionamento fisico com `people`.
- Sem relacionamento fisico com alunos, responsaveis ou usuarios.
- Sem dependencia de rotas ou APIs.

## CRUD Implementado

Operacoes disponiveis:

1. `ensureTable()`: cria `person_relationships` se a tabela ainda nao existir.
2. `create(data)`: cria um relacionamento.
3. `findById(id)`: consulta um relacionamento por id.
4. `list(filters)`: lista relacionamentos com filtros opcionais.
5. `update(id, data)`: atualiza os campos do relacionamento.
6. `delete(id)`: remove um relacionamento.

Filtros de listagem:

- `personId`
- `relatedPersonId`
- `relationshipType`
- `status`
- `limit`
- `offset`

## Validacao

Validacoes estruturais implementadas:

- `personId` obrigatorio.
- `relatedPersonId` obrigatorio.
- `relationshipType` obrigatorio.
- `status` obrigatorio.
- `validUntil` nao pode ser anterior a `validFrom`.

Nao foram implementadas regras de negocio especificas de aluno, responsavel, financeiro ou auth.

## Isolamento

Nenhum modulo existente foi conectado a `person_relationships`.

Nao foram alterados:

- Cadastro atual de alunos.
- Cadastro atual de responsaveis.
- Autenticacao.
- Dashboard.
- Financeiro.
- Frontend.
- Rotas.
- APIs existentes.

## Auditoria

Validacoes executadas ou previstas:

- `node --check` nos arquivos JS da Sprint 8.5.
- `npm run build`.
- CRUD completo com registro de teste:
  - criar tabela `person_relationships`;
  - criar relacionamento;
  - buscar por id;
  - listar por `personId`;
  - atualizar flags e status;
  - deletar;
  - confirmar delecao.
- Auditoria da tabela no banco para confirmar campos e ausencia de FK.
- Busca por referencias a `person_relationships` fora dos arquivos da Sprint 8.5.
- Revisao de `git status` restrita ao escopo.

## Resultado Esperado

- A tabela `person_relationships` existe.
- O CRUD funciona isoladamente.
- Nenhuma funcionalidade atual muda.
- Nenhuma rota muda.
- Nenhum endpoint muda.
- Nenhum modulo existente depende da nova tabela.

## Riscos

| Risco | Nivel | Mitigacao |
| --- | --- | --- |
| Tratar flags como regra real de aluno/responsavel | Medio | Esta sprint persiste flags, mas nao as conecta a nenhum modulo. |
| Criar dependencia prematura com `people` | Medio | Nao foi criada FK nem consulta a `people`. |
| Acoplar financeiro ou auth cedo demais | Alto | Nenhuma referencia a financeiro, usuarios ou login foi criada. |
| Perder historico em exclusoes futuras | Medio | CRUD fisico existe apenas para validacao isolada; politica de historico deve ser definida antes de integracao. |
