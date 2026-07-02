# Enrollment Domain Contract

Documento da Sprint 9.11 para definir o dominio de Matricula no backend da J12
ERP.

Esta sprint nao implementa persistencia. O objetivo e estabelecer o contrato de
dominio que deve orientar as proximas sprints.

## Decisao Arquitetural

`Enrollment` sera o Aggregate Root da Matricula.

Uma Matricula representa a jornada operacional de um aluno em uma unidade,
modalidade, turma e plano da J12. Ela nasce depois de Pessoa, Perfil de Aluno e
Relacionamento responsavel-aluno estarem seguros.

O Aggregate Root nao deve depender de `aluno.id` legado. O vinculo seguro com o
aluno deve vir do dominio Pessoas:

- `studentPersonId`: Pessoa do aluno resolvida ou criada com seguranca.
- `studentProfileId`: Perfil `aluno` associado a Pessoa do aluno.

Quando o repository definitivo existir, a Matricula deve referenciar
preferencialmente `studentProfileId` como identidade operacional do aluno e
manter `studentPersonId` como referencia de identidade civil segura.

## 1. O Que E Uma Matricula?

Matricula e o registro de entrada e permanencia operacional do aluno em uma
jornada esportiva da J12.

Responsabilidades da Matricula:

- identificar a jornada operacional do aluno;
- controlar numero de matricula;
- controlar status da jornada;
- registrar data de matricula e datas de vigencia;
- referenciar unidade, modalidade, turma, horario e plano quando aplicavel;
- servir como ponto de integracao futuro para contrato, financeiro, presencas e
  portal;
- preservar o vinculo seguro com Pessoa/Perfil de Aluno.

Matricula nao e cadastro civil do aluno. Dados civis pertencem a `Person`.

Matricula nao e contrato. Contrato deve referenciar Matricula quando existir.

Matricula nao e financeiro. Financeiro deve referenciar Matricula ou
AlunoProfile quando a regra futura for definida.

## 2. Entidades Obrigatorias Referenciadas

Obrigatorias para qualquer Matricula persistida:

| Campo | Obrigatorio | Origem segura | Observacao |
| --- | --- | --- | --- |
| `id` | Sim | Gerado pelo dominio de Matricula | Identidade do Aggregate Root. |
| `studentPersonId` | Sim | `StudentApplicationService` | Nao pode vir de `aluno.id`. |
| `studentProfileId` | Sim | `ProfileApplicationService` | Perfil `aluno` criado para a Pessoa do aluno. |
| `status` | Sim | Enum do dominio de Matricula | Nao reutilizar status solto de tabela legada. |
| `enrollmentDate` | Sim | `payload.matricula.dataMatricula` | Data ISO validada. |
| `createdAt` | Sim | Application/Repository | Auditoria tecnica. |
| `updatedAt` | Sim | Application/Repository | Auditoria tecnica. |

Obrigatorias para ativacao, mas podem ser pendentes em `DRAFT`, `PENDING` ou
`INCOMPLETE`:

| Campo | Obrigatorio para ativar | Origem esperada | Observacao |
| --- | --- | --- | --- |
| `unitId` | Sim | Cadastro de unidades | `payload.matricula.unidadeIds` hoje e array; contrato final deve decidir cardinalidade. |
| `modalityIds` | Sim | Cadastro de modalidades | Pode ser uma ou mais modalidades. |
| `classIds` | Condicional | Turmas ativas | Turma e referencia externa, nao entidade interna da Matricula. |
| `scheduleIds` | Condicional | Horarios ativos | Necessario quando a turma/operacao exigir horario explicito. |
| `planId` | Condicional | Planos ativos | Obrigatorio quando houver cobranca recorrente ou contrato vinculado. |
| `responsibleRelationshipId` | Condicional | RelationshipApplicationService | Obrigatorio para menor ativo e para financeiro quando aluno nao for pagador. |

Referencias indiretas:

- Responsavel legal vem do relacionamento responsavel-aluno.
- Responsavel financeiro vem do relacionamento responsavel-aluno.
- Contrato deve apontar para Matricula em sprint futura.
- Financeiro deve apontar para Matricula ou PaymentPlan em sprint futura.

## 3. Estados Da Matricula

Enum canonico proposto para o dominio:

