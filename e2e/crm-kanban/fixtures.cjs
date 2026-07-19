const { expect } = require("@playwright/test");

const PIPELINE = {
  stages: [
    stage("NEW", "Novo", ["CONTACTED", "LOST"]),
    stage("CONTACTED", "Contatado", ["QUALIFIED", "LOST"]),
    stage("QUALIFIED", "Qualificado", ["PROPOSAL", "LOST"]),
    stage("PROPOSAL", "Proposta", ["NEGOTIATION", "LOST"]),
    stage("NEGOTIATION", "Negociação", ["WON", "LOST"]),
    stage("WON", "Ganho", [], true),
    stage("LOST", "Perdido", [], true),
  ],
  transitions: [],
  cardFields: [],
};

function stage(id, label, transitions, terminal = false) {
  return {
    id,
    label,
    transitions,
    terminal,
    order: 1,
    color: "#fb923c",
    description: `Etapa sintética ${id}`,
  };
}

function lead(id, stageId, status = "OPEN") {
  const terminal = stageId === "WON" || stageId === "LOST";
  return {
    id,
    unitId: "synthetic-unit",
    source: "E2E sintético",
    assignedTo: "Operador sintético",
    stage: stageId,
    status,
    createdAt: "2026-07-18T12:00:00.000Z",
    updatedAt: "2026-07-18T12:00:00.000Z",
    eligibility: { canConvertToDraftEnrollment: false, reasonCode: "E2E_ONLY" },
    conversions: { studentCompleted: false, enrollmentCompleted: false, enrollmentStatus: null },
    stageTiming: {
      currentStageEntryAt: "2026-07-18T12:00:00.000Z",
      currentStageElapsedMs: 3_600_000,
      historyCoverage: "COMPLETE",
      measuredAt: "2026-07-18T13:00:00.000Z",
      sla: {
        status: terminal ? "COMPLETED" : "NOT_CONFIGURED",
        limitMs: null,
        elapsedMs: terminal ? 0 : 3_600_000,
        remainingMs: null,
        overdueMs: 0,
        consumedPercentage: null,
      },
    },
  };
}

function initialLeads() {
  return [
    lead("lead-a-new", "NEW"),
    lead("lead-b-negotiation", "NEGOTIATION"),
    lead("lead-c-won", "WON", "CONVERTED"),
    lead("lead-d-lost", "LOST", "LOST"),
  ];
}

