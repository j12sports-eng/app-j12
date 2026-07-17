import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  formatCourtsPreviewDate,
  isCourtsPreviewEmpty,
  normalizeCourtsPreviewSource,
} from "../preview/courts-preview-normalizer.ts";

const feature = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function metric(value, unit, available = true, reason = null) {
  return { available, reason, unit, value };
}

function source(overrides = {}) {
  return {
    contractVersion: "21.7",
    filters: {
      current: {
        endDate: "2026-07-31",
        period: "CURRENT_MONTH",
        startDate: "2026-07-01",
        timezone: "America/Sao_Paulo",
        unitId: "norte",
      },
    },
    generatedAt: "2026-07-17T12:00:00.000Z",
    kpis: {
      availableHours: metric(320, "hours"),
      cancellations: metric(4, "count"),
      occupancyRate: metric(62.5, "percentage"),
      rentalRevenue: metric(null, "currency", false, "NO_CANONICAL_PAYMENT_AMOUNT_AND_TIMESTAMP"),
      reservedHours: metric(200, "hours"),
      ticketAverage: metric(null, "currency", false, "NO_CANONICAL_PAYMENT_AMOUNT_AND_TIMESTAMP"),
    },
    rankings: {
      courts: [{ courtId: "9", courtName: "Quadra privada", revenue: null }],
      days: [{ key: "seg", reservations: 2 }],
      hours: [{ key: "18:00", reservations: 2 }],
      units: [{ key: "norte", reservations: 2 }],
    },
    readOnly: true,
    rows: [{ renterName: "PII", phone: "11999999999", notes: "operacional" }],
    ...overrides,
  };
}

test("normalizes only canonical 21.7 aggregate KPIs and drops rankings, rows and PII", () => {
  const contract = normalizeCourtsPreviewSource(source());
  assert.equal(contract.contractVersion, "21.7");
  assert.equal(contract.kpis.occupancyRate.value, 62.5);
  assert.equal(contract.kpis.rentalRevenue.value, null);
  assert.deepEqual(contract.data, {});
  assert.deepEqual(contract.filters.unit.selectedUnitIds, ["norte"]);
  assert.doesNotMatch(
    JSON.stringify(contract),
    /rankings|rows|courtId|courtName|renterName|phone|notes|Quadra privada|18:00/,
  );
});

test("rejects incompatible or writable contracts", () => {
  assert.throws(() => normalizeCourtsPreviewSource(source({ contractVersion: "unknown" })));
  assert.throws(() => normalizeCourtsPreviewSource(source({ readOnly: false })));
});

test("handles partial payloads and unavailable KPIs without inventing zero", () => {
  const contract = normalizeCourtsPreviewSource(source({ kpis: {} }));
  assert.equal(contract.kpis.availableHours.available, false);
  assert.equal(contract.kpis.availableHours.value, null);
  assert.equal(contract.kpis.ticketAverage.value, null);
  assert.equal(isCourtsPreviewEmpty(contract), true);
});

test("blocks negatives, NaN, Infinity, invalid percentages and invalid dates", () => {
  const contract = normalizeCourtsPreviewSource(
    source({
      generatedAt: "invalid",
      kpis: {
        availableHours: metric(-1, "hours"),
        cancellations: metric(Number.NaN, "count"),
        occupancyRate: metric(101, "percentage"),
        rentalRevenue: metric(Number.POSITIVE_INFINITY, "currency"),
        reservedHours: metric(0, "hours"),
        ticketAverage: metric(0, "currency"),
      },
    }),
  );
  assert.equal(contract.kpis.occupancyRate.value, null);
  assert.equal(contract.kpis.reservedHours.value, 0);
  assert.equal(formatCourtsPreviewDate(contract.generatedAt), "—");
  assert.equal(isCourtsPreviewEmpty(contract), true);
});

test("provider and API perform one GET against the BI endpoint without operational fallback", async () => {
  const [provider, api] = await Promise.all([
    readFile(path.join(feature, "preview", "courts-preview-provider.ts"), "utf8"),
    readFile(path.resolve(feature, "..", "bi", "api", "bi-courts.api.ts"), "utf8"),
  ]);
  assert.equal((provider.match(/getBiCourts\(/g) || []).length, 1);
  assert.match(provider, /normalizeCourtsPreviewSource/);
  assert.match(provider, /createCourtsProvider/);
  assert.match(api, /"\/admin\/bi\/courts"/);
  assert.match(api, /api\.get<BiCourtsContract>/);
  assert.doesNotMatch(api, /api\.(post|put|patch|delete)/i);
  assert.doesNotMatch(api, /\/admin\/quadras|reservas|availability/);
});

test("preview reuses shared states and is registered after Agenda behind the protected route", async () => {
  const [component, registry, route] = await Promise.all([
    readFile(path.join(feature, "preview", "CourtsCommandCenterPreview.tsx"), "utf8"),
    readFile(path.join(feature, "preview", "registered-previews.ts"), "utf8"),
    readFile(
      path.resolve(feature, "..", "..", "routes", "admin", "command-center-courts-preview.tsx"),
      "utf8",
    ),
  ]);
  for (const shared of [
    "PreviewField",
    "PreviewReloadButton",
    "PreviewShell",
    "PreviewStatePanel",
    "createPreviewQueryOptions",
    "useCourtsBI",
  ])
    assert.match(component, new RegExp(shared));
  assert.match(component, /loading && !contract/);
  assert.match(component, /error && !contract/);
  assert.match(component, /isCourtsPreviewEmpty/);
  assert.match(component, /Os dados anteriores foram preservados/);
  assert.doesNotMatch(component, /courtId|courtName|renter|cpf|phone|email|address|notes/i);
  assert.ok(registry.indexOf('id: "agenda"') < registry.indexOf('id: "courts"'));
  assert.match(route, /ProtectedRoute roles=\{\["admin", "coordenador"\]\}/);
  assert.match(route, /ENABLE_COMMAND_CENTER_PREVIEW/);
});
