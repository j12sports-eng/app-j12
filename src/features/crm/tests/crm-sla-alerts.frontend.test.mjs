import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../../../../", import.meta.url);
const source = (path) => readFile(new URL(path, ROOT), "utf8");

test("SLA alerts API sends only allowlisted filters to the protected read-only endpoint", async () => {
  const [api, types] = await Promise.all([
    source("src/features/crm/api/crm-sla-alerts.api.ts"),
    source("src/features/crm/types/crm-sla-alerts.types.ts"),
  ]);

  assert.match(api, /api\.get<CrmSlaAlertPage>/);
  assert.match(api, /\/internal\/crm\/sla-alerts/);
  for (const filter of ["cursor", "limit", "stage", "slaStatus", "unitId"]) {
    assert.match(api, new RegExp(`params\\.set\\("${filter}"`));
  }
  assert.doesNotMatch(api, /api\.(post|put|patch|del|delete)/i);
  assert.doesNotMatch(api, /responsibleId|userId|localStorage|dangerouslySetInnerHTML/);

  for (const status of [
    "OVERDUE",
    "WARNING",
    "NOT_CONFIGURED",
    "UNAVAILABLE",
    "NORMAL",
    "COMPLETED",
  ]) {
    assert.match(types, new RegExp(`"${status}"`));
  }
  assert.match(types, /summary:[\s\S]*pageCounts/);
  assert.doesNotMatch(types, /responsibleId|contact|email|telefone|cpf|reason|metadata|payload/i);
});

test("SLA alerts infinite query reuses the reserved invalidation root and cursor pagination", async () => {
  const [keys, hook, timingKeys] = await Promise.all([
    source("src/features/crm/query/crm-sla-alerts.query-keys.ts"),
    source("src/features/crm/hooks/use-crm-sla-alerts.ts"),
    source("src/features/crm/query/crm-lead-stage-timing.query-keys.ts"),
  ]);

  assert.match(timingKeys, /Reserved for a future bounded global endpoint/);
  assert.match(keys, /all: crmLeadSlaQueryKeys\.all/);
  assert.match(keys, /lists:/);
  assert.match(keys, /list:/);
  assert.match(hook, /useInfiniteQuery/);
  assert.match(hook, /CRM_SLA_ALERTS_DEFAULT_LIMIT = 25/);
  assert.match(hook, /initialPageParam: null/);
  assert.match(hook, /lastPage\.hasMore/);
  assert.match(hook, /lastPage\.nextCursor/);
  assert.match(hook, /queryFn: \(\{ pageParam, signal \}\)/);
  assert.doesNotMatch(hook, /refetchInterval|setInterval|setTimeout|WebSocket/);
});

test("operational panel has complete accessible states, server filters and cursor controls", async () => {
  const panel = await source("src/features/crm/components/CrmSlaAlertsPanel.tsx");

  for (const text of [
    "Alertas de SLA",
    "Acompanhamento operacional dos prazos do funil.",
    "Em atraso",
    "Próximos do prazo",
    "Sem histórico confiável",
    "SLA não configurado",
    "Nenhum alerta operacional encontrado para os filtros atuais.",
    "Não foi possível carregar os alertas de SLA.",
    "Os prazos de SLA ainda não foram configurados para estas etapas.",
    "Aplicar filtros",
    "Limpar filtros",
    "Carregar mais alertas",
    "Carregando próxima página",
  ]) {
    assert.match(panel, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(panel, /Collapsible open=\{open\}/);
  assert.match(panel, /useState\(true\)/);
  assert.match(panel, /aria-labelledby="crm-sla-alerts-title"/);
  assert.match(panel, /aria-live="polite"/);
  assert.match(panel, /aria-busy/);
  assert.match(panel, /role="status"/);
  assert.match(panel, /role="alert"/);
  assert.match(panel, /useCrmSlaAlerts\(filters\)/);
  assert.match(panel, /query\.fetchNextPage\(\)/);
  assert.match(panel, /item\.alertStatus === group\.status/);
  assert.doesNotMatch(panel, /refetchInterval|setInterval|localStorage|dangerouslySetInnerHTML/);
});

test("alert item reuses timing and textual SLA components without rendering PII", async () => {
  const item = await source("src/features/crm/components/CrmSlaAlertItem.tsx");

  assert.match(item, /CrmLeadSlaBadge timing=\{item\}/);
  assert.match(item, /formatDuration\(displayElapsed\(item, nowMs\)\)/);
  assert.match(item, /Não há histórico suficiente para calcular o prazo deste Lead\./);
  assert.match(item, /aria-label=\{`Abrir detalhe do Lead/);
  assert.match(item, /data-crm-sla-alert-detail-trigger/);
  assert.doesNotMatch(
    item,
    /item\.(unitId|responsibleId|contact|email|telefone|cpf|reason|metadata)/i,
  );
  assert.doesNotMatch(item, /useDraggable|useDroppable|touch-none/);
});

test("SLA alert observability emits the required safe interactions once from effects/actions", async () => {
  const [observability, panel, item] = await Promise.all([
    source("src/features/crm/observability/crm-sla-alerts.observability.ts"),
    source("src/features/crm/components/CrmSlaAlertsPanel.tsx"),
    source("src/features/crm/components/CrmSlaAlertItem.tsx"),
  ]);

  for (const event of [
    "CRM_SLA_ALERTS_VIEWED",
    "CRM_SLA_ALERTS_FILTERED",
    "CRM_SLA_ALERT_OPENED",
    "CRM_SLA_ALERTS_LOAD_FAILED",
  ]) {
    assert.match(observability + panel + item, new RegExp(event));
  }
  assert.match(panel, /viewed\.current/);
  assert.match(observability, /Math\.max\(0/);
  assert.match(observability, /crm:sla-alerts/);
  assert.doesNotMatch(observability, /leadId|unitId|userId|email|telefone|token|body|metadata/);
});

test("CRM page keeps the SLA panel outside drag context and shares one visible minute clock", async () => {
  const page = await source("src/features/crm/pages/CrmLeadsPage.tsx");
  const panelPosition = page.indexOf("<CrmSlaAlertsPanel");
  const dragContextPosition = page.indexOf("<DndContext");

  assert.ok(panelPosition > 0, "SLA panel must be mounted on the canonical CRM page");
  assert.ok(
    panelPosition < dragContextPosition,
    "SLA panel must remain outside and before the Kanban drag context",
  );
  assert.match(page, /<CrmSlaAlertsPanel nowMs=\{nowMs\} onOpenLead=\{openDetails\}/);
  assert.match(page, /<PipelineBoard[\s\S]*nowMs=\{nowMs\}/);
  assert.equal(page.match(/useVisibleMinuteClock\(\)/g)?.length, 1);
  assert.match(page, /data-crm-stage-trigger/);
});
