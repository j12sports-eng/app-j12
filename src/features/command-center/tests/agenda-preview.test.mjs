import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  formatAgendaPreviewDate,
  isAgendaPreviewEmpty,
  normalizeAgendaPreviewSource,
} from "../preview/agenda-preview-normalizer.ts";

const feature = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function source(overrides = {}) {
  return {
    contractVersion: "21.12",
    distributions: {
      exceptionTypes: {
        available: true,
        items: [
          { key: "CANCELLED", value: 2 },
          { key: "MODIFIED", value: 1 },
        ],
        reason: null,
      },
    },
    filters: {
      current: {
        endDate: "2026-07-31",
        period: "CURRENT_MONTH",
        startDate: "2026-07-01",
        timezone: "America/Sao_Paulo",
        unitId: "3",
      },
    },
    generatedAt: "2026-07-17T12:00:00.000Z",
    kpis: {
      activeRecurrenceSeries: metric(4, "count"),
      cancelledOccurrences: metric(2, "count"),
      cancelledRecurrenceSeries: metric(1, "count"),
      cancellationRate: metric(66.67, "percentage"),
      modifiedOccurrences: metric(1, "count"),
      recurrenceSeries: metric(5, "count"),
    },
    metadata: {
      aggregation: "DATABASE",
      operationalRowsIncluded: false,
      queryCount: 2,
      unitAuthorizationScope: "SYSTEM_MANAGEMENT",
    },
    readOnly: true,
    source: {
      tables: ["agenda_recurrence_series", "agenda_recurrence_exceptions"],
      type: "MYSQL_AGGREGATE_READ_ONLY",
    },
    timeline: [
      {
        cancelledOccurrences: 2,
        date: "2026-07-10",
        modifiedOccurrences: 1,
        studentName: "PII inesperada",
      },
    ],
    warnings: ["RECURRENCE_OCCURRENCES_NOT_MATERIALIZED", "texto externo descartado"],
    rows: [{ professorName: "PII inesperada", notes: "descrição operacional" }],
    ...overrides,
  };
}

function metric(value, unit) {
  return { available: true, reason: null, unit, value };
}

test("normalizes only the real 21.12 aggregate Agenda contract and drops PII", () => {
  const contract = normalizeAgendaPreviewSource(source());
  assert.equal(contract.contractVersion, "21.12");
  assert.equal(contract.kpis.recurrenceSeries.value, 5);
  assert.equal(contract.kpis.cancellationRate.value, 66.67);
  assert.equal(contract.filters.unit.selectedUnitIds[0], "3");
  assert.deepEqual(contract.data?.exceptionTypes, [
    { key: "CANCELLED", value: 2 },
    { key: "MODIFIED", value: 1 },
  ]);
  assert.deepEqual(contract.metadata.warnings, ["RECURRENCE_OCCURRENCES_NOT_MATERIALIZED"]);
  assert.doesNotMatch(
    JSON.stringify(contract),
    /studentName|professorName|notes|descrição operacional|PII inesperada/,
  );
});

test("rejects incompatible or writable contracts", () => {
  assert.throws(() => normalizeAgendaPreviewSource(source({ contractVersion: "unknown" })));
  assert.throws(() => normalizeAgendaPreviewSource(source({ readOnly: false })));
});

test("handles missing arrays, unavailable KPIs and absent values without inventing zero", () => {
  const contract = normalizeAgendaPreviewSource(
    source({
      distributions: {},
      kpis: {
        activeRecurrenceSeries: {
          available: false,
          reason: "UNAVAILABLE",
          unit: "count",
          value: 9,
        },
      },
      timeline: undefined,
      warnings: undefined,
    }),
  );
  assert.equal(contract.kpis.activeRecurrenceSeries.value, null);
  assert.equal(contract.kpis.cancelledOccurrences.value, null);
  assert.deepEqual(contract.data?.exceptionTypes, []);
  assert.deepEqual(contract.data?.timeline, []);
  assert.equal(isAgendaPreviewEmpty(contract), true);
});

