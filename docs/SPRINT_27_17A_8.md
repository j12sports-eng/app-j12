# Sprint 27.17A.8 — Integração da Resolução Canônica com Matrículas

## Resultado

Foi criado um entrypoint moderno e aditivo para o fluxo `Pessoa -> perfil aluno -> Enrollment DRAFT`:

```text
EnrollmentFacade.resolveStudentAndCreateDraftEnrollment(input, context)
  -> StudentEnrollmentApplicationService
    -> StudentApplicationService.resolveOrCreateStudent()
    -> EnrollmentApplicationService.getEnrollmentStatusSummary()
    -> EnrollmentApplicationService.createDraftEnrollmentIdempotently()
```

Nenhum controller, rota, frontend ou consumidor legado foi alterado.

## Arquitetura auditada

O cenário real é o **C: fluxos moderno e legado paralelos**. O fluxo moderno usa `people`, `person_profiles(profile_type=aluno)` e `enrollments`. `j12_alunos` permanece legado e não participa desta integração.

O boundary público moderno de Matrículas é `EnrollmentFacade`. As regras e a persistência continuam no `EnrollmentApplicationService` e no repository injetado. O novo `StudentEnrollmentApplicationService` é um orquestrador de aplicação do domínio de Matrículas: recebe os dois serviços por DI e não acessa repositories de Pessoas.

## Contrato público

Entrada mínima real:

```javascript
{
  student: { personId, cpf, nome, dataNascimento, sexo, email, telefone },
  enrollment: { startDate }
}
```

`personId` permite resolver um aluno já conhecido. Sem ele, `nome`, `dataNascimento` e `sexo` são exigidos pelo serviço canônico de Aluno. CPF continua opcional conforme a política, mas, quando informado, é validado. E-mail e telefone nunca resolvem identidade.

O agregado moderno de matrícula não possui unidade, curso, modalidade, turma, plano ou financeiro. Por isso somente `startDate`, `studentPersonId` e `studentProfileId` são enviados à criação de DRAFT.

Saída:

```javascript
{
  personId,
  personProfileId,
  enrollmentId,
  enrollmentStatus: "DRAFT",
  resolutions: { person: "FOUND|CREATED", profile: "FOUND|CREATED", enrollment: "FOUND|CREATED" },
  reused: { person: true|false, profile: true|false, enrollment: true|false }
}
```

Não existe nem é retornado `studentId`; CPF e demais PII também não são retornados.

## Estados e decisões

- `NONE`: chama a criação idempotente de DRAFT.
- `DRAFT`: devolve o registro existente sem atualizar `startDate` ou qualquer outro dado.
- `ACTIVE`: bloqueia com `ENROLLMENT_ACTIVE_EXISTS`.
- `CONFLICT`: bloqueia com `ENROLLMENT_STATE_CONFLICT`, sem escolher registro.
- ausência de `startDate`: `ENROLLMENT_DATA_INCOMPLETE`.
- falha de consulta: `ENROLLMENT_RESOLUTION_FAILED` sanitizado.
- falha de criação ou retorno inválido: `ENROLLMENT_DRAFT_CREATION_FAILED` sanitizado.

Erros canônicos de Pessoa, CPF, dados de Aluno e perfil são preservados e interrompem o fluxo antes de Matrículas.

## Idempotência, transação e concorrência

A compatibilidade de DRAFT existente é exatamente a regra atual: mesmo par `studentPersonId/personProfileId`. Nenhum novo critério foi criado.

Repetições sequenciais reutilizam Pessoa, perfil e DRAFT. A criação de matrícula reutiliza `createDraftEnrollmentIdempotently()` e, no adapter MySQL atual, seus guards concorrentes existentes. Nenhum lock, índice ou migration foi adicionado nesta Sprint.

Não existe unit of work compartilhada comprovada entre Pessoas e Matrículas. Portanto não há promessa de atomicidade distribuída: Pessoa e perfil podem ser criados antes de uma falha de matrícula. A nova tentativa os reutiliza; nenhuma exclusão compensatória é executada.

As garantias permanecem distintas: Pessoa e perfil têm idempotência lógica sequencial, enquanto Matrículas conserva sua proteção própria. Não se promete unicidade física global de Pessoa/Perfil nem proteção total além dos contratos atuais.

## Autorização e efeitos colaterais

O `context` é repassado intacto ao serviço canônico de Aluno. Como o agregado `Enrollment` atual não possui unidade e não há rota nova, autorização de unidade permanece obrigatória no entrypoint consumidor. A resolução global de identidade não concede acesso global.

O orquestrador chama diretamente o serviço de aplicação de Matrículas injetado, não a emissão de eventos do facade. Ele não confirma matrícula, não ativa DRAFT e não cria financeiro, cobrança, contrato, turma, vaga, agenda, notificação ou automação.

## Consumidores

| Consumidor                                                | Estado   | Observação                                      |
| --------------------------------------------------------- | -------- | ----------------------------------------------- |
| `EnrollmentFacade.resolveStudentAndCreateDraftEnrollment` | MIGRATED | entrypoint moderno explícito desta Sprint       |
| CRM                                                       | PENDING  | Sprint 27.17A.9                                 |
| conversão de Lead/pré-matrícula                           | PENDING  | Sprint 27.17D                                   |
| controllers, rotas e frontend modernos                    | PENDING  | nenhuma API criada nesta Sprint                 |
| fluxos baseados em `j12_alunos`                           | LEGACY   | preservados e não acoplados                     |
| validações físicas/UNIQUE de CPF                          | BLOCKED  | dependência externa já registrada; não retomada |

## Riscos residuais

- ausência de transação única entre os domínios;
- idempotência de Pessoa/Perfil ainda sem garantia física concorrente;
- autorização por unidade deve ser aplicada pelo futuro consumidor antes da chamada;
- o adapter de Matrículas mantém as garantias concorrentes que já possuía, sem ampliá-las.

## Escopo preservado

Não houve migration, alteração de schema, uso de `j12_alunos`, confirmação, financeiro, evento, controller, rota ou frontend. As Sprints 27.17A.4.1C.1, 27.17A.4.1E e 27.17A.4.2 não foram retomadas.

Próximos passos: Sprint 27.17A.9 integra CRM; a Sprint 27.17D deverá reutilizar este entrypoint na conversão segura para DRAFT.