| Estado | Significado | Pode ser status inicial |
| --- | --- | --- |
| `DRAFT` | Registro preparado, ainda sem dados suficientes para submissao. | Sim, para fluxo interno futuro. |
| `PENDING` | Dados minimos recebidos, aguardando validacoes operacionais. | Sim. |
| `INCOMPLETE` | Existe pendencia de dados, turma, plano, documento ou responsavel. | Sim. |
| `EXPERIMENTAL` | Aluno em experiencia/aula experimental com matricula operacional limitada. | Sim. |
| `ACTIVE` | Matricula ativa para operacao, presenca e cobranca conforme regras. | Sim, somente se dependencias obrigatorias existirem. |
| `SUSPENDED` | Matricula temporariamente suspensa, sem encerramento definitivo. | Nao. |
| `CANCELLED` | Matricula cancelada antes ou durante a jornada. | Nao. |
| `FINISHED` | Jornada encerrada de forma regular. | Nao. |

Mapeamentos observados que precisam de normalizacao futura:

- `PENDENTE`, `EXPERIMENTAL`, `ATIVA`, `INCOMPLETA` aparecem em docs de Cadastro V2.
- `ativo`, `experimental`, `inativo`, `excluido`, `reservado` aparecem no legado de alunos e numeros de matricula.
- `recebida` aparece em matricula publica.
- `PENDENTE`, `EM_ANALISE`, `APROVADA`, `REJEITADA`, `CANCELADA` pertencem a Pre-Matricula, nao a Matricula definitiva.

Antes da persistencia, uma sprint futura deve aprovar o enum final e os
mapeamentos de compatibilidade.

## 4. Informacoes Que Pertencem A Matricula

Pertence a Matricula:

- `id`;
- `enrollmentNumber`;
- `studentPersonId`;
- `studentProfileId`;
- `status`;
- `enrollmentDate`;
- `startDate`;
- `endDate`;
- `cancellationDate`;
- `suspensionReason`;
- `unitId` ou `unitIds`, conforme decisao de cardinalidade;
- `modalityIds`;
- `classIds`;
- `scheduleIds`;
- `planId`;
- `responsibleRelationshipId` quando exigido pela regra;
- `origin`;
- `metadata` operacional;
- timestamps de auditoria.

Nao pertence a Matricula:

- dados civis de Pessoa: nome, CPF, RG, nascimento, contato e endereco;
- Perfil de Aluno em si;
- Perfil de Responsavel em si;
- Relacionamento responsavel-aluno em si;
- contrato, clausulas, assinatura e anexos;
- financeiro, cobrancas, pagamentos e inadimplencia;
- dados internos de Turma;
- dados internos de Plano;
- documentos pessoais ou medicos;
- snapshots JSON como fonte primaria de verdade;
- usuario de portal e autenticacao.

Referencias externas permitidas:

- Matricula pode guardar IDs de Turma, Plano, Unidade, Modalidade e Horario.
- Matricula nao deve duplicar o conteudo dessas entidades.
- Matricula pode guardar snapshots apenas para compatibilidade durante migracao,
  nunca como fonte primaria quando os dominios definitivos existirem.

## 5. Dependencias Obrigatorias Antes Da Persistencia

Antes de criar um repository definitivo de Matricula, precisam existir:

- entidade `Enrollment`;
- enum `EnrollmentStatus`;
- validator de Matricula;
- mapper de Matricula;
- repository definitivo de Matricula;
- decisao de tabela/colecao definitiva;
- decisao de cardinalidade de unidade: uma unidade ou multiplas;
- decisao de cardinalidade de turma: uma turma principal ou multiplas;
- repository/consulta segura para validar unidade ativa;
- repository/consulta segura para validar modalidade ativa;
- repository/consulta segura para validar turma ativa;
- repository/consulta segura para validar horario ativo quando enviado;
- repository/consulta segura para validar plano ativo quando enviado;
- regra definitiva de numero de matricula;
- regra de concorrencia/idempotencia para numero de matricula;
- regra de status inicial permitido;
- regra para menor de idade e responsavel legal;
- regra para responsavel financeiro quando houver plano/cobranca;
- decisao se Matricula aponta para `studentProfileId`, `studentPersonId` ou
  ambos;
- estrategia de compatibilidade com `j12_alunos` e `j12_matriculas_publicas`;
- politica de historico/rematricula.

## 6. Componentes Encontrados

Application layer atual:

