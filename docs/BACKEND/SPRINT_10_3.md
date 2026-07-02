# Sprint 10.3 - Base Estrutural Segura para Vinculo Matricula <-> Turma

## Objetivo

Criar a infraestrutura persistente para permitir o vinculo real entre uma
Matricula `ACTIVE` e uma Turma, sem implementar movimentacao operacional de
aluno, sem criar endpoint novo e sem acionar Financeiro, Agenda ou
Notificacoes.

## Resultado

Migration criada e aplicada:

```text
backend/src/database/migrations/20260701103000_add_enrollment_class_links_table.js
```

Tabela final validada:

```text
enrollment_class_links
```

Repositorio criado:

```text
backend/src/domains/enrollments/application/repositories/enrollment-class-link.repository.js
backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment-class-link.repository.js
```

## Schema encontrado antes da implementacao

Tabela real de Turmas:

```text
j12_turmas
```

Chave primaria real:

```text
j12_turmas.id INT(11)
```

Observacao:

```text
O codigo de bootstrap descreve j12_turmas.id como BIGINT em alguns pontos, mas
o banco real auditado em 2026-07-01 retornou INT(11). A migration usa o tipo
real encontrado para manter FK compativel com MySQL/Percona.
```

Engine e charset:

```text
j12_turmas: InnoDB, utf8_unicode_ci
enrollments: InnoDB, utf8mb4_unicode_ci
enrollment_class_links: InnoDB, utf8mb4_unicode_ci
```

Foreign keys existentes no vinculo apos migration:

```text
fk_enrollment_class_links_enrollment
  enrollment_class_links.enrollment_id -> enrollments.id

fk_enrollment_class_links_class
  enrollment_class_links.class_id -> j12_turmas.id
```

Relacionamento atual Pessoas/Turmas:

```text
nao existe ponte segura direta entre people/person_profiles e j12_alunos
j12_alunos.turma_id e j12_alunos.turma_principal continuam legados
person_profiles permanece separado de j12_alunos
```

## Estrutura criada

Colunas finais:

```text
id VARCHAR(64) PRIMARY KEY
enrollment_id VARCHAR(64) NOT NULL
class_id INT(11) NOT NULL
status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
linked_at DATETIME NULL
linked_by VARCHAR(191) NULL
unlinked_at DATETIME NULL
unlinked_by VARCHAR(191) NULL
created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
origin VARCHAR(50) NOT NULL DEFAULT 'MANUAL'
metadata_json LONGTEXT NULL
```

Observacao operacional:

```text
A tabela enrollment_class_links ja existia vazia no banco real, com FKs e
indices principais. A migration da Sprint 10.3 completou as colunas origin e
metadata_json, validou a estrutura, executou rollback seguro e recriou a tabela
sem dados.
```

## Indices

Indices validados:

```text
idx_enrollment_class_links_enrollment_id(enrollment_id)
idx_enrollment_class_links_class_id(class_id)
idx_enrollment_class_links_status(status)
ux_enrollment_class_links_active(enrollment_id, class_id, status)
```

## Estrategia de idempotencia

Decisao aplicada:

```text
UNIQUE INDEX ux_enrollment_class_links_active(enrollment_id, class_id, status)
```

Garantia:

```text
duas chamadas para a mesma Matricula + mesma Turma + status ACTIVE nao criam
dois vinculos ativos.
```

Diferenca em relacao ao desenho conceitual:

```text
Nao foram usadas generated columns nesta sprint porque o banco real ja possuia
uma unique key equivalente por status. A estrategia e compativel com
MySQL/Percona 5.7 e preserva o schema real encontrado.
```

Limitacao:

```text
A unique key por status tambem restringe multiplos historicos com o mesmo
status para o mesmo enrollment/class. Como a Sprint 10.3 nao implementa
movimentacao operacional nem historico completo, essa restricao e aceitavel
para bloquear duplicidade de ACTIVE agora. Se a Sprint 10.4 exigir historico
detalhado de varias entradas/saidas, avaliar generated columns ou status
historico especifico.
```

## Repositorio

Contrato:

```text
EnrollmentClassLinkRepository
```

Adapter:

```text
MySqlEnrollmentClassLinkRepository
```

Metodos:

```text
createActiveLinkIfNotExists()
findById()
findActiveByEnrollmentAndClass()
unlinkActiveLink()
```

Garantias do adapter:

```text
toca somente enrollment_class_links
nao atualiza j12_turmas
nao atualiza j12_alunos
nao cria financeiro
nao cria agenda
nao envia notificacoes
reaproveita vinculo ativo existente em ER_DUP_ENTRY do indice unico
```

## Rollback

Comando:

```bash
node backend/src/database/migrations/20260701103000_add_enrollment_class_links_table.js down
```

Protecao:

```text
o down recusa remover enrollment_class_links se rowCount > 0
```

Rollback validado:

```text
rowCount antes do rollback: 0
down executado com sucesso
up reaplicado com sucesso
status final rowCount=0
```

## Smoke test

Executado:

```text
node backend/src/database/migrations/20260701103000_add_enrollment_class_links_table.js status
node backend/src/database/migrations/20260701103000_add_enrollment_class_links_table.js up
node backend/src/database/migrations/20260701103000_add_enrollment_class_links_table.js down
node backend/src/database/migrations/20260701103000_add_enrollment_class_links_table.js up
node backend/src/database/migrations/20260701103000_add_enrollment_class_links_table.js status
```

Resultado:

```text
ENROLLMENT_CLASS_LINK_TABLE_CREATED=true
FOREIGN_KEYS_CREATED=true
INDEXES_CREATED=true
UNIQUE_STRATEGY_DEFINED=true
ROLLBACK_VALIDATED=true
NO_DATA_LOSS=true
OFFICIAL_FLOW_STILL_WORKING=true
NO_TEST_DATA_LEFT=true
```

## Validacoes executadas

```text
node --check backend/src/database/migrations/20260701103000_add_enrollment_class_links_table.js
node --check backend/src/domains/enrollments/application/repositories/enrollment-class-link.repository.js
node --check backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment-class-link.repository.js
node --check backend/src/domains/enrollments/application/tests/enrollment-class-link.repository.test.js
node --check backend/src/domains/enrollments/application/repositories/index.js
node --check backend/src/domains/enrollments/index.js
node --test backend/src/domains/enrollments/application/tests/*.test.js
cmd /c npm run build
```

## Nao alterado

```text
frontend
mobile
financeiro
agenda
notificacoes
controllers
APIs publicas
rotas
confirmacao de Matriculas
regras DRAFT/ACTIVE
movimentacao de aluno em Turmas
```

## Riscos e limites

```text
Turmas ainda nao possui dominio backend em camadas.
Nao existe ponte segura entre person_profiles e j12_alunos.
Nao ha controle transacional de capacidade/vagas nesta sprint.
O vinculo real ainda nao deve atualizar j12_turmas ou j12_alunos.
```

## Proximos passos para Sprint 10.4

```text
1. ligar EnrollmentClassLinkService ao MySqlEnrollmentClassLinkRepository por injecao controlada
2. validar Enrollment ACTIVE antes de persistir vinculo
3. validar Turma ativa por reader dedicado
4. implementar check transacional de capacidade/vaga
5. publicar EnrollmentClassLinked somente apos persistencia
6. adicionar auditoria CLASS_LINK_CREATED quando a auditoria persistente existir
7. manter Financeiro, Agenda e Notificacoes sem side effects ate sprints proprias
```
