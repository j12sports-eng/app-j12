const { expect, test } = require("@playwright/test");
const { card, column, dragMouse, installCrmMock } = require("./fixtures.cjs");

test.describe("CRM operational SLA alerts", () => {
  test.describe.configure({ timeout: 90_000 });
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("panel groups safe alerts, sends filters, paginates and opens detail by keyboard", async ({
    page,
  }) => {
    const state = await installCrmMock(page, { slaAlertDelayMs: 300 });
    await page.goto("/admin/crm/leads");

    await expect(page.getByRole("heading", { name: "Leads", exact: true })).toBeVisible({
      timeout: 60_000,
    });
    const panel = slaPanel(page);
    await expect(panel.getByText("Acompanhamento operacional dos prazos do funil.")).toBeVisible();
    await expect
      .poll(() => state.slaAlertRequests.filter(({ outcome }) => outcome === "finished").length)
      .toBeGreaterThanOrEqual(1);

    const initialAlertRequests = state.slaAlertRequests.slice();
    expect(initialAlertRequests.length).toBeGreaterThanOrEqual(1);
    expect(initialAlertRequests.length).toBeLessThanOrEqual(2);

    for (const request of initialAlertRequests) {
      const requestUrl = new URL(request.url);
      expect(request.method).toBe("GET");
      expect(requestUrl.pathname).toBe("/api/internal/crm/sla-alerts");
      expect(request.queryString).toBe("?limit=25");
      expect(request.params).toEqual({ limit: "25" });
      expect(request.query).toEqual({ limit: "25" });
      expect(request.timestamp).toEqual(expect.any(Number));
      expect(Number.isNaN(Date.parse(request.startedAt))).toBe(false);
    }

    if (initialAlertRequests.length === 2) {
      expect(initialAlertRequests.map(({ outcome }) => outcome)).toEqual(["failed", "finished"]);
      expect(initialAlertRequests[0].failure).toContain("ERR_ABORTED");
    }

    await test.info().attach("initial-sla-alert-requests", {
      body: JSON.stringify(initialAlertRequests, null, 2),
      contentType: "application/json",
    });
    for (const group of [
      "Em atraso",
      "Próximos do prazo",
      "Sem histórico confiável",
      "SLA não configurado",
    ]) {
      await expect(panel.getByRole("heading", { name: group, exact: true })).toBeVisible();
    }
    await expect(
      panel.getByText("Os prazos de SLA ainda não foram configurados para estas etapas."),
    ).toBeVisible();
    await expect(
      panel.getByText("Não há histórico suficiente para calcular o prazo deste Lead."),
    ).toBeVisible();
    await expect(panel).not.toContainText(/cpf|telefone|e-mail|synthetic@example\.invalid/i);

    await panel.getByLabel("Etapa").selectOption("NEW");
    await panel.getByLabel("Situação do alerta").selectOption("OVERDUE");
    await panel.getByLabel("Unidade").fill("synthetic-unit");
    await panel.getByRole("button", { name: "Aplicar filtros" }).click();
    await expect
      .poll(
        () =>
          state.slaAlertRequests.filter(
            ({ query }) =>
              query.stage === "NEW" &&
              query.slaStatus === "OVERDUE" &&
              query.unitId === "synthetic-unit",
          ).length,
      )
      .toBe(1);
    const filteredRequest = state.slaAlertRequests.at(-1);
    expect(filteredRequest.method).toBe("GET");
    expect(filteredRequest.query).toMatchObject({
      limit: "25",
      slaStatus: "OVERDUE",
      stage: "NEW",
      unitId: "synthetic-unit",
    });
    await expect(panel.getByText("lead-a-new", { exact: true })).toBeVisible();

    await panel.getByRole("button", { name: "Limpar filtros" }).click();
    await expect(panel.getByLabel("Etapa")).toHaveValue("");
    await expect(panel.getByLabel("Situação do alerta")).toHaveValue("");
    await expect(panel.getByLabel("Unidade")).toHaveValue("");
    await expect(panel.getByText("lead-b-negotiation", { exact: true })).toBeVisible();

    const detailTrigger = panel.getByRole("button", {
      name: "Abrir detalhe do Lead lead-a-new",
    });
    await detailTrigger.focus();
    await expect(detailTrigger).toBeFocused();
    await detailTrigger.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Tempo no funil" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    const loadMore = panel.getByRole("button", { name: "Carregar mais alertas" });
    await loadMore.click();
    await expect(panel.getByRole("button", { name: "Carregando próxima página" })).toBeVisible();
    await expect
      .poll(
        () =>
          state.slaAlertRequests.filter(
            ({ query }) => query.cursor === "synthetic-sla-cursor-v1-page-2",
          ).length,
      )
      .toBe(1);
    await expect(panel.getByText("lead-sla-page-2", { exact: true })).toBeVisible();
  });

  test("drag remains functional and triggers one PATCH plus one alert refetch", async ({
    page,
  }) => {
    const state = await installCrmMock(page);
    await page.goto("/admin/crm/leads");
    await expect(slaPanel(page).getByText("lead-a-new", { exact: true })).toBeVisible();
    const alertRequestsBeforeDrop = state.slaAlertListRequests;

    await dragMouse(page, "lead-a-new", "CONTACTED");
    await page.mouse.up();

    await expect.poll(() => state.patchRequests.length).toBe(1);
    await expect.poll(() => state.slaAlertListRequests).toBe(alertRequestsBeforeDrop + 1);
    await expect(column(page, "CONTACTED").filter({ has: card(page, "lead-a-new") })).toBeVisible();
    expect(state.patchRequests).toHaveLength(1);
  });

  test("mobile panel stays readable without capturing the Kanban interaction area", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installCrmMock(page);
    await page.goto("/admin/crm/leads");

    const panel = slaPanel(page);
    await expect(panel).toBeVisible();
    await expect(panel.getByLabel("Situação do alerta")).toBeVisible();
    expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
      true,
    );
    await expect(page.getByRole("button", { name: "Arrastar lead lead-a-new" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Alterar estágio" }).first()).toBeVisible();
  });
});

function slaPanel(page) {
  return page
    .getByRole("heading", { name: "Alertas de SLA", exact: true })
    .locator("xpath=ancestor::section[1]");
}
