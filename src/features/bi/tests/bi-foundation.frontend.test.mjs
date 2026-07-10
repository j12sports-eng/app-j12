import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const featureRoot = path.resolve(__dirname, "..");
const sourceRoot = path.resolve(featureRoot, "..", "..");

test("BI frontend uses the shared API client and only the foundation endpoint", async () => {
  const source = await readFile(path.join(featureRoot, "api", "bi-foundation.api.ts"), "utf8");
  assert.match(source, /import \{ api \} from "@\/lib\/api"/);
  assert.match(source, /"\/admin\/bi\/foundation"/);
  assert.match(source, /api\.get<BiFoundationContract>/);
  assert.doesNotMatch(source, /axios|fetch\(/);
  assert.doesNotMatch(source, /dashboard|metric|kpi/i);
});

test("BI hook and query keys expose a minimal TanStack Query contract", async () => {
  const hook = await readFile(path.join(featureRoot, "hooks", "useBiFoundation.ts"), "utf8");
  const keys = await readFile(path.join(featureRoot, "query-keys", "bi-query-keys.ts"), "utf8");
  assert.match(hook, /useQuery/);
  assert.match(hook, /export function useBiFoundation/);
  assert.match(hook, /biQueryKeys\.foundation/);
  assert.match(keys, /export const biQueryKeys/);
  assert.match(keys, /"foundation"/);
});

test("BI foundation types expose the audited executive capability", async () => {
  const source = await readFile(path.join(featureRoot, "types", "bi-foundation.types.ts"), "utf8");
  assert.match(source, /contractVersion: "21\.1"/);
  assert.match(source, /timezone: "America\/Sao_Paulo"/);
  assert.match(source, /metrics: true/);
  assert.match(source, /reports: false/);
  assert.match(source, /EXECUTIVE_SNAPSHOT/);
});

test("Sprint 21.2 adds an isolated administrative BI route and navigation item", async () => {
  const sidebar = await readFile(path.join(sourceRoot, "components", "AppSidebar.tsx"), "utf8");
  const shell = await readFile(path.join(sourceRoot, "components", "AppShell.tsx"), "utf8");
  assert.match(sidebar, /\/admin\/bi/);

  const routeFiles = await import("node:fs/promises").then(({ readdir }) =>
    readdir(path.join(sourceRoot, "routes"), { recursive: true }),
  );
  assert.equal(
    routeFiles.some((file) => /(^|[\\/])bi\.(tsx|ts)$/.test(String(file))),
    true,
  );
});
