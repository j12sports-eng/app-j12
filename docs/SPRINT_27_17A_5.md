# Sprint 27.17A.5 — Resolução Canônica e Idempotente de Identidade

## Contrato

`ResolveIdentityService.resolve(input)` resolve por `personId`/`id` e depois por `cpf`/`cpfNormalized`. Retorna:

- `FOUND`: inclui somente `personId` e `matchedBy`;
- `NOT_FOUND`: identificador canônico consultado sem correspondência;
- `CONFLICT`: mais de uma Pessoa possui o mesmo `cpf_normalized`;
- `INSUFFICIENT_DATA`: não há ID ou CPF normalizável.

E-mail e telefone não participam da correspondência porque a política permite contatos compartilhados.

## Arquitetura

O serviço fica na camada de aplicação de Pessoas e depende de `PersonRepository`. A consulta de CPF retorna no máximo dois IDs: zero indica ausência, um indica correspondência e dois indicam conflito. O resultado não expõe PII e falhas de infraestrutura são sanitizadas.

A estratégia não depende de índice `UNIQUE` e continuará válida quando a restrição física existir.

## Escopo preservado

Não há criação, atualização, merge, migration, schema, índice, validação física ou diagnóstico operacional. CRM e Matrículas ainda não foram integrados.

As Sprints 27.17A.4.1C.1, 27.17A.4.1E e 27.17A.4.2 permanecem encerradas por bloqueio externo.

## Integração futura

CRM, Pré-matrícula e Matrículas chamarão o resolvedor antes da criação: `FOUND` reutiliza o `personId`; `NOT_FOUND` permite seguir para criação explícita; `CONFLICT` exige revisão; `INSUFFICIENT_DATA` exige complementação.
