import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  formatEventsPreviewDate,
  isEventsPreviewEmpty,
  normalizeEventsPreviewSource,
} from "../preview/events-preview-normalizer.ts";
const feature = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const metric = (value, available = true, reason = null) => ({
  available,
  reason,
  unit: "count",
  value,
});
function source(overrides = {}) {
  return {
    version: "27.12",
    generatedAt: "2026-07-17T12:00:00.000Z",
    source: "j12_campeonatos",
    readOnly: true,
    filters: {
      current: {
        endDate: "2026-12-31",
        period: "CURRENT_YEAR",
        startDate: "2026-01-01",
        unitId: null,
      },
    },
    kpis: {
      totalEvents: metric(4),
      publishedEvents: metric(2),
      completedEvents: metric(1),
      upcomingEvents: metric(1),
      scheduledEvents: metric(null, false, "NO_CANONICAL_SCHEDULED_STATUS"),
      cancelledEvents: metric(null, false, "NO_CANONICAL_CANCELLATION_STATUS"),
    },
    dimensions: {
      monthlyEvolution: [{ period: "2026-07", events: 4 }],
      eventsByType: [{ type: "Futsal", events: 4 }],
      eventsByStatus: [{ status: "PUBLISHED", events: 2 }],
      eventsByUnit: [{ unitId: "secret", events: 4 }],
    },
    rows: [{ id: "event-1", name: "Evento privado", participant: "PII", email: "pii@example.com" }],
    ...overrides,
  };
}
test("normalizes only canonical 27.12 aggregates and drops unavailable metrics, units, rows and PII", () => {
  const contract = normalizeEventsPreviewSource(source());
  assert.equal(contract.contractVersion, "27.12");
  assert.equal(contract.kpis.totalEvents.value, 4);
  assert.deepEqual(Object.keys(contract.kpis), [
    "totalEvents",
    "publishedEvents",
    "completedEvents",
    "upcomingEvents",
  ]);
  assert.deepEqual(contract.data?.monthlyEvolution, [{ key: "2026-07", value: 4 }]);
  assert.doesNotMatch(
    JSON.stringify(contract),
    /scheduledEvents|cancelledEvents|eventsByUnit|unitId|event-1|Evento privado|participant|email/,
  );
});
test("rejects invalid version, source or writable contract", () => {
  assert.throws(() => normalizeEventsPreviewSource(source({ version: "unknown" })));
  assert.throws(() => normalizeEventsPreviewSource(source({ source: "agenda" })));
  assert.throws(() => normalizeEventsPreviewSource(source({ readOnly: false })));
});
test("handles partial, missing and unavailable values without inventing zero", () => {
  const contract = normalizeEventsPreviewSource(source({ kpis: {}, dimensions: {} }));
  assert.equal(contract.kpis.totalEvents.value, null);
  assert.deepEqual(contract.data?.eventsByType, []);
  assert.equal(isEventsPreviewEmpty(contract), true);
});
test("blocks negatives, NaN, Infinity, invalid dates and unsafe labels while preserving valid zero", () => {
  const contract = normalizeEventsPreviewSource(
    source({
      generatedAt: "invalid",
      kpis: {
        totalEvents: metric(-1),
        publishedEvents: metric(Number.NaN),
        completedEvents: metric(Number.POSITIVE_INFINITY),
        upcomingEvents: metric(0),
      },
      dimensions: {
        monthlyEvolution: [{ period: "invalid", events: 2 }],
        eventsByType: [{ type: "x".repeat(81), events: 1 }],
        eventsByStatus: [],
      },
    }),
  );
  assert.equal(contract.kpis.totalEvents.value, null);
  assert.equal(contract.kpis.upcomingEvents.value, 0);
  assert.deepEqual(contract.data?.monthlyEvolution, []);
  assert.equal(formatEventsPreviewDate(contract.generatedAt), "—");
  assert.equal(isEventsPreviewEmpty(contract), true);
});
test("API and provider perform one GET without unitId, mutations or operational fallback", async () => {
  const [provider, api] = await Promise.all([
    readFile(path.join(feature, "preview", "events-preview-provider.ts"), "utf8"),
    readFile(path.resolve(feature, "..", "bi", "api", "bi-events.api.ts"), "utf8"),
  ]);
  assert.equal((provider.match(/getBiEvents\(/g) || []).length, 1);
  assert.match(provider, /normalizeEventsPreviewSource/);
  assert.match(provider, /createEventsProvider/);
  assert.match(api, /\/admin\/bi\/events/);
  assert.match(api, /api\.get<BiEventsContract>/);
  assert.doesNotMatch(
    api,
    /unitId|api\.(post|put|patch|delete)|championships|agenda|participants|registrations/i,
  );
});
test("preview reuses shared states and is registered after Championships behind protected route", async () => {
  const [component, registry, route] = await Promise.all([
    readFile(path.join(feature, "preview", "EventsCommandCenterPreview.tsx"), "utf8"),
    readFile(path.join(feature, "preview", "registered-previews.ts"), "utf8"),
    readFile(
      path.resolve(feature, "..", "..", "routes", "admin", "command-center-events-preview.tsx"),
      "utf8",
    ),
  ]);
  for (const shared of [
    "PreviewField",
    "PreviewReloadButton",
    "PreviewShell",
    "PreviewStatePanel",
    "createPreviewQueryOptions",
    "useEventsBI",
  ])
    assert.match(component, new RegExp(shared));
  assert.match(component, /loading && !contract/);
  assert.match(component, /error && !contract/);
  assert.match(component, /isEventsPreviewEmpty/);
  assert.match(component, /Os dados anteriores foram preservados/);
  assert.doesNotMatch(
    component,
    /scheduledEvents|cancelledEvents|eventsByUnit|participant|cpf|phone|email|address|privateDescription|observ/i,
  );
  assert.ok(registry.indexOf('id: "championships"') < registry.indexOf('id: "events"'));
  assert.match(route, /ProtectedRoute roles=\{\["admin", "coordenador"\]\}/);
  assert.match(route, /ENABLE_COMMAND_CENTER_PREVIEW/);
});
