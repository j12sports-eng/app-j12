# Person Relationships

Dominio isolado para relacionamentos entre Pessoas.

## Objetivo

Representar vinculos genericos entre duas Pessoas sem integrar com alunos, responsaveis, login, financeiro, dashboard, frontend, rotas ou APIs existentes.

## Arquivos

- `relationship.entity.js`: entidade de dominio.
- `relationship.types.js`: constantes e contratos JSDoc.
- `relationship.mapper.js`: mapeamento entre DTO, entidade e linha do banco.
- `relationship.validator.js`: validacao minima da estrutura.
- `relationship.repository.js`: CRUD isolado de `person_relationships`.
- `relationship.service.js`: service isolado para casos de uso CRUD.
- `person_relationships.sql`: script MySQL da tabela.

## Tabela

`person_relationships` possui apenas os campos comuns do vinculo:

- `id`
- `person_id`
- `related_person_id`
- `relationship_type`
- `relationship_label`
- `priority`
- `receives_notifications`
- `financial_responsible`
- `can_pick_up`
- `emergency_contact`
- `legal_guardian`
- `status`
- `valid_from`
- `valid_until`
- `created_at`
- `updated_at`

## Garantias

- Nenhuma FK foi criada nesta sprint.
- Nenhuma rota foi criada.
- Nenhuma API foi criada.
- Nenhum modulo existente foi integrado.
- Nenhuma regra especifica de aluno ou responsavel foi implementada.
