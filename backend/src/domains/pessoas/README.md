# Dominio Pessoas

Dominio base reservado para o conceito futuro de Pessoa no App J12.

## Objetivo

Representar Pessoa como uma base arquitetural futura para perfis como aluno, professor, funcionario, responsavel, usuario e locatario.

## Estrutura

- `person.entity.js`: entidade estrutural `Person`, sem persistencia e sem regra de negocio.
- `person.types.js`: contratos JSDoc do formato futuro de Pessoa.
- `person.mapper.js`: mapeadores entre dados planos e entidade `Person`.
- `person.repository.js`: boundary futuro de persistencia, sem SQL.
- `person.service.js`: boundary futuro de casos de uso, sem regras implementadas.
- `person.validator.js`: boundary futuro de validacao, sem regras de negocio.
- `application/services/resolve-identity.service.js`: resolucao canonica e somente leitura por `people.id` ou `cpf_normalized`.
- `profiles/`: estrutura futura para perfis de Pessoa.
- `relationships/`: estrutura futura para relacionamentos entre Pessoas e dominios.
- `controllers/`: futuros controllers do dominio.
- `services/`: futuros services do dominio.
- `repositories/`: futuros repositories do dominio.
- `validators/`: futuros validadores do dominio.
- `types/`: futuros tipos e contratos do dominio.

## Estado atual

O resolvedor retorna somente `FOUND`, `NOT_FOUND`, `CONFLICT` ou `INSUFFICIENT_DATA`, nao cria Pessoas e nao usa e-mail ou telefone como identificadores unicos.

`PersonApplicationService.resolveOrCreatePerson(payload, context)` e o ponto canonico para novos fluxos modernos. Ele reutiliza `personId` em `FOUND`, cria explicitamente em `NOT_FOUND`, bloqueia `CONFLICT` e permite criacao basica sem CPF em `INSUFFICIENT_DATA`. Operacoes futuras podem informar `requiresStrongIdentity: true`.

`createPerson()` e `findByCpf()` permanecem disponiveis somente por compatibilidade. Novos consumidores nao devem usar `findByCpf()` como decisao de identidade, pois ele seleciona uma linha e nao detecta conflito.

No modelo moderno, Aluno e representado por Pessoa + perfil `aluno`; nao existe entidade Student separada. `StudentApplicationService.resolveOrCreateStudent()` usa o boundary canonico de Pessoa e depois `ProfileApplicationService.resolveOrCreateStudentProfile()`. O legado `j12_alunos` permanece paralelo e fora desse fluxo.

A Sprint 27.17A.8 adiciona, no dominio de Matriculas, o primeiro consumidor moderno explicito de `resolveOrCreateStudent()`. O orquestrador reutiliza somente `personId` e `personProfileId`; Pessoas continua sem controlar regras de matricula e nao atualiza automaticamente cadastros encontrados.

A Sprint 27.17A.9 adiciona um consumidor CRM que exige dados do aluno explicitamente separados do contato comercial. O CRM chama apenas `resolveOrCreateStudent()` e registra os IDs resultantes em seu proprio dominio, sem acessar repositories de Pessoas.

Nenhum endpoint, controller, service legado, frontend, migration ou schema foi alterado.
