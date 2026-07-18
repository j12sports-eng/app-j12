# Sprint 27.17E.2 — API interna de consulta de Leads CRM

## Endpoints

Rotas somente leitura, montadas no router interno existente:

- `GET /internal/crm/leads`
- `GET /api/internal/crm/leads`
- `GET /internal/crm/leads/:leadId`
- `GET /api/internal/crm/leads/:leadId`

Todas preservam `requireAuth → ensureCrmInternalAccess → controller`. A política é global para administradores e coordenadores via `canManageSystem`; `unitId` é apenas filtro administrativo e não prova autorização granular.

## Listagem e paginação

Filtros aceitos: `cursor`, `limit`, `stage`, `status`, `conversionStatus` e `unitId`. Campos desconhecidos, arrays, IDs inválidos e limites fora de `1..100` retornam `CRM_INPUT_INVALID`.

O limite padrão é 50. A consulta usa uma única leitura parametrizada, ordenada por `created_at DESC, id DESC`, com cursor opaco versionado baseado em `created_at + id`. O cursor tem tamanho máximo de 256 caracteres e falha com `CRM_CURSOR_INVALID` quando inválido. Não há `OFFSET` nem `totalCount`.

Resposta:

```json
{
  "success": true,
  "data": {
    "items": [],
    "pageInfo": { "nextCursor": null, "hasNextPage": false }
  }
}
```

## Dados e elegibilidade

A listagem retorna somente IDs, unidade, estágio, status, timestamps, elegibilidade e resumo das conversões. O detalhe adiciona exclusivamente o contato comercial (`nome`, `email`, `telefone`) e os IDs/estados necessários ao futuro preview.

A regra de elegibilidade é a mesma da conversão: `stage = WON` e `status = CONVERTED`. Matrícula já convertida retorna `CRM_ENROLLMENT_ALREADY_CONVERTED`; estágio/status incompatíveis retornam `CRM_LEAD_NOT_WON` ou `CRM_LEAD_NOT_CONVERTED`.

As conversões são consolidadas em uma única consulta por `LEFT JOIN`:

- `crm_lead_student_conversions`: status, Pessoa e perfil;
- `crm_lead_enrollment_conversions`: status, Enrollment e `enrollmentStatus`.

Não são retornados `idempotencyKey`, metadata, payload bruto, CPF ou outros dados de aluno.

## Segurança, performance e limites

O controller não importa repository nem decide elegibilidade. O repository não decide autorização e seleciona somente as colunas necessárias. Filtros são parametrizados, não há SQL dinâmico fornecido pelo cliente e não há N+1.

Falhas de infraestrutura retornam `CRM_LEAD_QUERY_FAILED` sem SQL, host, credenciais, stack ou PII. Lead inexistente retorna `CRM_LEAD_NOT_FOUND` somente após autenticação/autorização.

Não houve alteração de frontend, migration ou schema, nem execução de MySQL externo. A API foi preparada para consumo futuro pela Sprint 27.17F sem criar estado local paralelo.
