# Dominio Pre-Matricula

Modulo funcional inicial e isolado para pre-matricula no dominio Pessoas.

## Objetivo

Representar uma solicitacao inicial de matricula antes da criacao definitiva de aluno, responsavel, contrato, financeiro ou acesso ao portal.

Este modulo nao esta integrado ao sistema atual por rotas, controllers ou frontend.

## Status

- `PENDENTE`
- `EM_ANALISE`
- `APROVADA`
- `REJEITADA`
- `CANCELADA`

## Campos minimos

### Aluno

- `nome`
- `dataNascimento`
- `sexo` opcional
- `unidadeInteresse`
- `modalidade`
- `observacoes`

### Responsavel

- `nome`
- `cpf`
- `telefone`
- `whatsapp`
- `email`

## Tabela

Tabela nova e isolada:

- `pre_matriculas`

Script SQL:

- `pre_matriculas.sql`

A tabela possui campos nullable `pessoa_aluno_id` e `pessoa_responsavel_id` para futura integracao com o dominio Pessoa, sem FK neste momento.

## Arquivos

- `pre_matriculas.sql`: script MySQL da tabela nova.
- `prematricula.entity.js`: entidade de dominio.
- `prematricula.types.js`: status e contratos JSDoc.
- `prematricula.mapper.js`: mapeamento entre dados planos e entidade.
- `prematricula.repository.js`: CRUD da tabela `pre_matriculas` usando mysql2 via wrapper atual.
- `prematricula.service.js`: service isolado para validar e persistir pre-matriculas.
- `prematricula.validator.js`: validacao minima do payload, sem uso por APIs atuais.

## Garantias

- Nenhuma tabela existente foi alterada.
- Nenhuma tabela existente e consultada pelo modulo.
- Nenhuma migration automatica foi criada.
- Nenhum endpoint foi criado.
- Nenhuma rota foi criada.
- Nenhum controller existente foi alterado.
- Nenhum service existente foi alterado.
- Nenhum frontend foi alterado.
- Nenhum modulo existente depende desta estrutura.
