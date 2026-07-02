# Sprint 8.1 - Pre-Matricula Funcional

## Indice

- [Objetivo](#objetivo)
- [Escopo](#escopo)
- [Arquivos Criados](#arquivos-criados)
- [Arquivos Alterados](#arquivos-alterados)
- [Tabela Nova](#tabela-nova)
- [Repository](#repository)
- [Service](#service)
- [Preparacao para Pessoa](#preparacao-para-pessoa)
- [Garantias de Isolamento](#garantias-de-isolamento)
- [Validacao](#validacao)
- [Riscos](#riscos)
- [Proximos Passos](#proximos-passos)

## Objetivo

Implementar o primeiro modulo funcional da nova arquitetura sem alterar modulos existentes.

O modulo escolhido e `Pre-Matricula`, dentro de:

```text
backend/src/domains/pessoas/pre-matricula/
```

Ele permite persistir solicitacoes iniciais de matricula em uma tabela nova e isolada chamada `pre_matriculas`.

## Escopo

Incluido:

- Script SQL MySQL da tabela `pre_matriculas`.
- Repository funcional usando o wrapper mysql2 existente.
- Service funcional usando o Repository.
- CRUD direto no dominio.
- Campos futuros para integracao com Pessoa.
- Documentacao da sprint.

Fora do escopo:

- Endpoints.
- Rotas.
- Controllers.
- Frontend.
- Autenticacao.
- Cadastro atual de alunos.
- Cadastro atual de responsaveis.
- Dashboard.
- Financeiro.
- Alteracao de tabelas existentes.

## Arquivos Criados

| Arquivo | Finalidade |
| --- | --- |
| `backend/src/domains/pessoas/pre-matricula/pre_matriculas.sql` | Script MySQL da tabela nova `pre_matriculas`. |
| `docs/BACKEND/SPRINT_8_1.md` | Documentacao da sprint. |

## Arquivos Alterados

| Arquivo | Alteracao |
| --- | --- |
| `prematricula.types.js` | Incluiu campos futuros `pessoaAlunoId`, `pessoaResponsavelId`, `origem` e `metadata`. |
| `prematricula.entity.js` | Passou a carregar os campos futuros e serializar o payload completo. |
| `prematricula.mapper.js` | Passou a mapear entre entidade e linha da tabela `pre_matriculas`. |
| `prematricula.repository.js` | Passou de boundary para CRUD funcional usando mysql2. |
| `prematricula.service.js` | Passou a orquestrar validacao, persistencia, listagem, update e delete. |
| `prematricula.validator.js` | Comentarios atualizados para refletir o modulo funcional isolado. |
| `README.md` | Atualizado com tabela, script SQL e garantias atuais. |

## Tabela Nova

Tabela:

```text
pre_matriculas
```

Campos principais:

- `id`
- `status`
- `aluno_nome`
- `aluno_data_nascimento`
- `aluno_sexo`
- `aluno_unidade_interesse`
- `aluno_modalidade`
- `aluno_observacoes`
- `responsavel_nome`
- `responsavel_cpf`
- `responsavel_telefone`
- `responsavel_whatsapp`
- `responsavel_email`
- `pessoa_aluno_id`
- `pessoa_responsavel_id`
- `origem`
- `metadata_json`
- `created_at`
- `updated_at`

Status permitidos:

- `PENDENTE`
- `EM_ANALISE`
- `APROVADA`
- `REJEITADA`
- `CANCELADA`

## Repository

`PrematriculaRepository` usa:

```js
const { query } = require("../../../config/db.js");
```

Metodos implementados:

- `ensureTable()`
- `ping()`
- `create(data)`
- `findById(id)`
- `list(filters)`
- `update(id, data)`
- `delete(id)`

O repository toca somente a tabela `pre_matriculas`.

## Service

`PrematriculaService` usa `PrematriculaRepository` e `PrematriculaValidator`.

Metodos implementados:

- `ensureSchema()`
- `ping()`
- `prepare(payload)`
- `create(payload)`
- `findById(id)`
- `list(filters)`
- `update(id, patch)`
- `updateStatus(id, status)`
- `delete(id)`

O service nao chama cadastro de alunos, responsaveis, financeiro, dashboard, auth ou frontend.

## Preparacao para Pessoa

A tabela nova possui campos nullable:

- `pessoa_aluno_id`
- `pessoa_responsavel_id`

No dominio, os campos equivalentes sao:

- `pessoaAlunoId`
- `pessoaResponsavelId`

Eles existem apenas para futura integracao com o dominio Pessoa. Nenhuma FK foi criada nesta sprint para evitar acoplamento prematuro e porque a persistencia final de Pessoa ainda nao foi implementada.

## Garantias de Isolamento

- Nenhuma tabela existente foi alterada.
- Nenhuma tabela existente foi reutilizada.
- Nenhum endpoint foi criado.
- Nenhuma rota foi criada.
- Nenhum controller existente foi alterado.
- Nenhum service existente foi alterado.
- Nenhum arquivo de frontend foi alterado.
- Nenhum import existente foi alterado.
- Nenhum modulo existente depende de Pre-Matricula.

## Validacao

Validacoes executadas:

- `node --check` nos arquivos JS do modulo: aprovado.
- Require direto do service com repository mockado: aprovado.
- Busca por referencias externas a `pre-matricula`, `Prematricula` e `pre_matriculas`: `NO_EXTERNAL_PRE_MATRICULA_REFERENCES`.
- Busca por referencias a tabelas legadas dentro do modulo: `NO_LEGACY_TABLE_REFERENCES_IN_PRE_MATRICULA`.
- `npm run build`: aprovado.
- Teste de acesso ao banco via `ping()`: aprovado.
- `ensureSchema()`: criou/garantiu a tabela `pre_matriculas` de forma idempotente.
- Teste CRUD na tabela nova: criou, leu, atualizou, listou e removeu um registro temporario.
- Checagem final: `pre_matriculas` existe e o registro temporario da Sprint 8.1 ficou com contagem `0`.

Resultado do teste CRUD:

```json
{
  "ok": true,
  "ping": true,
  "deleted": true
}
```

Resultado da checagem final:

```json
{
  "tableExists": true,
  "temporaryRows": 0
}
```

## Riscos

| Risco | Nivel | Mitigacao |
| --- | --- | --- |
| Executar DDL no banco errado | Medio | Script isolado e tabela nova. Validar ambiente antes de producao. |
| Integrar pre-matricula cedo demais ao cadastro atual | Alto | Nenhum endpoint, rota ou controller foi criado. |
| Criar dependencia com Pessoa antes da tabela existir | Medio | Campos `pessoa_*` sao nullable e sem FK. |
| Afetar modulos atuais | Baixo | Repository toca somente `pre_matriculas`. |

## Proximos Passos

1. Criar testes automatizados do service com repository mockado.
2. Definir contrato de API publica/privada para pre-matricula.
3. Criar controller e rota em sprint propria.
4. Planejar tela de pre-matricula somente apos contrato de API aprovado.
5. Integrar com Pessoa apenas quando a persistencia de Pessoa existir.