| Componente | Tipo | Estado |
| --- | --- | --- |
| `CreateEnrollmentCommand` | Command | Existe; encapsula payload. |
| `CreateEnrollmentValidator` | Validator | Existe; valida aluno, responsavel, relacionamento e campos minimos de `matricula`. |
| `CreateEnrollmentUseCase` | Use case | Existe; depende apenas de `EnrollmentApplicationService`. |
| `EnrollmentApplicationService` | Application service | Existe; cria Pessoa/Perfis/Relacionamento, nao cria Matricula. |
| `CreateEnrollmentRequest` | DTO | Existe; define `matricula.numeroMatricula`, `dataMatricula`, `statusInicial`, `modalidadeIds`, `unidadeIds`, `turmaIds`, `horarioIds`, `planoId`. |
| `EnrollmentContract` | Contrato conceitual | Existe; lista etapas futuras, incluindo `createEnrollment`. |
| `IEnrollmentRepository` | Interface JSDoc | Existe; nao ha implementacao. |
| `EnrollmentCreatedEvent` | Evento preparado | Existe; nao e EventBus e nao confirma Matricula persistida. |
| `EnrollmentApprovedEvent` | Evento conceitual | Existe; nao integrado. |
| `EnrollmentRejectedEvent` | Evento conceitual | Existe; nao integrado. |

Dominio de pessoas e aluno:

| Componente | Tipo | Estado |
| --- | --- | --- |
| `AlunoProfile` | Modelo conceitual | Existe; inclui `matriculaId`, `unidadeId`, `turmaIds`, `modalidades`, `planoId`, `dataIngresso`. |
| `PersonApplicationService` | Application service | Existe; cria Pessoa. |
| `ProfileApplicationService` | Application service | Existe; cria Perfil `responsavel` e `aluno`. |
| `StudentApplicationService` | Application service | Existe; resolve/cria Pessoa do aluno e Perfil `aluno`. |
| `RelationshipApplicationService` | Application service | Existe; cria relacionamento responsavel-aluno. |

Pre-Matricula:

| Componente | Tipo | Estado |
| --- | --- | --- |
| `Prematricula` | Entidade isolada | Existe; nao e Matricula definitiva. |
| `PrematriculaRepository` | Repository funcional | Existe; persiste `pre_matriculas`. |
| `PrematriculaService` | Service isolado | Existe; nao integrado ao fluxo atual. |
| `PrematriculaApprovalWorkflow` | Workflow conceitual | Existe; etapa 9 e `ativar_matricula`, ainda nao implementada. |
| `pre_matriculas.sql` | SQL | Existe; pertence a Pre-Matricula. |

Legado operacional:

| Componente | Tipo | Estado |
| --- | --- | --- |
| `j12_alunos` | Tabela legada | Mistura aluno, status, numero, plano, turma e snapshot. |
| `j12_matricula_numeros` | Registro de numeros | Existe; controla reserva/reuso por `aluno_id` legado. |
| `j12_matriculas_publicas` | Registro publico | Existe; guarda protocolo, numero, `aluno_id` e payload JSON. |
| `public-enrollments.controller.js` | Controller legado | Cria aluno publico, reserva numero e grava registro publico. |
| `alunos.controller.js` | Controller legado | Cria/edita aluno completo em tabelas legadas. |
| `financeiro.service.js` | Service legado | Usa `aluno.id`, `plano_id` e `turma_id`. |
| `turmas.routes.js` | Rotas legadas | Usa `j12_turmas` e vinculos por `aluno_id`/JSON. |
| `planos.routes.js` | Rotas legadas | Usa `j12_planos`, `taxa_matricula` e `contrato_vinculado`. |
| `student_contracts` | Tabela legada | Referenciada por `aluno_id`, nao por Matricula. |

Documentacao existente:

| Documento | Conteudo relevante |
| --- | --- |
| `docs/API/CADASTRO_V2.md` | Define payload futuro e status iniciais de matricula. |
| `docs/API/CADASTRO_V2_FLUXO.md` | Define etapa "Criar Enrollment/Matricula". |
| `docs/API/CADASTRO_V2_EXEMPLOS.md` | Exemplos de `matricula`. |
| `docs/ARQUITETURA/PERSON_PROFILE_ARCHITECTURE.md` | Define `Enrollment` como jornada operacional ligada a `AlunoProfile`. |
| `docs/ARQUITETURA/RELACIONAMENTOS_PESSOAS.md` | Define Aluno como Perfil de Pessoa e regras de responsavel. |
| `docs/ARQUITETURA/ENTITY_RELATIONSHIP_DIAGRAM.md` | Mostra `PersonAluno -> AlunoProfile -> Enrollment -> Contract`. |
| `docs/BACKEND/SPRINT_9_10.md` | Documenta ausencia de base segura para criar Matricula. |

## 7. Componentes Inexistentes

Ainda nao existem:

- `backend/src/domains/enrollments`;
- `Enrollment` entity definitiva;
- `EnrollmentStatus` definitivo;
- `EnrollmentRepository` implementado;
- `EnrollmentRecordApplicationService`;
- `EnrollmentValidator` de dominio;
- `EnrollmentMapper`;
- tabela definitiva de Matricula;
- contrato de persistencia baseado em `studentProfileId`;
- validacao segura de unidade/modalidade/turma/horario/plano no novo dominio;
- politica transacional para criar Pessoa, Perfil, Relacionamento e Matricula
  juntos;