async function installCrmMock(page, options = {}) {
  const slaAlertRequestRecords = new Map();
  const state = {
    leads: initialLeads(),
    patchRequests: [],
    conversionRequests: [],
    listRequests: 0,
    events: [],
    nextPatch: options.nextPatch || "success",
    patchDelayMs: options.patchDelayMs ?? 250,
    slaAlertListRequests: 0,
    slaAlertRequests: [],
    nextSlaAlert: options.nextSlaAlert || "success",
    slaAlertDelayMs: options.slaAlertDelayMs ?? 120,
  };

  // Mantém a cronologia completa para diferenciar refetch legítimo de duplicação indevida.
  page.on("requestfinished", (request) => {
    const record = slaAlertRequestRecords.get(request);
    if (!record) return;
    record.finishedAt = new Date().toISOString();
    record.outcome = "finished";
  });
  page.on("requestfailed", (request) => {
    const record = slaAlertRequestRecords.get(request);
    if (!record) return;
    record.failedAt = new Date().toISOString();
    record.failure = request.failure()?.errorText || "unknown";
    record.outcome = "failed";
  });

  await page.addInitScript(
    ({ role }) => {
      const user = {
        id: "synthetic-user",
        nome: "Usuário E2E",
        email: "e2e@example.invalid",
        role,
        perfil: role,
      };
      localStorage.setItem("j12_auth_token", "synthetic.e2e.token");
      localStorage.setItem("j12_auth_user", JSON.stringify(user));
      window.addEventListener("crm:drag", (event) => {
        window.__crmDragEvents = [...(window.__crmDragEvents || []), event.detail];
      });
    },
    { role: options.role || "admin" },
  );

  if (typeof page.routeWebSocket === "function") {
    await page.routeWebSocket("**/socket.io/**", (socket) => socket.close());
  }
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.startsWith("/socket.io/")) return route.abort("blockedbyclient");
    if (!url.pathname.startsWith("/api/")) {
      if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
        return route.abort("blockedbyclient");
      }
      return route.continue();
    }
    const path = url.pathname.replace(/^\/api/, "");

    if (path === "/auth/me") return json(route, userFor(options.role || "admin"));
    if (path === "/internal/crm/pipeline") return json(route, { data: PIPELINE, success: true });
    if (path === "/internal/crm/sla-alerts" && request.method() === "GET") {
      const query = Object.freeze(Object.fromEntries(url.searchParams.entries()));
      const requestRecord = {
        method: request.method(),
        params: query,
        query,
        queryString: url.search,
        startedAt: new Date().toISOString(),
        timestamp: Date.now(),
        url: request.url(),
        outcome: "pending",
      };
      state.slaAlertListRequests += 1;
      state.slaAlertRequests.push(requestRecord);
      slaAlertRequestRecords.set(request, requestRecord);
      await new Promise((resolve) => setTimeout(resolve, state.slaAlertDelayMs));
      if (state.nextSlaAlert === "error") {
        return json(
          route,
          { code: "CRM_SLA_ALERT_QUERY_FAILED", message: "Falha sintética controlada." },
          500,
        );
      }
      return json(route, { data: slaAlertPage(url.searchParams), success: true });
    }
    if (path === "/internal/crm/leads" && request.method() === "GET") {
      state.listRequests += 1;
      return json(route, {
        data: { items: state.leads, pageInfo: { nextCursor: null, hasNextPage: false } },
        success: true,
      });
    }
    const match = path.match(
      /^\/internal\/crm\/leads\/([^/]+)(?:\/(stage|stage-timing|draft-enrollment))?$/,
    );
    if (match && match[2] === "stage-timing" && request.method() === "GET") {
      const item = state.leads.find((candidate) => candidate.id === decodeURIComponent(match[1]));
      return json(route, { data: timingDetail(item), success: true });
    }
    if (match && !match[2] && request.method() === "GET") {
      const item = state.leads.find((candidate) => candidate.id === decodeURIComponent(match[1]));
      return json(route, { data: detail(item), success: true });
    }
    if (match && match[2] === "draft-enrollment") {
      state.conversionRequests.push(request.url());
      return json(route, { code: "E2E_UNEXPECTED_CONVERSION" }, 500);
    }
    if (match && match[2] === "stage" && request.method() === "PATCH") {
      const body = request.postDataJSON();
      const leadId = decodeURIComponent(match[1]);
      state.patchRequests.push({ body, leadId, method: request.method(), url: request.url() });
      await new Promise((resolve) => setTimeout(resolve, state.patchDelayMs));
      if (state.nextPatch === "error")
        return json(
          route,
          { code: "CRM_STAGE_TRANSITION_FAILED", message: "Falha controlada." },
          500,
        );
      if (state.nextPatch === "forbidden")
        return json(route, { code: "CRM_ACCESS_DENIED", message: "Acesso negado." }, 403);
      if (state.nextPatch === "conflict") {
        const current = state.leads.find((candidate) => candidate.id === leadId);
        if (current)
          Object.assign(current, {
            stage: "QUALIFIED",
            status: "OPEN",
            updatedAt: "2026-07-18T12:01:00.000Z",
          });
        state.nextPatch = "success";
        return json(route, { code: "CRM_STAGE_CONFLICT", message: "Conflito controlado." }, 409);
      }
      const current = state.leads.find((candidate) => candidate.id === leadId);
      const previousStage = current.stage;
      const previousStatus = current.status;
      Object.assign(current, {
        stage: body.nextStage,
        status:
          body.nextStage === "WON"
            ? "CONVERTED"
            : body.nextStage === "LOST"
              ? "LOST"
              : current.status,
        updatedAt: "2026-07-18T12:01:00.000Z",
        stageTiming: {
          ...current.stageTiming,
          currentStageEntryAt: "2026-07-18T12:01:00.000Z",
          currentStageElapsedMs: 0,
          measuredAt: "2026-07-18T12:01:00.000Z",
          sla: {
            ...current.stageTiming.sla,
            elapsedMs: 0,
            status:
              body.nextStage === "WON" || body.nextStage === "LOST"
                ? "COMPLETED"
                : "NOT_CONFIGURED",
          },
        },
      });
      return json(route, {
        data: {
          leadId,
          stage: current.stage,
          status: current.status,
          previousStage,
          previousStatus,
          nextStage: current.stage,
          nextStatus: current.status,
          updatedAt: current.updatedAt,
        },
        success: true,
      });
    }
    return json(route, []);
  });
  return state;
}

function slaAlertPage(searchParams) {
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 25, 1), 100);
  const stage = searchParams.get("stage");
  const slaStatus = searchParams.get("slaStatus");
  const unitId = searchParams.get("unitId");
  const source = cursor ? [slaAlert("lead-sla-page-2", "PROPOSAL", "OVERDUE")] : slaAlerts();
  const filtered = source
    .filter((item) => !stage || item.stage === stage)
    .filter((item) => !slaStatus || item.alertStatus === slaStatus)
    .filter((item) => !unitId || item.unitId === unitId)
    .slice(0, limit);
  const hasMore = !cursor;
  return {
    items: filtered,
    nextCursor: hasMore ? "synthetic-sla-cursor-v1-page-2" : null,
    hasMore,
    appliedFilters: { limit, stage, slaStatus, unitId },
    summary: { pageCounts: pageCounts(filtered) },
  };
}

function slaAlerts() {
  return [
    slaAlert("lead-a-new", "NEW", "OVERDUE"),
    slaAlert("lead-b-negotiation", "NEGOTIATION", "WARNING"),
    slaAlert("lead-c-won", "QUALIFIED", "UNAVAILABLE"),
    slaAlert("lead-d-lost", "CONTACTED", "NOT_CONFIGURED"),
  ];
}

