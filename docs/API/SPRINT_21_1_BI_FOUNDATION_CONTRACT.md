# Contrato HTTP - Fundacao de BI 21.1

## Endpoint

```http
GET /api/admin/bi/foundation
Authorization: Bearer <token administrativo>
```

Alias interno montado pelo backend:

```http
GET /admin/bi/foundation
```

O endpoint e somente leitura e nao consulta tabelas nem produz metricas.

## Autenticacao e autorizacao

- sem autenticacao: HTTP 401 pelo middleware `requireAuth`;
- autenticado sem `canManageSystem`: HTTP 403;
- administrador autorizado: HTTP 200.

## Query parameters

| Campo | Obrigatorio | Formato | Observacao |
| --- | --- | --- | --- |
| `period` | nao | enum | padrao `CURRENT_MONTH` |
| `startDate` | para `CUSTOM` | `YYYY-MM-DD` | limite inicial inclusivo |
| `endDate` | para `CUSTOM` | `YYYY-MM-DD` | limite final inclusivo |
| `unitId` | nao | string ate 64 | apenas filtro preparado; nao dispara metrica |

Periodos aceitos: `TODAY`, `LAST_7_DAYS`, `LAST_30_DAYS`, `CURRENT_MONTH`, `PREVIOUS_MONTH`, `CURRENT_QUARTER`, `CURRENT_YEAR` e `CUSTOM`.

Toda resolucao temporal usa `America/Sao_Paulo`.

## Exemplo

```http
GET /api/admin/bi/foundation?period=CUSTOM&startDate=2026-07-01&endDate=2026-07-10&unitId=unit-1
```

Resposta HTTP 200:

```json
{
  "success": true,
  "data": {
    "capabilities": {
      "foundation": true,
      "metrics": false,
      "reports": false
    },
    "contractVersion": "21.1",
    "filters": {
      "applied": {
        "endDate": "2026-07-10",
        "inclusive": {
          "endDate": true,
          "startDate": true
        },
        "period": "CUSTOM",
        "startDate": "2026-07-01",
        "timezone": "America/Sao_Paulo",
        "unitId": "unit-1"
      },
      "supported": ["period", "startDate", "endDate", "unitId"]
    },
    "readOnly": true,
    "repository": {
      "available": false,
      "reason": "NO_CANONICAL_AGGREGATE_REPOSITORY"
    },
    "supportedPeriods": [
      "TODAY",
      "LAST_7_DAYS",
      "LAST_30_DAYS",
      "CURRENT_MONTH",
      "PREVIOUS_MONTH",
      "CURRENT_QUARTER",
      "CURRENT_YEAR",
      "CUSTOM"
    ],
    "timezone": "America/Sao_Paulo"
  }
}
```

## Erro de filtro

Resposta HTTP 400:

```json
{
  "success": false,
  "code": "BI_PERIOD_INVALID",
  "error": "Filtros de BI invalidos.",
  "details": {
    "field": "dateRange"
  }
}
```

Codigos controlados:

- `BI_PERIOD_INVALID`;
- `BI_FILTER_INVALID`.

Erros inesperados seguem o middleware global e nao expõem detalhes internos.

## Consumo frontend

```ts
const query = useBiFoundation({ period: "CURRENT_MONTH", unitId: "unit-1" });
```

O hook utiliza o cliente HTTP unico do projeto e TanStack Query. Nao existe pagina ou rota de produto na Sprint 21.1.

## Limites atuais

- nenhum KPI;
- nenhuma metrica;
- nenhum relatorio exportavel;
- nenhum repository agregado;
- nenhuma consulta direta a tabelas de outros dominios;
- nenhum dado ficticio.
