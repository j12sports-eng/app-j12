# Sprint 10.1 - Baseline Arquitetural do Modulo de Matriculas

## Objetivo

Realizar uma auditoria tecnica do modulo de Matriculas e consolidar o baseline
oficial da Fase 10, diferenciando funcionalidades implementadas, parcialmente
implementadas, somente documentadas e nao implementadas.

Esta sprint foi executada apenas com documentacao e auditoria. Nao houve
alteracao de regra de negocio, frontend, mobile, banco, migrations, APIs,
controllers, services ou repositories.

## Arquivos criados

```text
docs/BACKEND/SPRINT_10_1.md
docs/BACKEND/ENROLLMENTS_ARCHITECTURE_BASELINE.md
docs/BACKEND/ENROLLMENTS_ROADMAP_PHASE_10.md
```

## Fontes revisadas

Foram revisados:

```text
backend/src/domains/enrollments
backend/src/server.js
backend/src/database/migrations/*enrollment*
backend/src/domains/pessoas/application
docs/BACKEND/SPRINT_9_23.md ate docs/BACKEND/SPRINT_9_60.md quando existentes
docs/FRONTEND/SPRINT_9_55.md
docs/BACKEND/ENROLLMENTS_PRODUCTION_CHECKLIST.md
```

Observacao:

```text
A Sprint 9.55 tem documento em docs/FRONTEND/SPRINT_9_55.md, pois o escopo foi
frontend administrativo. O baseline considerou esse documento na linha do tempo.
Nao foi encontrado docs/BACKEND/SPRINT_9_39.md; a lacuna foi documentada no
baseline e o estado real foi inferido pelo codigo atual e sprints vizinhas.
```

## Arquitetura revisada

Camadas mapeadas:

```text
domain: entities, enums, factories
application: facades, services, contracts, events, tests
infrastructure: MySqlEnrollmentRepository
presentation: controllers e routes
database: migrations MySQL
frontend: tela admin inicial de Matriculas
```

Diagrama textual oficial:

```text
HTTP routes -> auth/access -> controllers -> EnrollmentFacade
EnrollmentFacade -> application services/contracts/events
application services -> MySqlEnrollmentRepository
repository -> MySQL enrollments
Pessoas -> facade/orchestration -> Matriculas
```

## Fluxos auditados

Status consolidado:

```text
Criacao DRAFT: IMPLEMENTADA
Persistencia DRAFT: IMPLEMENTADA
Reuso idempotente de DRAFT: IMPLEMENTADA
Leitura DRAFT: IMPLEMENTADA
Leitura ACTIVE: IMPLEMENTADA
Status summary: IMPLEMENTADA
Constraint fisica de DRAFT: IMPLEMENTADA
Confirmacao DRAFT -> ACTIVE: IMPLEMENTADA
Auditoria minima de confirmacao: IMPLEMENTADA
Eventos internos: IMPLEMENTADA
Pessoas -> Matriculas: PARCIALMENTE IMPLEMENTADA
API interna: PARCIALMENTE IMPLEMENTADA
API public boundary: PARCIALMENTE IMPLEMENTADA
Frontend administrativo: PARCIALMENTE IMPLEMENTADA
Mobile/app: SOMENTE DOCUMENTADA
Dashboard: SOMENTE DOCUMENTADA
Auditoria completa: SOMENTE DOCUMENTADA
```

## Integracoes auditadas

```text
Pessoas: PARCIALMENTE IMPLEMENTADA
Turmas: SOMENTE DOCUMENTADA
Financeiro: SOMENTE DOCUMENTADA
Agenda: SOMENTE DOCUMENTADA
Notificacoes: SOMENTE DOCUMENTADA
Frontend: PARCIALMENTE IMPLEMENTADA
Mobile: SOMENTE DOCUMENTADA
Dashboard: SOMENTE DOCUMENTADA
Auditoria: SOMENTE DOCUMENTADA
```

Leitura:

```text
O nucleo de Matriculas esta funcional para DRAFT, leitura, idempotencia,
constraint fisica, confirmacao e endpoints administrativos protegidos. As
integracoes com Turmas, Financeiro, Agenda, Notificacoes, Mobile, Dashboard e
Auditoria completa permanecem como contratos preparatorios sem side effects.
```

## Banco revisado

Estado:

```text
MySQL/InnoDB
tabela enrollments
FKs para people e person_profiles
indices basicos por pessoa, perfil, status, deleted_at e student/status
generated columns para DRAFT ativo
unique index ux_enrollments_active_draft_student_profile
confirmed_at e confirmed_by para auditoria minima
```

Nenhuma migration foi criada ou alterada nesta sprint.

## Seguranca revisada

Validado:

```text
rotas admin protegidas por requireAuth + canManageSystem
rotas public boundary tambem protegidas por requireAuth + canManageSystem
router interno preparado e nao montado
controllers delegam para facade
repository encapsula SQL
criacao DRAFT tem lock logico e constraint fisica
```

Riscos documentados:

```text
confirmedBy pode vir do body; preferir usuario autenticado como fonte primaria
confirmacao concorrente nao tem lock especifico
API public boundary tem nomenclatura ambigua por ser protegida como admin
auditoria completa persistente ainda nao existe
```

## Dividas tecnicas identificadas

```text
arquivos do dominio/documentos aparecem como untracked no git local
surfaces admin/public/internal possuem padroes parecidos e podem ser consolidadas
router interno nao esta montado
contrato de dashboard possui metadado de indice divergente do indice real atual
nao ha unit_id/tenant_id em enrollments
nao ha indice dedicado em confirmed_at
nao ha tabelas reais de link para Turmas/Financeiro/Agenda/Notificacoes
nao ha rota mobile real
nao ha auditoria persistente completa
```

## Roadmap criado

Foi criado:

```text
docs/BACKEND/ENROLLMENTS_ROADMAP_PHASE_10.md
```

Objetivo do roadmap:

```text
orientar a Sprint 10.2 com prioridades tecnicas antes de expandir integracoes
reais, dashboard operacional ou mobile.
```

## Validacoes executadas

```text
node --check backend/src/domains/enrollments/application/facades/enrollment.facade.js
node --check backend/src/domains/enrollments/application/services/enrollment-application.service.js
node --check backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment.repository.js
node --check backend/src/domains/enrollments/presentation/controllers/enrollment-admin.controller.js
node --check sprint-10-1-baseline-smoke.tmp.cjs
node sprint-10-1-baseline-smoke.tmp.cjs
node --test backend/src/domains/enrollments/application/tests/*.test.js
cmd /c npm run build
```

## Smoke

```text
ARCHITECTURE_BASELINE_CREATED=true
ALL_SPRINTS_REVIEWED=true
DOMAIN_STATUS_DOCUMENTED=true
IMPLEMENTED_FEATURES_IDENTIFIED=true
PLANNED_FEATURES_IDENTIFIED=true
TECHNICAL_DEBT_IDENTIFIED=true
NO_BUSINESS_RULE_CHANGED=true
NO_DATABASE_CHANGE=true
NO_PUBLIC_API_CHANGE=true
```

## Nao alterado

```text
frontend
mobile
financeiro
turmas
agenda
notificacoes
legado
banco
migrations
regras de negocio
controllers
routes
services
repositories
```

## Resultado

```text
ARCHITECTURE_BASELINE_CREATED=true
ALL_SPRINTS_REVIEWED=true
DOMAIN_STATUS_DOCUMENTED=true
IMPLEMENTED_FEATURES_IDENTIFIED=true
PLANNED_FEATURES_IDENTIFIED=true
TECHNICAL_DEBT_IDENTIFIED=true
NO_BUSINESS_RULE_CHANGED=true
NO_DATABASE_CHANGE=true
NO_PUBLIC_API_CHANGE=true
```