function slaAlert(leadId, stageId, alertStatus) {
  const slaStatus = alertStatus === "WARNING" ? "DUE_SOON" : alertStatus;
  const unavailable = alertStatus === "UNAVAILABLE";
  const notConfigured = alertStatus === "NOT_CONFIGURED";
  const limitMs = unavailable || notConfigured ? null : 86_400_000;
  const elapsedMs = unavailable
    ? null
    : alertStatus === "OVERDUE"
      ? 172_800_000
      : alertStatus === "WARNING"
        ? 73_440_000
        : 3_600_000;
  return {
    leadId,
    unitId: "synthetic-unit",
    stage: stageId,
    status: "OPEN",
    alertStatus,
    historyCoverage: unavailable ? "UNAVAILABLE" : notConfigured ? "PARTIAL" : "COMPLETE",
    currentStageEntryAt: unavailable ? null : "2026-07-17T13:00:00.000Z",
    currentStageElapsedMs: elapsedMs,
    measuredAt: "2026-07-18T13:00:00.000Z",
    sla: {
      status: slaStatus,
      limitMs,
      elapsedMs,
      remainingMs: limitMs == null || elapsedMs == null ? null : Math.max(0, limitMs - elapsedMs),
      overdueMs: limitMs == null || elapsedMs == null ? 0 : Math.max(0, elapsedMs - limitMs),
      consumedPercentage:
        limitMs == null || elapsedMs == null
          ? null
          : Math.min(100, Math.max(0, (elapsedMs / limitMs) * 100)),
    },
    updatedAt: "2026-07-18T12:00:00.000Z",
  };
}

function pageCounts(items) {
  const counts = {
    overdue: 0,
    warning: 0,
    notConfigured: 0,
    unavailable: 0,
    normal: 0,
    completed: 0,
  };
  const keys = {
    OVERDUE: "overdue",
    WARNING: "warning",
    NOT_CONFIGURED: "notConfigured",
    UNAVAILABLE: "unavailable",
    NORMAL: "normal",
    COMPLETED: "completed",
  };
  for (const item of items) counts[keys[item.alertStatus]] += 1;
  return counts;
}

function userFor(role) {
  return {
    id: "synthetic-user",
    nome: "Usuário E2E",
    email: "e2e@example.invalid",
    role,
    perfil: role,
  };
}

function detail(item) {
  return {
    ...item,
    contact: { nome: null, email: null, telefone: null },
    conversions: {
      ...item.conversions,
      student: { status: null, personId: null, personProfileId: null, convertedAt: null },
      enrollment: { status: null, enrollmentId: null, enrollmentStatus: null, convertedAt: null },
    },
  };
}

function timingDetail(item) {
  return {
    leadId: item.id,
    currentStage: item.stage,
    currentStatus: item.status,
    ...item.stageTiming,
    stages: [
      {
        stage: item.stage,
        totalDurationMs: item.stageTiming.currentStageElapsedMs,
        visitCount: 1,
        firstEntryAt: item.stageTiming.currentStageEntryAt,
        lastEntryAt: item.stageTiming.currentStageEntryAt,
        lastExitAt: null,
        isCurrent: true,
      },
    ],
    timeline: [
      {
        stage: item.stage,
        entryAt: item.stageTiming.currentStageEntryAt,
        exitAt: null,
        durationMs: item.stageTiming.currentStageElapsedMs,
        actorId: "synthetic-operator",
        action: "CREATED",
        isCurrent: true,
      },
    ],
  };
}

async function json(route, body, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

function column(page, stageId) {
  return page.locator(`[aria-labelledby="pipeline-stage-${stageId}"]`);
}

function card(page, leadId) {
  return page.locator("article").filter({ hasText: leadId });
}

async function dragMouse(page, leadId, targetStage) {
  const handle = page.getByRole("button", { name: `Arrastar lead ${leadId}` });
  const target = column(page, targetStage);
  await handle.scrollIntoViewIfNeeded();
  await expect(handle).toBeVisible();
  const from = await handle.boundingBox();
  let to = await target.boundingBox();
  if (!from || !to) throw new Error("Drag bounds unavailable.");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // dnd-kit só inicia o drag depois de movimento suficiente para ativar o PointerSensor.
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2, { steps: 2 });
  const viewport = page.viewportSize();
  if (viewport && (to.x < 0 || to.x + to.width > viewport.width)) {
    await target.evaluate((element) =>
      element.scrollIntoView({ behavior: "instant", block: "nearest", inline: "center" }),
    );
    to = await target.boundingBox();
    if (!to) throw new Error("Drag target bounds unavailable after horizontal scroll.");
  }
  await page.mouse.move(to.x + to.width / 2, to.y + 110, { steps: 12 });
  return { from, to };
}

function assertSafePayload(body, expected) {
  expect(Object.keys(body).sort()).toEqual(Object.keys(expected).sort());
  expect(body).toEqual(expected);
  for (const forbidden of [
    "unitId",
    "userId",
    "actorId",
    "metadata",
    "previousStage",
    "contact",
    "email",
    "phone",
  ])
    expect(body).not.toHaveProperty(forbidden);
}

module.exports = { PIPELINE, assertSafePayload, card, column, dragMouse, installCrmMock };
