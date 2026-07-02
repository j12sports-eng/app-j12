# Sprint 8.3 - Persistencia da Entidade Pessoa

## Objetivo

Implementar a persistencia isolada da entidade `Pessoa`, usando mysql2, sem integrar com os modulos atuais de alunos, responsaveis, autenticacao, dashboard ou financeiro.

Esta sprint cria uma tabela independente chamada `people`, sem relacionamentos e sem FKs.

## Escopo

Incluido:

- Script SQL da tabela `people`.
- Mapper entre payload de Pessoa, entidade arquitetural existente e linha do banco.
- Repository CRUD usando mysql2 por meio do wrapper atual de banco.
- Service isolado para casos de uso CRUD de Pessoa.
- Validacao minima de nome obrigatorio no service.

Fora do escopo:

- Perfil de Pessoa.
- Relacionamentos.
- FKs.
- Integracao com cadastro de alunos.
- Integracao com cadastro de responsaveis.
- Integracao com autenticacao.
- Integracao com dashboard.
- Integracao com financeiro.
- Rotas, endpoints, controllers ou frontend.

## Arquivos Criados ou Atualizados

```text
backend/src/domains/pessoas/
|-- people.sql
|-- person.mapper.js
|-- person.repository.js
`-- person.service.js
```

| Arquivo | Finalidade |
| --- | --- |
| `people.sql` | Define a tabela independente `people`, sem FK e sem relacionamento. |
| `person.mapper.js` | Mapeia payloads e linhas da tabela `people` para dados de Pessoa. |
| `person.repository.js` | Implementa `ensureTable`, `ping`, `create`, `findById`, `findByCpf`, `list`, `update` e `delete`. |
| `person.service.js` | Coordena o repository e valida o minimo necessario para CRUD. |

## Tabela people

Campos:

```text
id
nome
cpf
rg
sexo
data_nascimento
email
telefone
celular
cep
logradouro
numero
bairro
cidade
estado
complemento
ativo
created_at
updated_at
```

Garantias do schema:

- `people` e independente.
- Nao possui FKs.
- Nao referencia tabelas atuais.
- Nao altera tabelas existentes.
- Nao cria perfil.
- Nao cria relacionamento.

## CRUD Modelado

Operacoes disponiveis no repository:

1. `ensureTable()`: cria `people` apenas se a tabela ainda nao existir.
2. `create(data)`: insere uma Pessoa.
3. `findById(id)`: consulta uma Pessoa por id.
4. `findByCpf(cpf)`: consulta uma Pessoa por CPF.
5. `list(filters)`: lista Pessoas com filtros opcionais.
6. `update(id, data)`: atualiza os dados comuns de uma Pessoa.
7. `delete(id)`: remove uma Pessoa.

O service expõe o mesmo fluxo com validacao minima de `nome`.

## Isolamento

Nenhum modulo existente foi conectado a `people`.

Nao foram alterados:

- Cadastro de alunos.
- Cadastro de responsaveis.
- Autenticacao.
- Dashboard.
- Financeiro.
- Rotas.
- Endpoints.
- Controllers.
- Frontend.

## Auditoria

Validacoes previstas:

- `node --check` nos arquivos JS alterados.
- Execucao de CRUD completo com registro de teste:
  - criar tabela `people`;
  - criar Pessoa;
  - buscar por id;
  - listar;
  - atualizar;
  - buscar por CPF;
  - deletar;
  - confirmar delecao.
- Busca por dependencias externas usando referencias a `people` e `PersonService`.
- Revisao de `git status` restrita ao escopo da sprint.

## Resultado Esperado

- A tabela `people` existe como base independente para Pessoa.
- O CRUD funciona isoladamente.
- Nenhuma funcionalidade atual muda.
- Nenhum modulo existente depende da nova tabela.
