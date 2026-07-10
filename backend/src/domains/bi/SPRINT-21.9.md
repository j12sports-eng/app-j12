# Sprint 21.9 - Relatorios exportaveis

Base: `6e95bef`. Endpoint protegido: `GET /api/admin/bi/exports/:report/:format`, sob os mesmos middlewares `requireAuth` e `canManageSystem` do BI. Tela administrativa: `/admin/bi/relatorios`, para `admin` e `coordenador`.

Relatorios permitidos: `executive`, `financial`, `students`, `classes`, `delinquency`, `courts` e `championships`. Formatos: `csv`, `xlsx` e `pdf`. O servico de exportacao chama diretamente o mesmo service do dashboard, passando `period`, `startDate`, `endDate` e `unitId`; nenhuma formula, KPI, consulta ou fonte paralela e criada. Indisponibilidades dos DTOs sao preservadas.

## Colunas

Os arquivos sao tabulares e derivados do contrato agregado de cada dashboard. Linhas escalares usam `section`, `metric` e `value`. Rankings/evolucoes usam `section` e as chaves agregadas publicas do respectivo DTO. `generatedAt` nao e repetido como linha. Metricas monetarias mantem numeros decimais do DTO e o timezone permanece `America/Sao_Paulo` nos filtros resolvidos.

## Seguranca, privacidade e limites

- maximo de 5.000 linhas logicas por arquivo; excesso retorna HTTP 413 sem truncamento;
- timeout controlado de 15 segundos; expiracao retorna HTTP 504 e o timer e sempre limpo;
- nomes seguem `j12-bi-{report}-{YYYY-MM-DD}.{format}`, somente com valores de allowlist;
- `Content-Disposition` usa apenas report/formato de allowlist e data ISO, impedindo CRLF, header injection e path traversal;
- CSV inclui BOM UTF-8, aspas e escape de acentos, virgulas, aspas e quebras de linha;
- CSV e XLSX prefixam com apostrofo celulas iniciadas por `=`, `+`, `-` ou `@`;
- PDF pagina todas as linhas logicas aprovadas pelo limite, sem corte silencioso;
- o endpoint nao aceita nomes arbitrarios e nao exporta credenciais ou PII alem do contrato agregado ja auditado dos dashboards.

CSV e o formato prioritario, XLSX e OOXML sem nova dependencia pesada e PDF usa o `jspdf` ja instalado. A limitacao real e que o PDF usa as fontes padrao do jsPDF, cuja cobertura de alguns glifos Unicode pode variar; CSV/XLSX preservam UTF-8/Unicode. A Sprint 21.10 nao foi iniciada.
