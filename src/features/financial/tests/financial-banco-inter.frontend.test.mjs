import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const featureRoot = path.resolve(__dirname, "..");
const srcRoot = path.resolve(featureRoot, "..", "..");
const routesRoot = path.join(srcRoot, "routes");
const hooksRoot = path.join(srcRoot, "hooks");
const financeComponentsRoot = path.join(srcRoot, "components", "financeiro");

test("financial API keeps admin contracts and avoids frontend Banco Inter secrets", async () => {
  const apiSource = await readFile(path.join(featureRoot, "api", "financial.api.ts"), "utf8");
  const adminHookSource = await readFile(path.join(hooksRoot, "useFinanceiroAdmin.ts"), "utf8");

  assert.match(apiSource, /\/admin\/financial\/enrollments\/\$\{enrollmentId\}\/obligations/);
  assert.match(apiSource, /\/admin\/financial\/students\/\$\{studentPersonId\}/);
  assert.match(apiSource, /\/admin\/financial\/students\/search/);
  assert.match(
    apiSource,
    /\/admin\/financial\/obligations\/\$\{encodeURIComponent\(input\.obligationId\)\}\/mark-paid/,
  );
  assert.match(
    apiSource,
    /\/admin\/financial\/obligations\/\$\{encodeURIComponent\(input\.obligationId\)\}\/cancel/,
  );
  assert.match(
    apiSource,
    /\/admin\/financial\/obligations\/\$\{encodeURIComponent\(input\.obligationId\)\}\/mark-overdue/,
  );

  assert.match(adminHookSource, /api\.post\("\/admin\/financeiro\/inter\/pix"/);
  assert.doesNotMatch(adminHookSource, /\/pix\/create/);
  assert.doesNotMatch(
    adminHookSource + apiSource,
    /INTER_CLIENT_SECRET|INTER_CERT_PATH|INTER_KEY_PATH/,
  );
});

test("financial hooks expose React Query contracts and automatic invalidation", async () => {
  const obligationsHook = await readFile(
    path.join(featureRoot, "hooks", "useEnrollmentFinancialObligations.ts"),
    "utf8",
  );
  const summaryHook = await readFile(
    path.join(featureRoot, "hooks", "useStudentFinancialSummary.ts"),
    "utf8",
  );
  const searchHook = await readFile(
    path.join(featureRoot, "hooks", "useFinancialStudentScopeSearch.ts"),
    "utf8",
  );
  const actionsHook = await readFile(
    path.join(featureRoot, "hooks", "useFinancialObligationActions.ts"),
    "utf8",
  );

  assert.match(obligationsHook, /export const enrollmentFinancialObligationsQueryKey/);
  assert.match(obligationsHook, /useQuery/);
  assert.match(obligationsHook, /enabled: Boolean\(input\.enabled && enrollmentId\)/);
  assert.match(summaryHook, /export const studentFinancialSummaryQueryKey/);
  assert.match(
    summaryHook,
    /enabled: Boolean\(input\.enabled && studentPersonId && studentProfileId\)/,
  );
  assert.match(searchHook, /export const financialStudentScopeSearchQueryKey/);
  assert.match(searchHook, /query\.length >= 2/);
  assert.match(actionsHook, /useMutation/);
  assert.match(actionsHook, /invalidateFinancialAdminQueries/);
  assert.match(actionsHook, /queryClient\.invalidateQueries/);
  assert.match(actionsHook, /enrollmentFinancialObligationsQueryKey/);
  assert.match(actionsHook, /studentFinancialSummaryQueryKey/);
  assert.match(actionsHook, /onSuccess: invalidateFinancialAdminQueries/);
});

test("financial admin route wires the page, route, loading, empty and error states", async () => {
  const adminRouteSource = await readFile(path.join(routesRoot, "admin", "financeiro.tsx"), "utf8");
  const redirectRouteSource = await readFile(path.join(routesRoot, "financeiro.tsx"), "utf8");

  assert.match(adminRouteSource, /createFileRoute\("\/admin\/financeiro"\)/);
  assert.match(adminRouteSource, /<ProtectedRoute roles=\{\["admin", "coordenador"\]\}/);
  assert.match(adminRouteSource, /useFinanceiroAdmin\(\)/);
  assert.match(adminRouteSource, /<FinancialAdminEnrollmentPanel/);
  assert.match(adminRouteSource, /<FinancialMovementModal/);
  assert.match(adminRouteSource, /function LoadingState/);
  assert.match(adminRouteSource, /<SkeletonDashboard/);
  assert.match(adminRouteSource, /\(error \|\| message\)/);
  assert.match(adminRouteSource, /Nenhuma mensalidade encontrada/);
  assert.match(adminRouteSource, /Nenhuma despesa registrada/);
  assert.match(redirectRouteSource, /createFileRoute\("\/financeiro"\)/);
  assert.match(redirectRouteSource, /destination = "\/admin\/financeiro"/);
});

test("financial components cover Pix creation, loading, empty, error and copy states", async () => {
  const movementModalSource = await readFile(
    path.join(financeComponentsRoot, "movement-modal", "FinancialMovementModal.tsx"),
    "utf8",
  );
  const movementFormSource = await readFile(
    path.join(financeComponentsRoot, "movement-modal", "movement-form.ts"),
    "utf8",
  );
  const createChargeModalSource = await readFile(
    path.join(financeComponentsRoot, "create-charge", "CreateChargeModal.tsx"),
    "utf8",
  );
  const chargeSummarySource = await readFile(
    path.join(financeComponentsRoot, "create-charge", "ChargeSummary.tsx"),
    "utf8",
  );
  const chargeFormSource = await readFile(
    path.join(financeComponentsRoot, "create-charge", "charge-form.ts"),
    "utf8",
  );

  assert.match(movementModalSource, /gerarPix: !isEditing && current\.formaPagamento === "pix"/);
  assert.match(movementModalSource, /loadingRefs/);
  assert.match(movementModalSource, /j12-skeleton/);
  assert.match(movementModalSource, /Nenhum aluno encontrado/);
  assert.match(movementModalSource, /FieldError/);
  assert.match(movementModalSource, /formatApiErrorMessage/);
  assert.match(movementFormSource, /value: "pix", label: "PIX"/);

  assert.match(createChargeModalSource, /export function CreateChargeModal/);
  assert.match(createChargeModalSource, /loadingData/);
  assert.match(createChargeModalSource, /j12-skeleton/);
  assert.match(createChargeModalSource, /toast\.error/);
  assert.match(createChargeModalSource, /pixCopiaCola/);
  assert.match(chargeSummarySource, /Copiar PIX/);
  assert.match(chargeSummarySource, /createdSummary\.pixCopiaCola/);
  assert.match(chargeFormSource, /value: "pix", label: "PIX Banco Inter"/);
});

test("financial frontend keeps gateway rules in backend and uses synchronization hooks only", async () => {
  const adminHookSource = await readFile(path.join(hooksRoot, "useFinanceiroAdmin.ts"), "utf8");
  const panelSource = await readFile(
    path.join(featureRoot, "pages", "FinancialAdminEnrollmentPanel.tsx"),
    "utf8",
  );

  assert.match(adminHookSource, /socket\.on\("financeiro:cobranca-atualizada"/);
  assert.match(adminHookSource, /socket\.on\("financeiro:pagamento-atualizado"/);
  assert.match(adminHookSource, /socket\.on\("dashboard:financeiro-atualizado"/);
  assert.match(panelSource, /obligationsQuery\.isFetching/);
  assert.match(panelSource, /summaryQuery\.error/);
  assert.match(panelSource, /scopeSearchQuery\.error/);
  assert.match(panelSource, /Nenhuma obrigacao carregada/);
  assert.match(panelSource, /Nenhum aluno encontrado/);
  assert.doesNotMatch(
    adminHookSource + panelSource,
    /oauth|client_secret|mtls|certificado cliente/i,
  );
});
