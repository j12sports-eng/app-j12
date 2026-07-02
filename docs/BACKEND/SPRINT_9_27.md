# Sprint 9.27 - Garantir Idempotencia Na Criacao De DraftEnrollment

## Objetivo

Garantir que o fluxo de criacao de `draftEnrollment` nao crie dois rascunhos
ativos para o mesmo aluno/perfil quando executado mais de uma vez.

## Estrategia De Idempotencia

A idempotencia foi centralizada no dominio `enrollments`:

- o `MySqlEnrollmentRepository` ganhou `createDraftIfNotExists(enrollment)`;
- o metodo procura um `DRAFT` existente para `student_person_id` e
  `student_profile_id`;
- se existir, retorna o registro existente;
- se nao existir, cria um novo registro;
- a verificacao e a criacao sao serializadas por um lock nomeado do MySQL,
  sem alterar a estrutura da tabela.

O nome do lock e derivado de:

```text
student_person_id + student_profile_id
```

com hash SHA-256 para manter o identificador curto e seguro.

## Fluxo Antes

Antes desta sprint:

1. o orquestrador consultava se havia draft;
2. se nao havia, chamava persistencia;
3. a criacao podia repetir a decisao em outro ponto do fluxo.

Esse comportamento funcionava em execucoes sequenciais, mas a decisao de
idempotencia nao estava consolidada em uma operacao propria do repository.

## Fluxo Depois

Agora o fluxo usa:

```js
EnrollmentApplicationService.createDraftEnrollmentIdempotently()
```

Esse metodo delega para:

```js
MySqlEnrollmentRepository.createDraftIfNotExists()
```

Comportamento:

- primeira execucao: cria o draft e retorna `created=true`;
- segunda execucao: reutiliza o mesmo draft e retorna `reused=true`;
- execucoes seguintes: continuam reutilizando o mesmo draft;
- nenhum novo `INSERT` e executado quando ja existe `DRAFT` ativo para o mesmo
  aluno/perfil.

## Logs

O orquestrador de `pessoas` registra:

- criacao de draft persistido;
- reutilizacao de draft persistido;
- falhas de persistencia.

Os logs nao alteram o contrato externo da API.

## Arquivos Alterados

```text
backend/src/domains/enrollments/application/repositories/enrollment.repository.js
backend/src/domains/enrollments/application/services/enrollment-application.service.js
backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment.repository.js
backend/src/domains/pessoas/application/services/enrollment-application.service.js
docs/BACKEND/SPRINT_9_27.md
```

## Smoke Test

Foi executado smoke test real com transacao manual e rollback:

1. criou Pessoa/Perfil de aluno de teste;
2. executou o fluxo uma primeira vez;
3. confirmou criacao do draft;
4. executou o fluxo uma segunda vez para o mesmo aluno/perfil;
5. confirmou reutilizacao do mesmo `draftEnrollment.id`;
6. confirmou que a tabela manteve apenas um `DRAFT`;
7. fez rollback para nao deixar massa de teste.

Resultado:

```text
ENROLLMENTS_TABLE_EXISTS=true
DRAFT_ENROLLMENT_IDEMPOTENCY_ENABLED=true
FIRST_DRAFT_CREATED=true
SECOND_CALL_REUSED_EXISTING_DRAFT=true
NO_DUPLICATE_DRAFT_CREATED=true
```

## Auditoria

Executado:

```bash
node --check backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment.repository.js
node --check backend/src/domains/enrollments/application/services/enrollment-application.service.js
node --check backend/src/domains/pessoas/application/services/enrollment-application.service.js
cmd /c npm run build
```

Resultado:

- `node --check`: aprovado;
- `cmd /c npm run build`: aprovado;
- smoke test idempotente: aprovado;
- `CreateEnrollmentUseCase` continua sem conhecer repository concreto;
- nenhuma controller, rota, API publica ou frontend foi alterado;
- `/public/enrollments` nao foi alterado;
- financeiro, mensalidades, turmas, legado e contratos publicos nao foram
  alterados;
- estrutura da tabela `enrollments` nao foi modificada;
- nenhuma migration foi criada.

## Limitacoes

A idempotencia depende de todos os fluxos de criacao de draft usarem o caminho
de application service/repository implementado nesta sprint. O metodo bruto
`create()` do repository foi preservado por compatibilidade e continua sendo uma
operacao de baixo nivel.

## Proximos Passos

1. Avaliar uma constraint fisica de unicidade parcial em sprint propria, se o
   banco alvo permitir uma estrategia compativel com soft delete/status.
2. Planejar UnitOfWork/transacao multi-repository para consolidar consistencia
   entre Pessoas, Relacionamentos e Matricula.
3. Monitorar logs de criacao/reutilizacao em homologacao.