test("blocks NaN, Infinity, negatives and invalid dates while preserving valid zero", () => {
  const contract = normalizeAgendaPreviewSource(
    source({
      generatedAt: "invalid",
      kpis: {
        activeRecurrenceSeries: metric(Number.NaN, "count"),
        cancelledOccurrences: metric(Number.POSITIVE_INFINITY, "count"),
        cancelledRecurrenceSeries: metric(-1, "count"),
        cancellationRate: metric(0, "percentage"),
        modifiedOccurrences: metric(0, "count"),
        recurrenceSeries: metric(0, "count"),
      },
      timeline: [{ cancelledOccurrences: 1, date: "invalid", modifiedOccurrences: 0 }],
    }),
  );
  assert.equal(contract.kpis.activeRecurrenceSeries.value, null);
  assert.equal(contract.kpis.cancellationRate.value, 0);
  assert.deepEqual(contract.data?.timeline, []);
  assert.equal(formatAgendaPreviewDate(contract.generatedAt), "—");
});

test("empty state considers KPIs, distributions and timeline without treating zero as error", () => {
  const populated = normalizeAgendaPreviewSource(source());
  assert.equal(isAgendaPreviewEmpty(populated), false);
  const zero = normalizeAgendaPreviewSource(
    source({
      distributions: { exceptionTypes: { available: true, items: [], reason: null } },
      kpis: Object.fromEntries(
        Object.keys(source().kpis).map((key) => [
          key,
          metric(0, key === "cancellationRate" ? "percentage" : "count"),
        ]),
      ),
      timeline: [],
    }),
  );
  assert.equal(isAgendaPreviewEmpty(zero), true);
});

test("provider and API perform one GET against the aggregate endpoint only", async () => {
  const [provider, api] = await Promise.all([
    readFile(path.join(feature, "preview", "agenda-preview-provider.ts"), "utf8"),
    readFile(path.resolve(feature, "..", "bi", "api", "bi-agenda.api.ts"), "utf8"),
  ]);
  assert.match(provider, /getBiAgenda/);
  assert.match(provider, /normalizeAgendaPreviewSource/);
  assert.match(provider, /createAgendaProvider/);
  assert.equal((provider.match(/getBiAgenda\(/g) || []).length, 1);
  assert.match(api, /"\/admin\/bi\/agenda"/);
  assert.match(api, /api\.get<BiAgendaContract>/);
  assert.doesNotMatch(api, /api\.(post|put|patch|delete)/i);
  assert.doesNotMatch(api, /\/admin\/agenda\//);
});

test("preview reuses shared states, registry order and protected feature-flagged route", async () => {
  const [component, registry, route] = await Promise.all([
    readFile(path.join(feature, "preview", "AgendaCommandCenterPreview.tsx"), "utf8"),
    readFile(path.join(feature, "preview", "registered-previews.ts"), "utf8"),
    readFile(
      path.resolve(feature, "..", "..", "routes", "admin", "command-center-agenda-preview.tsx"),
      "utf8",
    ),
  ]);
  for (const shared of [
    "PreviewField",
    "PreviewReloadButton",
    "PreviewShell",
    "PreviewStatePanel",
    "createPreviewQueryOptions",
    "useAgendaBI",
  ]) {
    assert.match(component, new RegExp(shared));
  }
  assert.match(component, /loading && !contract/);
  assert.match(component, /error && !contract/);
  assert.match(component, /isAgendaPreviewEmpty/);
  assert.match(component, /Os dados anteriores foram preservados/);
  assert.doesNotMatch(component, /student|professor|cpf|email|phone|address|notes/i);
  assert.ok(registry.indexOf('id: "classes"') < registry.indexOf('id: "agenda"'));
  assert.match(route, /ProtectedRoute roles=\{\["admin", "coordenador"\]\}/);
  assert.match(route, /ENABLE_COMMAND_CENTER_PREVIEW/);
});
