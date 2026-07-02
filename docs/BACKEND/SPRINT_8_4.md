# Sprint 8.4 - Persistencia dos Perfis de Pessoa

## Objetivo

Implementar a persistencia isolada da estrutura de perfis de Pessoa, sem integrar com cadastro de alunos, cadastro de responsaveis, login, autenticacao, dashboard, financeiro, frontend, rotas ou APIs existentes.

Esta sprint cria apenas a tabela `person_profiles`, sem foreign keys e sem dados especificos de cada perfil.

## Escopo

Incluido:

- Script SQL da tabela `person_profiles`.
- Mapper entre payload e linha da tabela.
- Repository CRUD usando mysql2 por meio do wrapper atual de banco.
- Service isolado para casos de uso CRUD de perfis.
- Validacao minima de `personId`, `profileType` e `status`.

Fora do escopo:

- Foreign keys.
- Integracao com `people`.
- Integracao com Aluno.
- Integracao com Responsavel.
- Integracao com Login.
- Integracao com Auth.
- Integracao com Dashboard.
- Integracao com Financeiro.
- Rotas, endpoints, controllers ou frontend.
- Campos especificos de AlunoProfile, ResponsavelProfile, ProfessorProfile, FuncionarioProfile ou LocatarioProfile.

## Arquivos Criados

```text
backend/src/domains/pessoas/profiles/
|-- person_profiles.sql
|-- person-profile.mapper.js
|-- person-profile.repository.js
`-- person-profile.service.js
```

| Arquivo | Finalidade |
| --- | --- |
| `person_profiles.sql` | Define a tabela independente `person_profiles`, sem FK. |
| `person-profile.mapper.js` | Normaliza e mapeia dados de perfil para DTO e colunas SQL. |
| `person-profile.repository.js` | Implementa CRUD isolado da tabela `person_profiles`. |
| `person-profile.service.js` | Coordena o repository e valida os campos minimos do perfil. |

## Tabela person_profiles

Campos:

```text
id
person_id
profile_type
status
created_at
updated_at
```

Indices:

- `idx_person_profiles_person`
- `idx_person_profiles_type`
- `idx_person_profiles_status`

Garantias do schema:

- Sem FKs.
- Sem relacionamento fisico com `people`.
- Sem relacionamento fisico com alunos, responsaveis ou usuarios.
- Sem dados especificos de perfis.

## CRUD Implementado

Operacoes disponiveis no repository:

1. `ensureTable()`: cria `person_profiles` apenas se a tabela ainda nao existir.
2. `create(data)`: cria um perfil.
3. `findById(id)`: busca um perfil por id.
4. `list(filters)`: lista perfis com filtros opcionais.
5. `update(id, data)`: atualiza `person_id`, `profile_type` e `status`.
6. `delete(id)`: remove um perfil.

O service expoe o mesmo fluxo com validacao minima.

## Tipos Permitidos

`profile_type` permitido nesta sprint:

- `aluno`
- `responsavel`
- `professor`
- `funcionario`
- `locatario`

`status` permitido nesta sprint:

- `ativo`
- `inativo`
- `pendente`
- `bloqueado`

## Isolamento

Nenhum modulo existente foi conectado a `person_profiles`.

Nao foram alterados:

- Cadastro de alunos.
- Cadastro de responsaveis.
- Autenticacao.
- Login.
- Dashboard.
- Financeiro.
- Frontend.
- Rotas.
- APIs existentes.

## Auditoria

Validacoes executadas ou previstas:

- `node --check` nos arquivos JS da Sprint 8.4.
- `npm run build`.
- CRUD completo com registro de teste:
  - criar tabela `person_profiles`;
  - criar perfil;
  - buscar por id;
  - listar por `personId`;
  - atualizar status;
  - deletar;
  - confirmar delecao.
- Auditoria da tabela no banco para confirmar campos e ausencia de FK.
- Busca por referencias a `person_profiles` fora dos arquivos da Sprint 8.4.
- Revisao de `git status` restrita ao escopo.

## Resultado Esperado

- A tabela `person_profiles` existe.
- O CRUD funciona isoladamente.
- Nenhuma funcionalidade atual muda.
- Nenhuma rota muda.
- Nenhum endpoint muda.
- Nenhum modulo existente utiliza `person_profiles`.

## Riscos

| Risco | Nivel | Mitigacao |
| --- | --- | --- |
| Interpretar `person_profiles` como integracao com Aluno ou Responsavel | Medio | A tabela guarda apenas `person_id`, `profile_type` e `status`, sem FK. |
| Acoplar login ao perfil cedo demais | Alto | Nenhuma referencia a `users`, `j12_usuarios` ou auth foi criada. |
| Criar regra especifica de perfil nesta sprint | Medio | Campos especificos seguem nos modelos conceituais existentes, nao na tabela nova. |
