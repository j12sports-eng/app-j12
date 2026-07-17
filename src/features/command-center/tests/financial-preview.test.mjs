import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  formatPreviewDate,
  isFinancialPreviewEmpty,
  normalizeFinancialPreviewSource,
} from "../preview/financial-preview-normalizer.ts";

const feature = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("normalizes the real financial BI response into the read-only preview contract input", () => {
  const result = normalizeFinancialPreviewSource(sourceContract());

  assert.equal(result.contractVersion, "21.3");
  assert.equal(result.generatedAt, "2026-07-17T12:00:00.000Z");
  assert.equal(result.kpis.receivedRevenue.value, 1500.25);
  assert.equal(result.data.evolution[0].receivedRevenue, 1500.25);
  assert.equal(result.data.breakdowns.categories[0].value, 1500.25);
  assert.deepEqual(result.filters.unit.selectedUnitIds, ["2"]);
  assert.equal(result.source.name, "existing-bi-financial-api");
});

test("normalizes partial responses, invalid numbers and non-array collections safely", () => {
  const result = normalizeFinancialPreviewSource({
    breakdowns: { categories: { invalid: true } },
    evolution: "invalid",
    filters: { current: { period: "INVALID" } },
    generatedAt: "invalid-date",
    insights: { goal: { achievedPercent: Number.NaN } },
    kpis: { receivedRevenue: { available: true, value: Number.POSITIVE_INFINITY } },
  });

  assert.deepEqual(result.data.evolution, []);
  assert.deepEqual(result.data.breakdowns.categories, []);
  assert.equal(result.kpis.receivedRevenue.available, false);
  assert.equal(result.kpis.receivedRevenue.value, null);
  assert.equal(result.kpis.averageTicket.available, false);
  assert.equal(result.filters.period.period, "CURRENT_MONTH");
  assert.equal(JSON.stringify(result).includes("NaN"), false);
  assert.equal(JSON.stringify(result).includes("Infinity"), false);
});

test("defines empty from unavailable KPIs and empty financial collections", () => {
  const empty = normalizeFinancialPreviewSource({});
  const populated = normalizeFinancialPreviewSource(sourceContract());

  assert.equal(isFinancialPreviewEmpty({ data: empty.data, kpis: empty.kpis }), true);
  assert.equal(isFinancialPreviewEmpty({ data: populated.data, kpis: populated.kpis }), false);
});

test("formats valid timestamps and gives safe fallbacks for absent or invalid dates", () => {
  assert.notEqual(formatPreviewDate("2026-07-17T12:00:00.000Z"), "—");
  assert.equal(formatPreviewDate(undefined), "—");
  assert.equal(formatPreviewDate("invalid-date"), "—");
});

test("preview integration remains GET-only and exposes deterministic UI states", async () => {
  const [api, component, hook, provider] = await Promise.all([
    readFile(path.join(feature, "..", "bi", "api", "bi-financial.api.ts"), "utf8"),
    readFile(path.join(feature, "preview", "FinancialCommandCenterPreview.tsx"), "utf8"),
    readFile(path.join(feature, "hooks", "shared", "hook.ts"), "utf8"),
    readFile(path.join(feature, "preview", "financial-preview-provider.ts"), "utf8"),
  ]);

  assert.match(api, /api\.get<BiFinancialContract>/);
  assert.doesNotMatch(`${api}\n${provider}`, /api\.(post|put|patch|delete|del)\s*\(/i);
  for (const state of [
    "Carregando preview financeiro",
    "Nenhum dado financeiro no período",
    "Preview indisponível",
    "Dados atualizados",
    "atualização mais recente falhou",
  ]) {
    assert.match(component, new RegExp(state));
  }
  assert.match(component, /onClick=\{\(\) => void onReload\(\)\}/);
  assert.match(hook, /fetching: query\.isFetching/);
  assert.doesNotMatch(component, /error\?\.message|error\.message/);
});

function sourceContract() {
  const metric = { available: true, reason: null, unit: "currency", value: 1500.25 };
  return {
    breakdowns: {
      categories: [{ key: "mensalidade", quantity: 1, value: 1500.25 }],
      modalities: [],
      paymentMethods: [],
      units: [],
    },
    contractVersion: "21.3",
    evolution: [{ period: "2026-07", receivedRevenue: 1500.25 }],
    filters: {
      current: {
        endDate: "2026-07-31",
        period: "CURRENT_MONTH",
        startDate: "2026-07-01",
        timezone: "America/Sao_Paulo",
        unitId: "2",
      },
      previous: {
        endDate: "2026-06-30",
        startDate: "2026-06-01",
        timezone: "America/Sao_Paulo",
        unitId: "2",
      },
    },
    generatedAt: "2026-07-17T12:00:00.000Z",
    insights: { goal: { achievedPercent: null } },
    kpis: {
      averageTicket: metric,
      expenses: metric,
      expectedRevenue: metric,
      overdueRevenue: metric,
      pendingRevenue: metric,
      receivedRevenue: metric,
    },
    readOnly: true,
  };
}