- mecanismo de idempotencia aplicado ao novo fluxo;
- regra definitiva de rematricula/historico.

## 8. Contrato Minimo Para Implementacao Futura

Payload minimo aceito pelo futuro `EnrollmentRecordApplicationService`:

```js
{
  studentPersonId: "person-id",
  studentProfileId: "profile-id",
  enrollmentDate: "YYYY-MM-DD",
  initialStatus: "PENDING",
  enrollmentNumber: null,
  unitIds: [],
  modalityIds: [],
  classIds: [],
  scheduleIds: [],
  planId: null,
  responsibleRelationshipId: null,
  origin: "CREATE_ENROLLMENT",
  metadata: {}
}
```

Saida minima esperada:

```js
{
  id: "enrollment-id",
  enrollmentNumber: "202600123",
  studentPersonId: "person-id",
  studentProfileId: "profile-id",
  status: "PENDING",
  enrollmentDate: "YYYY-MM-DD"
}
```

Invariantes minimas:

- `studentPersonId` e obrigatorio.
- `studentProfileId` e obrigatorio.
- `studentProfileId` deve apontar para perfil `aluno`.
- `studentProfileId` deve pertencer ao mesmo `studentPersonId`.
- `enrollmentDate` e obrigatoria e deve ser ISO `YYYY-MM-DD`.
- `initialStatus` deve pertencer ao enum aprovado.
- `enrollmentNumber`, quando informado, deve estar disponivel.
- `enrollmentNumber`, quando omitido, deve ser gerado de forma concorrente e
  idempotente.
- Matricula ativa de menor deve ter responsavel legal ativo.
- Matricula com plano/cobranca deve ter responsavel financeiro resolvido quando
  exigido.
- IDs de unidade/modalidade/turma/horario/plano enviados devem existir e estar
  ativos.
- Nenhuma regra pode usar `aluno.id` legado como identidade primaria.

## 9. Riscos Arquiteturais

| Risco | Impacto | Mitigacao |
| --- | --- | --- |
| Confundir `j12_alunos` com Matricula definitiva | Duplica dados e mantem dependencia de `aluno.id` legado. | Criar dominio `enrollments` proprio. |
| Usar `j12_matriculas_publicas` como Matricula | Mistura protocolo publico com jornada operacional. | Tratar como origem/snapshot, nao Aggregate. |
| Reutilizar `pre_matriculas` como Matricula | Confunde solicitacao inicial com matricula ativa. | Manter Pre-Matricula isolada. |
| Gerar numero sem idempotencia | Pode duplicar ou perder numero em timeout. | Definir reserva transacional e chave idempotente. |
| Ativar matricula sem responsavel legal | Risco operacional e juridico para menor. | Validar relacionamento antes de `ACTIVE`. |
| Ativar matricula com plano invalido | Cobranca incorreta. | Validar plano ativo antes de ativar. |
| Duplicar status entre legado e dominio novo | Estados ambiguos. | Aprovar `EnrollmentStatus` canonico e mapeamentos. |
| Persistir snapshots como verdade | Divergencia entre Pessoa, Perfil e Matricula. | Usar snapshots apenas para migracao/auditoria. |

## 10. Fora De Escopo Nesta Sprint

Nao foi implementado:

- Repository;
- Prisma;
- SQL;
- migration;
- banco;
- EventBus;
- endpoints;
- controllers;
- rotas;
- APIs;
- frontend;
- Matricula persistida;
- contrato;
- financeiro.

## Auditoria

Buscas executadas nesta sprint localizaram referencias a:

- `Enrollment`;
- `EnrollmentRepository`;
- `EnrollmentModel`;
- `EnrollmentService`;
- `EnrollmentUseCase`;
- `EnrollmentEntity`;
- `EnrollmentStatus`;
- `Matricula`;
- `Student`;
- `Turma`;
- `Plano`;
- `Contrato`.

Resultado:

- nao existe Aggregate Root `Enrollment` implementado;
- nao existe repository definitivo de Matricula;
- nao existe modelo de dominio consolidado de Matricula;
- existem apenas contratos, interfaces, docs futuras, Pre-Matricula isolada e
  legado operacional;
- nenhuma funcionalidade existente foi modificada;
- nenhum JS foi alterado nesta sprint, portanto `node --check` nao foi
  necessario;
- `npm run build` executado com sucesso.
