# Sprint 9.57 - Dashboard Operacional de Matriculas

## Objetivo

Preparar a base interna do dashboard operacional de Matriculas para futuros
indicadores de gestao, sem criar rota, tela, migration, escrita em banco ou
exposicao de dados pessoais.

## Metricas definidas

Contrato preparado:

```js
getEnrollmentOperationalDashboard({
  startDate,
  endDate,
  unitId,
})
```

Metricas previstas:

```text
totalDraft
totalActive
totalConflict
totalConfirmedInPeriod
conversionRate
pendingDrafts
generatedAt
```

Como a consulta real ficou bloqueada, os campos numericos retornam `null` no
contrato preparatorio. Isso evita publicar totais globais incorretos ou sem
escopo de unidade.

## Colunas e tabelas mapeadas

Tabela atual:

```text
enrollments
```

Colunas mapeadas:

```text
id
student_person_id
student_profile_id
status
start_date
end_date
confirmed_at
confirmed_by
created_at
updated_at
deleted_at
```

Status reais do dominio:

```text
ACTIVE
CANCELLED
DRAFT
FINISHED
PENDING
SUSPENDED
```

Colunas de data disponiveis:

```text
created_at
updated_at
confirmed_at
```

Relacao com Pessoa/Perfil:

```text
student_person_id -> people.id
student_profile_id -> person_profiles.id
```

Unidade/tenant:

```text
nao ha unit_id, unidade_id, tenant_id ou branch_id em enrollments
```

Indices observados/documentados:

```text
PRIMARY(id)
idx_enrollments_student_person_id(student_person_id)
idx_enrollments_student_profile_id(student_profile_id)
idx_enrollments_status(status)
idx_enrollments_deleted_at(deleted_at)
idx_enrollments_student_status(student_person_id,status)
ux_enrollments_active_draft_student_profile(student_profile_id,status,deleted_at)
```

## Decisao tecnica

Contrato/documentacao preparatoria.

Nao foi criada consulta agregada real nesta sprint.

Motivos:

```text
o sistema possui conceito de unidades, mas enrollments nao possui coluna de unidade/tenant
retornar agregados globais poderia misturar dados de unidades diferentes
totalConflict hoje e um estado consolidado por guard, nao uma coluna/status persistido
confirmed_at existe por migration manual, mas nao ha indice dedicado para filtros de periodo
nao ha rota ou cache operacional definido para esse dashboard
```

## Contrato criado

Arquivo:

```text
backend/src/domains/enrollments/application/contracts/enrollment-dashboard.contract.js
```

Metodo exposto na facade:

```js
getEnrollmentOperationalDashboard(input)
```

Retorno preparatorio:

```js
{
  totalDraft: null,
  totalActive: null,
  totalConflict: null,
  totalConfirmedInPeriod: null,
  conversionRate: null,
  pendingDrafts: null,
  generatedAt: string,
  prepared: true,
  queryEnabled: false,
  dashboardQueryCreated: false,
  blockedByDataOrPatternGap: true,
  personalDataExposed: false
}
```

## Riscos de performance

```text
confirmed_at nao possui indice dedicado para filtro por periodo
totalConflict precisa ser calculado por aggregate/group by, nao por N+1
sem unit_id em enrollments nao ha como limitar a leitura por unidade
sem cache ou rota dedicada, uma query operacional futura pode concorrer com fluxos transacionais
```

## Filtros obrigatorios futuros

Antes de habilitar query real:

```text
startDate/endDate para metricas de confirmacao e conversao
unitId/tenantId seguro quando o dashboard for multi-unidade
deleted_at IS NULL para matriculas operacionais ativas
status em valores conhecidos do dominio
```

## Smoke tests

Caminho adotado: contrato/documentacao preparatoria.

```text
ENROLLMENT_DASHBOARD_PREPARED=true
DASHBOARD_CONTRACT_DOCUMENTED=true
DASHBOARD_METRICS_MAPPED=true
DASHBOARD_QUERY_BLOCKED_BY_DATA_OR_PATTERN_GAP=true
NO_DASHBOARD_QUERY_CREATED=true
NO_PERSONAL_DATA_EXPOSED=true
OFFICIAL_FLOW_STILL_WORKING=true
NO_TEST_DATA_LEFT=true
```

## Lacunas encontradas

```text
ausencia de unit_id/tenant_id em enrollments
ausencia de indice dedicado para confirmed_at
ausencia de tabela/cache de indicadores operacionais
ausencia de status CONFLICT persistido
ausencia de contrato HTTP administrativo para dashboard operacional
```

## Proximos passos

```text
definir como enrollments sera escopado por unidade/tenant
avaliar indice composto para status/deleted_at/confirmed_at/unidade
definir formula oficial de conversionRate
implementar query agregada unica quando o escopo de unidade estiver seguro
expor rota administrativa somente depois de autenticar/autorizar o escopo
```
