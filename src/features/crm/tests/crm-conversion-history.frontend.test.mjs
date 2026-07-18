import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("conversion history API uses only supported filters and cursor pagination", () => {
  const api = read("api/crm-conversion-history.api.ts");
  const hooks = read("hooks/use-crm-conversion-history.ts");

  assert.match(api, /api\.get<CrmConversionHistoryPage>/);
  assert.match(api, /\/internal\/crm\/conversions/);
  for (const filter of [
    "cursor",
    "limit",
    "leadId",
    "unitId",
    "convertedBy",
    "enrollmentStatus",
    "dateFrom",
    "dateTo",
  ]) {
    assert.match(api, new RegExp(`params\\.set\\("${filter}"`));
  }
  for (const unsupported of ["resolution", "reused", "search", "totalCount", "offset"]) {
    assert.doesNotMatch(api, new RegExp(`params\\.set\\("${unsupported}"`, "i"));
  }
  assert.match(hooks, /useInfiniteQuery/);
  assert.match(hooks, /getNextPageParam/);
});

test("history route is protected and exposed in CRM navigation", () => {
  const route = read("../../routes/admin/crm.conversions.tsx");
  const page = read("pages/CrmConversionHistoryPage.tsx");
  const sidebar = read("../../components/AppSidebar.tsx");

  assert.match(route, /createFileRoute\("\/admin\/crm\/conversions"\)/);
  assert.match(page, /ProtectedRoute roles=\{\["admin", "coordenador"\]\}/);
  assert.match(sidebar, /to: "\/admin\/crm\/conversions"/);
  assert.match(sidebar, /Histórico CRM/);
});

test("history list has loading, empty, error, item, filters and load-more states", () => {
  const page = read("pages/CrmConversionHistoryPage.tsx");

  assert.match(page, /SkeletonTable/);
  assert.match(page, /Nenhuma conversão concluída/);
  assert.match(page, /Não foi possível carregar o histórico/);
  assert.match(page, /Carregar mais/);
  assert.match(page, /Lead ID/);
  assert.match(page, /Data inicial/);
  assert.match(page, /Data final/);
  assert.match(page, /enrollmentStatus/);
  assert.match(page, /DRAFT/);
  assert.match(page, /hidden overflow-x-auto md:block/);
  assert.match(page, /md:hidden/);
  assert.match(page, /<caption className="sr-only">/);
});

test("history detail shows operational IDs, unavailable resolutions and the external-log notice", () => {
  const dialog = read("components/CrmConversionHistoryDetailsDialog.tsx");

  assert.match(dialog, /useCrmConversionHistoryDetail/);
  assert.match(dialog, /Pessoa/);
  assert.match(dialog, /Perfil de aluno/);
  assert.match(dialog, /Matrícula/);
  assert.match(dialog, /Não persistido/);
  assert.match(dialog, /Resoluções e reutilização/);
  assert.match(
    dialog,
    /Este histórico apresenta conversões concluídas\. Tentativas e falhas são registradas\s+apenas na infraestrutura externa de logs\./,
  );
  assert.doesNotMatch(dialog, /dangerouslySetInnerHTML|localStorage|sessionStorage/);
});

test("history contracts contain no PII, idempotency, SQL or stack fields", () => {
  const types = read("types/crm-conversion-history.types.ts");
  const api = read("api/crm-conversion-history.api.ts");
  const page = read("pages/CrmConversionHistoryPage.tsx");
  const dialog = read("components/CrmConversionHistoryDetailsDialog.tsx");
  const source = types + api + page + dialog;

  assert.doesNotMatch(
    source,
    /\bcpf\b|contactEmail|contactPhone|dataNascimento|idempotencyKey|metadata_json|error\.stack|error\.sql/i,
  );
});

test("successful conversion invalidates Lead list/detail and conversion history", () => {
  const hooks = read("hooks/use-crm-leads.ts");
  const keys = read("query/crm-conversion-history.query-keys.ts");

  assert.match(keys, /crmConversionHistory/);
  assert.match(keys, /crmConversionHistoryDetail/);
  assert.match(hooks, /crmLeadQueryKeys\.all/);
  assert.match(hooks, /crmLeadQueryKeys\.detail\(variables\.leadId\)/);
  assert.match(hooks, /crmConversionHistoryQueryKeys\.all/);
});
