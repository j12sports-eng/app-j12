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
- `profiles/`: estrutura futura para perfis de Pessoa.
- `relationships/`: estrutura futura para relacionamentos entre Pessoas e dominios.
- `controllers/`: futuros controllers do dominio.
- `services/`: futuros services do dominio.
- `repositories/`: futuros repositories do dominio.
- `validators/`: futuros validadores do dominio.
- `types/`: futuros tipos e contratos do dominio.

## Estado atual

Nenhum modulo existente foi migrado. Nenhum banco, SQL, endpoint, controller, service legado, autenticacao ou frontend foi alterado.
