# Sprint 27.17A.6 — Integração da Resolução Canônica com Pessoas

## Objetivo e estado anterior

Integrar o resolvedor somente leitura da Sprint 27.17A.5 ao ponto moderno de criação de Pessoa, sem alterar consumidores legados, matrícula, aluno, perfil, CRM, frontend, schema ou infraestrutura.

Antes desta Sprint, `PersonApplicationService.createPerson()` delegava diretamente ao repository. `PersonService.findByCpf()` e `PersonRepository.findByCpf()` selecionavam uma linha sem detectar duplicidades.

## Auditoria

Foram auditados integralmente o resolvedor e seus testes, `PersonApplicationService`, `PersonService`, `PersonRepository`, interface, mapper, validator, exports, normalizador, erros, serviços de perfil, aluno, relacionamento e matrícula internos ao domínio, seus consumidores, DI e usos de `findByCpf`, `findById`, `createPerson` e `resolveStudentPerson`. Não há controllers ou rotas modernas de Pessoas conectados a esse application service.

## Estratégia

Foi escolhida adoção gradual. `createPerson()` mantém assinatura e retorno porque já é consumido pelos fluxos internos de Aluno e Matrícula, ambos fora do escopo. A nova operação pública `resolveOrCreatePerson(payload, context)` é o único ponto canônico para novos consumidores modernos.

O application service recebe `ResolveIdentityService` por injeção. Quando ausente, compõe o resolvedor com o mesmo `PersonRepository`; não há service locator, acoplamento adicional ao MySQL ou import circular.

## Estados

- `FOUND`: retorna `personId`, `created: false` e `reused: true`; não cria nem atualiza dados.
- `NOT_FOUND`: chama `createPerson()` uma vez e retorna criação explícita.
- `CONFLICT`: bloqueia antes da escrita com `PERSON_IDENTITY_CONFLICT`.
- `INSUFFICIENT_DATA`: permite criação básica com os demais dados obrigatórios; com `requiresStrongIdentity: true`, bloqueia com `PERSON_IDENTITY_REQUIRED`.

O resultado não contém CPF, nome, e-mail, telefone ou objeto cadastral.

## Normalização e criação

CPF preenchido passa por `person-identity-normalizer.js` antes da resolução. CPF inválido é rejeitado com o erro seguro existente e não cria registro. CPF ausente ou `null` permanece permitido para criação básica. E-mail e telefone continuam contatos e não participam da decisão de identidade.

Falhas de criação são convertidas em `PERSON_CREATION_FAILED` sem incluir payload ou PII. Falhas sanitizadas do resolvedor impedem a escrita e são preservadas.

## Identidade e autorização

O resolvedor identifica globalmente; ele não concede acesso, cria vínculo ou interpreta unidade/usuário. O contexto recebido não é mutado. Consumidores futuros permanecem responsáveis por autorização contextual antes de visualizar, vincular ou editar.

## Idempotência e concorrência

Há idempotência por resolução: chamadas posteriores reutilizam uma Pessoa já encontrada, conflitos bloqueiam e uma execução cria no máximo uma vez. Não há garantia física concorrente: dois processos podem resolver `NOT_FOUND` simultaneamente e criar duas linhas até a futura restrição física. Não foram adicionados lock local, mutex, `GET_LOCK`, trigger ou índice temporário.

## Consumidores

Migrado:

- novo entrypoint moderno `PersonApplicationService.resolveOrCreatePerson()`.

Preservados e pendentes:

- `createPerson()`, usado atualmente por Aluno e Matrícula, mantém contrato;
- `findByCpf()` permanece compatível, marcado como lookup não canônico;
- Perfil, Aluno, Responsável, Matrícula, Pré-matrícula, CRM, controllers, rotas, portais, imports e integrações externas não foram migrados.

## Compatibilidade e riscos

Nenhuma Pessoa encontrada é enriquecida ou atualizada. `PersonService` não duplicava resolução/criação e foi mantido. Não havia guards de autorização nesse boundary para remover. O risco residual é a corrida entre resolução e criação sem unicidade física.

Nenhuma migration, alteração de schema, índice `UNIQUE`, auditoria de infraestrutura ou validação MySQL foi criada ou executada. As Sprints 27.17A.4.1C.1, 27.17A.4.1E e 27.17A.4.2 permanecem encerradas por bloqueio externo.

## Próximos passos

Avaliar a integração controlada com Perfil e Aluno somente em Sprint própria, seguida por Matrículas e CRM, preservando autorização contextual e o contrato desta operação.
