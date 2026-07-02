# Sprint 11.2 - Camada Application/Infrastructure do Modulo de Turmas

## Objetivo

Criar a base arquitetural backend do modulo de Turmas, seguindo o padrao em
camadas usado no dominio de Matriculas, sem alterar comportamento operacional,
frontend, API publica, schema ou integracoes.

## Decisao Tecnica

Foi criada uma nova fronteira de dominio em:

```text
backend/src/domains/classes
```

O nome `classes` foi usado porque o dominio de Matriculas ja utiliza o termo
`class` no contrato de vinculo `Enrollment -> Turma`, e a sprint esperava esses
caminhos. A camada nova mapeia a tabela real `j12_turmas`.

Nenhuma rota atual passou a usar essa camada nesta sprint.

## Arquivos Criados

```text
backend/src/domains/classes/index.js
backend/src/domains/classes/application/index.js
backend/src/domains/classes/application/repositories/index.js
backend/src/domains/classes/application/repositories/class.repository.js
backend/src/domains/classes/application/services/index.js
backend/src/domains/classes/application/services/class-application.service.js
backend/src/domains/classes/application/facades/index.js
backend/src/domains/classes/application/facades/class.facade.js
backend/src/domains/classes/infrastructure/index.js
backend/src/domains/classes/infrastructure/repositories/index.js
backend/src/domains/classes/infrastructure/repositories/mysql-class.repository.js
backend/src/domains/classes/application/tests/class-application.service.test.js
backend/src/domains/classes/application/tests/class.facade.test.js
docs/BACKEND/SPRINT_11_2.md
```

## Padrao Arquitetural

Fluxo preparado:

```text
ClassFacade
  -> ClassApplicationService
  -> ClassRepository contract
  -> MySqlClassRepository
  -> MySQL j12_turmas / j12_alunos
```

Responsabilidades:

```text
facade: ponto de entrada futuro para outros modulos
service: valida entrada, normaliza comportamento e prepara DTO de capacidade
repository contract: documenta metodos esperados
mysql repository: executa apenas SELECT parametrizado
```

## Metodos Disponiveis

```js
findClassById({ classId })
findActiveClassById({ classId })
getClassCapacitySummary({ classId })
```

Comportamento:

```text
entrada invalida retorna null nas leituras application-level
classe inexistente retorna null
classe inativa retorna null em findActiveClassById()
resumo de capacidade retorna null quando a turma nao existe
resumo de capacidade documenta capacityConfigured=false quando nao ha capacidade configurada
```

## Repository MySQL

Arquivo:

```text
backend/src/domains/classes/infrastructure/repositories/mysql-class.repository.js
```

Queries:

```text
SELECT_CLASS_BY_ID_SQL
SELECT_CLASS_CAPACITY_SNAPSHOT_SQL
```

Garantias:

```text
somente SELECT
parametro classId usa placeholder ?
nao executa INSERT
nao executa UPDATE
nao executa DELETE
nao executa ALTER/DROP/TRUNCATE
nao altera j12_turmas
nao altera j12_alunos
nao altera enrollment_class_links
```

## Campos Usados

Tabela principal:

```text
j12_turmas
```

Campos mapeados:

```text
id
nome
status
capacidade
modalidade
modalidade_id
unidade
unidade_id
professor_id
professor_nome
dias_semana
dias_semana_json
horario
horario_inicio
horario_fim
created_at
updated_at
```

Relacionamentos lidos:

```text
j12_professores.id -> j12_turmas.professor_id
j12_alunos.turma_id -> j12_turmas.id
j12_alunos.turma_principal -> j12_turmas.nome
```

## Capacidade e Vagas

O schema atual suporta capacidade nominal por:

```text
j12_turmas.capacidade
```

O resumo preparado calcula ocupacao atual por leitura de:

```text
j12_alunos.turma_id OR j12_alunos.turma_principal
```

Retorno preparado:

```js
{
  classId,
  className,
  status,
  active,
  capacity,
  capacityConfigured,
  currentStudentCount,
  availableCapacity,
  full,
  source: {
    capacityField,
    studentCountSource,
  },
}
```

Limite: ainda nao existe reserva transacional de vaga nem regra atomica de
capacidade no dominio de Turmas.

## Testes

Foram criados testes unitarios para:

```text
entrada invalida sem tocar repository
leitura de turma por id
leitura de turma ativa por id
resumo de capacidade com dados suficientes
resumo de capacidade sem capacidade configurada
delegacao da facade
```

## Smoke Test

Marcadores esperados:

```text
CLASS_APPLICATION_LAYER_CREATED=true
CLASS_REPOSITORY_CREATED=true
CLASS_FACADE_CREATED=true
FIND_CLASS_BY_ID_ENABLED=true
FIND_ACTIVE_CLASS_BY_ID_ENABLED=true
CLASS_CAPACITY_SUMMARY_PREPARED=true
CLASS_QUERIES_ARE_READ_ONLY=true
NO_SCHEMA_CHANGE=true
NO_PUBLIC_API_CHANGE=true
OFFICIAL_FLOW_STILL_WORKING=true
```

## Validacoes Executadas

```bash
node --check backend/src/domains/classes/application/repositories/class.repository.js
node --check backend/src/domains/classes/application/services/class-application.service.js
node --check backend/src/domains/classes/application/facades/class.facade.js
node --check backend/src/domains/classes/infrastructure/repositories/mysql-class.repository.js
node --test backend/src/domains/classes/application/tests/*.test.js
node sprint-11-2-classes-smoke.tmp.cjs
cmd /c npm run build
```

## Nao Alterado

```text
frontend
mobile
API publica
schema
migrations
Matriculas
Financeiro
Agenda
Notificacoes
legado
regras atuais de Turmas
```

## Limitacoes

```text
camada nova ainda nao esta conectada ao router legado de Turmas
router atual continua executando SQL direto em backend/src/routes/turmas.routes.js
nao ha transacao de vagas
nao ha lock de capacidade
nao ha tabela canonica j12_turma_alunos validada nesta sprint
nao ha ponte segura person_profiles -> j12_alunos para Matriculas
```

## Proximos Passos para Sprint 11.3

Recomendado:

```text
1. Criar service de capacidade/vagas com contrato transacional.
2. Validar fonte canonica de alunos por turma.
3. Definir se j12_alunos.turma_id, turma_principal ou tabela de vinculo sera a fonte oficial.
4. Preparar adapter para EnrollmentClassLinkService consumir ClassFacade.
5. So depois habilitar integracao real Matricula -> Turma com reserva de vaga.
```
