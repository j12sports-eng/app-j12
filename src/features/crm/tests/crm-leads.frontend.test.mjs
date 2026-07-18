import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("CRM APIs preserve list, detail and conversion contracts", () => {
  const api = read("api/crm-leads.api.ts");
  const types = read("types/crm-lead.types.ts");
  const payloadType =
    types.match(/export type CrmLeadDraftEnrollmentPayload = \{([\s\S]*?)\n\};/)?.[1] || "";

  assert.match(api, /api\.get<CrmLeadPage>\(`\/internal\/crm\/leads/);
  assert.match(api, /api\.get<CrmLeadDetail>/);
  assert.match(api, /api\.post<CrmLeadConversionResult>/);
  assert.match(api, /draft-enrollment/);
  assert.match(payloadType, /studentData/);
  assert.match(payloadType, /enrollmentData/);
  assert.match(payloadType, /idempotencyKey\?/);
  assert.doesNotMatch(
    payloadType,
    /unitId|userId|studentId|personProfileId|enrollmentId|stage|status/,
  );
});

test("CRM list uses safe filters, cursor pagination and complete UX states", () => {
  const api = read("api/crm-leads.api.ts");
  const hooks = read("hooks/use-crm-leads.ts");
  const page = read("pages/CrmLeadsPage.tsx");

  for (const filter of ["cursor", "limit", "stage", "status", "conversionStatus", "unitId"]) {
    assert.match(api, new RegExp(`params\\.set\\("${filter}"`));
  }
  assert.match(hooks, /useInfiniteQuery/);
  assert.match(hooks, /getNextPageParam/);
  assert.match(page, /SkeletonTable/);
  assert.match(page, /Nenhum Lead encontrado/);
  assert.match(page, /Carregar mais/);
  assert.match(page, /studentCompleted/);
  assert.match(page, /enrollmentCompleted/);
  assert.doesNotMatch(api + page, /totalCount|searchText|localStorage/);
});

test("CRM details label commercial contact, eligibility and conversion state", () => {
  const dialog = read("components/CrmLeadConversionDialogs.tsx");

  assert.match(dialog, /useCrmLead\(leadId\)/);
  assert.match(dialog, /Contato comercial/);
  assert.match(dialog, /canConvertToDraftEnrollment/);
  assert.match(dialog, /reasonMessage/);
  assert.match(dialog, /CRM_LEAD_NOT_WON/);
  assert.match(dialog, /lead\.conversions\.student/);
  assert.match(dialog, /lead\.conversions\.enrollment/);
  assert.doesNotMatch(dialog, /lead\.contact\.cpf/);
});

test("conversion preview is explicit, idempotent and never auto-copies commercial data", () => {
  const dialog = read("components/CrmLeadConversionDialogs.tsx");

  assert.match(dialog, /studentData/);
  assert.match(dialog, /enrollmentData: \{ startDate \}/);
  assert.match(dialog, /createIdempotencyKey/);
  assert.match(dialog, /crypto\?\.randomUUID/);
  assert.match(dialog, /n\u00e3o ser\u00e3o\s+copiados automaticamente/i);
  assert.match(dialog, /Confirmar convers\u00e3o/);
  assert.match(dialog, /mutation\.isPending/);
  assert.match(dialog, /validateForm/);
  assert.match(dialog, /isValidIsoDate/);
  assert.match(dialog, /DRAFT/);
  assert.match(dialog, /nenhuma cobran\u00e7a/i);
  assert.doesNotMatch(
    dialog,
    /contact\.nome.*setNome|contact\.email.*setEmail|contact\.telefone.*setTelefone/,
  );
  assert.doesNotMatch(
    dialog,
    /localStorage|sessionStorage|console\.(log|info|debug)|dangerouslySetInnerHTML/,
  );
});

test("conversion success summarizes real resolutions and invalidates CRM queries", () => {
  const dialog = read("components/CrmLeadConversionDialogs.tsx");
  const hooks = read("hooks/use-crm-leads.ts");

  assert.match(dialog, /Convers\u00e3o conclu\u00edda\./);
  assert.match(dialog, /result\.resolutions\.person/);
  assert.match(dialog, /result\.resolutions\.profile/);
  assert.match(dialog, /result\.resolutions\.enrollment/);
  assert.match(dialog, /result\.enrollmentStatus/);
  assert.match(hooks, /crmLeadQueryKeys\.all/);
  assert.match(hooks, /crmLeadQueryKeys\.detail\(variables\.leadId\)/);
  assert.match(hooks, /invalidateQueries/);
});

test("conversion errors are mapped to sanitized messages", () => {
  const dialog = read("components/CrmLeadConversionDialogs.tsx");
  for (const code of [
    "CRM_INPUT_INVALID",
    "CRM_LEAD_NOT_FOUND",
    "CRM_LEAD_NOT_CONVERTIBLE",
    "CRM_LEAD_UNIT_CONTEXT_UNAVAILABLE",
    "CRM_LEAD_UNIT_CONTEXT_FAILED",
    "CRM_ACCESS_DENIED",
    "PERSON_IDENTITY_CONFLICT",
    "STUDENT_PROFILE_CONFLICT",
    "ENROLLMENT_ACTIVE_EXISTS",
    "ENROLLMENT_STATE_CONFLICT",
    "DATABASE_UNAVAILABLE",
  ]) {
    assert.match(dialog, new RegExp(code));
  }
  assert.match(dialog, /N\u00e3o foi poss\u00edvel concluir a convers\u00e3o\./);
  assert.doesNotMatch(dialog, /error\.stack|error\.sql|JSON\.stringify\(error/);
});

test("CRM route and menu are protected for administrators and coordinators", () => {
  const route = read("../../routes/admin/crm.leads.tsx");
  const page = read("pages/CrmLeadsPage.tsx");
  const sidebar = read("../../components/AppSidebar.tsx");
  const routeTree = read("../../routeTree.gen.ts");

  assert.match(route, /createFileRoute\("\/admin\/crm\/leads"\)/);
  assert.match(page, /ProtectedRoute roles=\{\["admin", "coordenador"\]\}/);
  assert.match(sidebar, /to: "\/admin\/crm\/leads"/);
  assert.match(sidebar, /label: "Leads CRM"/);
  assert.match(routeTree, /\/admin\/crm\/leads/);
});
