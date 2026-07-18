# Sprint 27.17A.4.1B — Inventário e Migração Gradual dos Writers de Pessoa

## Objetivo e estado anterior

Esta sprint trata exclusivamente `LEGACY_WRITERS_UNSYNCHRONIZED`. Antes dela, create/update modernos já persistiam normalizados, mas a fixture E2E fazia SQL direto sem as novas colunas e updates com `null` explícito podiam reutilizar valores aninhados antigos.

Nenhum unique, migration, backfill operacional, CRM, Aluno, Perfil, controller, rota ou frontend foi criado.

## Auditoria

Foram pesquisados writers literais e indiretos em todo `backend`, `scripts`, `src` e documentação, incluindo repositories, services, query runners, controllers, matrículas, CRM, portais, imports, seeds, fixtures, E2E, migrations, jobs e integrações.

Resultado canônico:

- 3 writers modernos sincronizados no `PersonRepository`;
- 1 backfill exclusivamente de migration;
- 4 ocorrências de fixture/teste na allowlist;
- 1 SQL direto executável encontrado, a fixture E2E, migrado nesta sprint;
- nenhum writer operacional `REPLACE INTO people`;
- nenhum importador/job ativo de `people` encontrado;
- nenhum writer externo confirmado, embora não possa ser excluído operacionalmente.

O inventário detalhado está em `PERSON_WRITERS_INVENTORY.md`.

## Implementação

1. Mapper: diferencia campo ausente de `null` explícito nos quatro contatos/documentos persistidos.
2. Repository: a seleção da fonte para normalização também preserva `null` explícito.
3. Service: patches aninhados de `contact` e documento CPF atualizam a fonte flat usada na persistência.
4. Fixture: upsert E2E grava e-mail/telefone normalizados usando o módulo canônico.
5. Allowlist: lista fechada de writers e strings SQL auditadas.
6. Teste de inventário: falha para novo SQL literal em `people` fora da allowlist.
7. Testes de consistência: cobrem create, inválidos, ausentes, update, remoção, preservação, patches aninhados, atomicidade e fixture.

Não há duplicação de regex de identidade fora dos testes do normalizador. Todas as gravações migradas usam `person-identity-normalizer.js`.

## Compatibilidade

Valores legados inválidos continuam preservados na coluna original e recebem normalizado nulo. Nenhum payload público mudou. `PersonService.update()` continua oferecendo patch por merge; `PersonRepository.update()` continua recebendo o estado completo.

O deploy exige migration A.4 antes do código. Não há fallback para schema antigo, pois aceitar a gravação sem colunas normalizadas recriaria o blocker.

## Segurança

- queries continuam parametrizadas;
- original e normalizado são gravados na mesma instrução;
- testes usam somente identidades sintéticas;
- erros/logs novos não contêm valores pessoais;
- nenhum banco externo foi acessado;
- nenhum dado existente foi alterado.

## Impacto no gate

`LEGACY_WRITERS_UNSYNCHRONIZED=PARTIALLY_RESOLVED`.

Todos os writers controlados e executáveis conhecidos no repositório estão sincronizados. O blocker não pode ser marcado `RESOLVED` porque writers manuais/externos não foram excluídos, as colunas permanecem nullable e os cadastros civis legados continuam paralelos.

O gate global continua `NOT_EXECUTED/BLOCKED` pelos demais blockers da A.4.1.

## Próximos passos

1. disponibilizar MySQL isolado para validação física;
2. confirmar writers operacionais externos e política de acesso direto;
3. decidir como impedir fisicamente CPF bruto com normalizado nulo;
4. consolidar Alunos/Responsáveis em sprints próprias, sem migração massiva;
5. reexecutar o gate A.4.1 antes de qualquer A.4.2 ou resolvedor concorrente.
