# Sprint 27.17I — Exportação do histórico operacional CRM

## Escopo

A exportação lê exclusivamente o histórico persistido em `crm_lead_enrollment_conversions`, filtrando conversões concluídas. O formato entregue é CSV UTF-8 com BOM; XLSX permanece fora do escopo para evitar nova dependência e uma segunda implementação de exportação.

Endpoints protegidos:

- `GET /internal/crm/conversions/export`
- `GET /api/internal/crm/conversions/export`

Filtros aceitos: `leadId`, `unitId`, `convertedBy`, `enrollmentStatus`, `dateFrom` e `dateTo`. Paginação/cursor não fazem parte do contrato. O limite rígido é 5.000 registros; o repositório usa páginas internas de até 100 registros e keyset por `converted_at`/`id`, sem carregar PII, payload, metadata ou chaves de idempotência.

As colunas são fixas: `conversionId`, `leadId`, `unitId`, `personId`, `personProfileId`, `enrollmentId`, `enrollmentStatus`, `status`, `convertedBy` e `convertedAt`. O CSV usa CRLF, quoting seguro, neutralização de fórmulas (`=`, `+`, `-`, `@`) e escapes literais para quebras de linha/tabulação.

O middleware mantém `requireAuth`, `ensureCrmInternalAccess` e o rate limiter global existente. Auditoria estruturada registra somente evento, usuário, correlação, formato, quantidade, duração, resultado, origem e código de erro, nos eventos `CRM_CONVERSION_HISTORY_EXPORT_SUCCEEDED` e `CRM_CONVERSION_HISTORY_EXPORT_FAILED`.

Na interface `/admin/crm/conversions`, o botão “Exportar histórico” reutiliza os filtros atuais, impede cliques duplicados, baixa um Blob e revoga a URL temporária. Não há persistência local nem alteração da consulta paginada.

## Limitações e riscos

Não há migration, schema, execução MySQL externa ou índice novo nesta sprint. A ordenação usa a estrutura existente; grandes volumes próximos ao limite podem exigir índice futuro em `(status, converted_at, id)`. XLSX, frontend fora da tela de histórico, listagens/detalhes adicionais e as sprints MySQL suspensas continuam fora do escopo.

## Validação

Foram adicionados testes unitários do serviço/CSV/repositório, controlador e rotas, com boundaries fake por DI e sem conexão externa. Os gates de projeto devem ser executados com os comandos padrão de testes CRM, frontend, typecheck, build, ESLint/Prettier, secret scan e `git diff --check`.
