import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  formatChampionshipsPreviewDate,
  isChampionshipsPreviewEmpty,
  normalizeChampionshipsPreviewSource,
} from "../preview/championships-preview-normalizer.ts";

const feature = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function metric(value, unit, available = true, reason = null) {
  return { available, reason, unit, value };
}

function source(overrides = {}) {
  return {
    contractVersion: "21.8",
    filters: {
      current: {
        endDate: "2026-12-31",
        period: "CURRENT_YEAR",
        startDate: "2026-01-01",
        timezone: "America/Sao_Paulo",
        unitId: null,
      },
    },
    generatedAt: "2026-07-17T12:00:00.000Z",
    kpis: {
      activeChampionships: metric(2, "count"),
      averageTeams: metric(4.5, "average"),
      completedChampionships: metric(1, "count"),
      finishedMatches: metric(10, "count"),
      participants: metric(80, "count"),
      pendingMatches: metric(3, "count"),
      registrationRevenue: metric(null, "currency", false, "NO_CANONICAL_REGISTRATION_REVENUE"),
      registrations: metric(9, "count"),
      teams: metric(8, "count"),
    },
    rankings: {
      categories: [{ championships: 2, key: "Sub-15" }],
      championships: [
        {
          championshipId: "c1",
          championshipName: "Copa privada",
          responsibleName: "PII",
          teams: 4,
        },
      ],
      registrationEvolution: [{ key: "2026-07-10", registrations: 3 }],
      statuses: [{ championships: 2, key: "PUBLISHED" }],
    },
    readOnly: true,
    rows: [{ athleteName: "PII", document: "123", matchReport: "súmula" }],
    ...overrides,
  };
}

test("normalizes canonical 21.8 aggregates and drops championship rankings and PII", () => {
  const contract = normalizeChampionshipsPreviewSource(source());
  assert.equal(contract.contractVersion, "21.8");
  assert.equal(contract.kpis.averageTeams.value, 4.5);
  assert.equal(contract.kpis.registrationRevenue.value, null);
  assert.deepEqual(contract.data?.categories, [{ key: "Sub-15", value: 2 }]);
  assert.deepEqual(contract.data?.registrationEvolution, [{ key: "2026-07-10", value: 3 }]);
  assert.doesNotMatch(
    JSON.stringify(contract),
    /championshipId|championshipName|responsibleName|athleteName|document|matchReport|Copa privada|súmula/,
  );
});

test("rejects incompatible or writable contracts", () => {
  assert.throws(() => normalizeChampionshipsPreviewSource(source({ contractVersion: "unknown" })));
  assert.throws(() => normalizeChampionshipsPreviewSource(source({ readOnly: false })));
});

test("handles partial payloads, missing arrays and unavailable KPIs without inventing zero", () => {
  const contract = normalizeChampionshipsPreviewSource(source({ kpis: {}, rankings: {} }));
  assert.equal(contract.kpis.activeChampionships.value, null);
  assert.equal(contract.kpis.registrationRevenue.available, false);
  assert.deepEqual(contract.data?.categories, []);
  assert.deepEqual(contract.data?.registrationEvolution, []);
  assert.equal(isChampionshipsPreviewEmpty(contract), true);
});

test("blocks negatives, NaN, Infinity and invalid dates while preserving valid zero", () => {
  const contract = normalizeChampionshipsPreviewSource(
    source({
      generatedAt: "invalid",
      kpis: {
        activeChampionships: metric(-1, "count"),
        averageTeams: metric(Number.NaN, "average"),
        completedChampionships: metric(Number.POSITIVE_INFINITY, "count"),
        finishedMatches: metric(0, "count"),
        participants: metric(0, "count"),
        pendingMatches: metric(0, "count"),
        registrationRevenue: metric(null, "currency", false, "UNAVAILABLE"),
        registrations: metric(0, "count"),
        teams: metric(0, "count"),
      },
      rankings: {
        categories: [{ championships: -1, key: "Adulto" }],
        registrationEvolution: [{ key: "invalid", registrations: 2 }],
        statuses: [],
      },
    }),
  );
  assert.equal(contract.kpis.activeChampionships.value, null);
  assert.equal(contract.kpis.finishedMatches.value, 0);
  assert.deepEqual(contract.data?.categories, []);
  assert.equal(formatChampionshipsPreviewDate(contract.generatedAt), "—");
  assert.equal(isChampionshipsPreviewEmpty(contract), true);
});

test("provider and API perform one GET with supported filters and no operational fallback", async () => {
  const [provider, api] = await Promise.all([
    readFile(path.join(feature, "preview", "championships-preview-provider.ts"), "utf8"),
    readFile(path.resolve(feature, "..", "bi", "api", "bi-championships.api.ts"), "utf8"),
  ]);
  assert.equal((provider.match(/getBiChampionships\(/g) || []).length, 1);
  assert.match(provider, /normalizeChampionshipsPreviewSource/);
  assert.match(provider, /createChampionshipsProvider/);
  assert.match(api, /"\/admin\/bi\/championships"/);
  assert.match(api, /api\.get<BiChampionshipsContract>/);
  assert.doesNotMatch(api, /api\.(post|put|patch|delete)/i);
  assert.doesNotMatch(api, /\/admin\/campeonatos|matches|registrations|teams/);
});

test("preview reuses shared states and is registered after Courts behind the protected route", async () => {
  const [component, registry, route] = await Promise.all([
    readFile(path.join(feature, "preview", "ChampionshipsCommandCenterPreview.tsx"), "utf8"),
    readFile(path.join(feature, "preview", "registered-previews.ts"), "utf8"),
    readFile(
      path.resolve(
        feature,
        "..",
        "..",
        "routes",
        "admin",
        "command-center-championships-preview.tsx",
      ),
      "utf8",
    ),
  ]);
  for (const shared of [
    "PreviewField",
    "PreviewReloadButton",
    "PreviewShell",
    "PreviewStatePanel",
    "createPreviewQueryOptions",
    "useChampionshipsBI",
  ])
    assert.match(component, new RegExp(shared));
  assert.match(component, /loading && !contract/);
  assert.match(component, /error && !contract/);
  assert.match(component, /isChampionshipsPreviewEmpty/);
  assert.match(component, /Os dados anteriores foram preservados/);
  assert.doesNotMatch(
    component,
    /championshipId|championshipName|athlete|responsible|cpf|phone|email|address|matchReport/i,
  );
  assert.ok(registry.indexOf('id: "courts"') < registry.indexOf('id: "championships"'));
  assert.match(route, /ProtectedRoute roles=\{\["admin", "coordenador"\]\}/);
  assert.match(route, /ENABLE_COMMAND_CENTER_PREVIEW/);
});
