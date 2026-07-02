# Sprint 9.10 - Descoberta de Matricula Segura

Esta sprint avaliou se o backend possui base segura para criar Matricula no
fluxo iniciado em `CreateEnrollmentUseCase`.

## Decisao

Cenario B aplicado: base segura nao encontrada.

Nenhuma Matricula foi criada nesta sprint.

## Objetivo Avaliado

O fluxo atual da Sprint 9.9 cria:

- Pessoa do responsavel;
- Perfil do responsavel;
- Pessoa do aluno;
- Perfil do aluno;
- Relacionamento responsavel-aluno.

A Sprint 9.10 deveria criar Matricula somente se ja existissem:

- modelo de Matricula;
- repository de Matricula;
- campos minimos necessarios;
- relacao segura com Pessoa do aluno;
- status inicial seguro;
- dados suficientes no payload atual.

## Resultado da Descoberta

Nao existe um dominio seguro de Matricula para o novo fluxo.

Itens encontrados:

- `backend/src/domains/pessoas/application/contracts/enrollment.contract.js`
  descreve contrato conceitual e etapas futuras, mas nao persiste dados.
- `backend/src/domains/pessoas/application/interfaces/ienrollment.repository.js`
  define apenas uma interface JSDoc vazia, sem implementacao.
- `backend/src/domains/pessoas/pre-matricula` representa pre-matricula isolada,
  nao Matricula definitiva.
- Fluxos legados usam `j12_alunos`, `j12_matriculas_publicas` e SQL em
  controllers/services, mas esses caminhos dependem de `aluno.id` legado e nao
  de Pessoa do aluno resolvida com seguranca.

Itens ausentes:

- entidade ou modelo definitivo de Matricula no dominio novo;
- `EnrollmentRepository` implementado;
- tabela/estrutura segura vinculada a `personId` do aluno;
- contrato de status inicial definitivo de Matricula;
- mapeamento seguro entre `payload.matricula` e persistencia definitiva;
- regra de unicidade ou alocacao segura para numero de matricula no dominio novo.

## Motivo do Impedimento

Criar Matricula agora exigiria pelo menos um dos atalhos abaixo:

- reutilizar controller ou service legado;
- usar tabela legada baseada em `aluno.id`;
- criar repository novo;
- alterar SQL ou banco;
- assumir que pre-matricula equivale a Matricula definitiva.

Todos esses caminhos violam o escopo da Sprint 9.10.

## Comportamento Preservado

O comportamento da Sprint 9.9 permanece inalterado:

- Pessoa do responsavel e criada;
- Perfil do responsavel e criado;
- Pessoa do aluno e resolvida ou criada com `personId` seguro;
- Perfil do aluno e criado;
- Relacionamento responsavel-aluno e criado usando `personId` seguro;
- Matricula nao e criada;
- Contrato nao e criado;
- Financeiro nao e criado.

## Arquivos Alterados

```text
docs/BACKEND/SPRINT_9_10.md
```

Nao foram criados ou alterados:

- `EnrollmentRecordApplicationService`;
- `EnrollmentApplicationService`;
- repositories;
- banco;
- SQL;
- controllers;
- rotas;
- APIs;
- frontend;
- services legados.

## Auditoria Executada

- Busca confirmou ausencia de `backend/src/domains/enrollments`.
- Busca confirmou ausencia de entidade/repository definitivo de Matricula.
- Busca confirmou que `ienrollment.repository.js` e apenas interface JSDoc sem
  implementacao.
- Busca confirmou que `pre_matriculas` e pre-matricula isolada, nao Matricula
  definitiva.
- `node --check` executado com sucesso nos JS do fluxo preservado da Sprint
  9.9.
- `npm run build` executado com sucesso.
- Smoke test valido executado com sucesso para confirmar comportamento da
  Sprint 9.9.
- Smoke test invalido executado com sucesso para confirmar falha antes de
  repositories.
- Busca de escopo executada para confirmar que esta sprint nao alterou
  controllers, rotas, APIs, frontend, banco, SQL ou services legados.

## Observacao de Worktree

Durante a auditoria, o workspace ja continha alteracoes nao relacionadas em
rotas, services legados, repositories e frontend. A Sprint 9.10 nao alterou
esses arquivos e adicionou somente esta documentacao.

## Proximas Etapas

- Definir entidade definitiva de Matricula.
- Definir repository definitivo de Matricula antes da integracao.
- Definir status inicial seguro de Matricula.
- Definir vinculo persistente com Pessoa do aluno via `personId`.
- Definir regra de numero de matricula sem depender de `aluno.id` legado.
- Somente depois criar `EnrollmentRecordApplicationService`.
