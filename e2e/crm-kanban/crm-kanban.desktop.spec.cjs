const { expect, test } = require("@playwright/test");
const { assertSafePayload, card, column, dragMouse, installCrmMock } = require("./fixtures.cjs");

test.describe("CRM Kanban desktop", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("valid and invalid mouse drops preserve backend truth and safe payload", async ({
    page,
  }) => {
    const state = await installCrmMock(page, { patchDelayMs: 450 });
    const openedAt = Date.now();
    await page.goto("/admin/crm/leads");
    await expect(page.getByRole("heading", { name: "Leads", exact: true })).toBeVisible();
    expect(Date.now() - openedAt).toBeLessThan(30_000);

    await dragMouse(page, "lead-a-new", "CONTACTED");
    await expect(page.getByText("Movendo lead", { exact: true })).toBeVisible();
    await expect(column(page, "CONTACTED")).toHaveClass(/border-primary/);
    const dropAt = Date.now();
    await page.mouse.up();
    await expect.poll(() => state.patchRequests.length).toBe(1);
    expect(Date.now() - dropAt).toBeLessThan(500);
    await expect(column(page, "NEW").filter({ has: card(page, "lead-a-new") })).toBeVisible();
    assertSafePayload(state.patchRequests[0].body, {
      nextStage: "CONTACTED",
      expectedStage: "NEW",
      expectedStatus: "OPEN",
    });
    await expect(column(page, "CONTACTED").filter({ has: card(page, "lead-a-new") })).toBeVisible();
    await expect(page.getByText("Estágio atualizado.", { exact: true })).toBeVisible();

    const invalidState = await installCrmMock(page);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Leads", exact: true })).toBeVisible();
    await dragMouse(page, "lead-a-new", "QUALIFIED");
    await expect(column(page, "QUALIFIED")).toHaveClass(/cursor-not-allowed/);
    await expect(column(page, "QUALIFIED")).not.toHaveClass(/border-primary/);
    await page.mouse.up();
    await expect.poll(() => invalidState.patchRequests.length).toBe(0);
    await expect(column(page, "NEW").filter({ has: card(page, "lead-a-new") })).toBeVisible();
    const events = await page.evaluate(() => window.__crmDragEvents || []);
    expect(events.map((event) => event.event)).toContain("DRAG_CANCELLED");
  });

  test("LOST requires reason and WON requires explicit confirmation without conversion", async ({
    page,
  }) => {
    const state = await installCrmMock(page);
    await page.goto("/admin/crm/leads");
    await expect(page.getByRole("heading", { name: "Leads", exact: true })).toBeVisible();

    await dragMouse(page, "lead-a-new", "LOST");
    await page.mouse.up();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Confirmar" })).toBeDisabled();
    await page.locator("#crm-lost-reason").fill("Sem aderência ao programa sintético");
    await dialog.getByRole("button", { name: "Confirmar" }).click();
    await expect.poll(() => state.patchRequests.length).toBe(1);
    assertSafePayload(state.patchRequests[0].body, {
      nextStage: "LOST",
      expectedStage: "NEW",
      expectedStatus: "OPEN",
      reason: "Sem aderência ao programa sintético",
    });
    await expect(column(page, "LOST").filter({ has: card(page, "lead-a-new") })).toBeVisible();

    await dragMouse(page, "lead-b-negotiation", "WON");
    await page.mouse.up();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(
      column(page, "NEGOTIATION").filter({ has: card(page, "lead-b-negotiation") }),
    ).toBeVisible();
    expect(state.patchRequests).toHaveLength(1);

    await dragMouse(page, "lead-b-negotiation", "WON");
    await page.mouse.up();
    await dialog.getByRole("button", { name: "Confirmar" }).click();
    await expect.poll(() => state.patchRequests.length).toBe(2);
    assertSafePayload(state.patchRequests[1].body, {
      nextStage: "WON",
      expectedStage: "NEGOTIATION",
      expectedStatus: "OPEN",
    });
    await expect(
      column(page, "WON").filter({ has: card(page, "lead-b-negotiation") }),
    ).toContainText("CONVERTED");
    expect(state.conversionRequests).toHaveLength(0);
  });

  test("rollback, conflict refresh and pending state never duplicate PATCH", async ({ page }) => {
    const state = await installCrmMock(page, { nextPatch: "error", patchDelayMs: 400 });
    await page.goto("/admin/crm/leads");
    await expect(page.getByRole("heading", { name: "Leads", exact: true })).toBeVisible();
    await dragMouse(page, "lead-a-new", "CONTACTED");
    await page.mouse.up();
    const lockedHandle = page.getByRole("button", { name: "Arrastar lead lead-a-new" });
    await expect(lockedHandle).toBeDisabled();
    expect(state.patchRequests).toHaveLength(1);
    const lockedFrom = await lockedHandle.boundingBox();
    const lockedDestination = column(page, "CONTACTED");
    const lockedTo = await lockedDestination.boundingBox();
    if (!lockedFrom || !lockedTo) throw new Error("Pending drag bounds unavailable.");
    await lockedHandle.dispatchEvent("pointerdown", {
      pointerId: 99,
      pointerType: "mouse",
      buttons: 1,
      clientX: lockedFrom.x + lockedFrom.width / 2,
      clientY: lockedFrom.y + lockedFrom.height / 2,
    });
    await lockedDestination.dispatchEvent("pointermove", {
      pointerId: 99,
      pointerType: "mouse",
      buttons: 1,
      clientX: lockedTo.x + lockedTo.width / 2,
      clientY: lockedTo.y + 100,
    });
    await lockedDestination.dispatchEvent("pointerup", {
      pointerId: 99,
      pointerType: "mouse",
      buttons: 0,
      clientX: lockedTo.x + lockedTo.width / 2,
      clientY: lockedTo.y + 100,
    });
    await page.waitForTimeout(50);
    expect(state.patchRequests).toHaveLength(1);
    await expect(
      page.getByText("Não foi possível mover o Lead. Ele voltou à coluna original.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(column(page, "NEW").filter({ has: card(page, "lead-a-new") })).toBeVisible();
    expect(state.patchRequests).toHaveLength(1);

    state.nextPatch = "conflict";
    await dragMouse(page, "lead-a-new", "CONTACTED");
    await page.mouse.up();
    await expect(
      page.getByText("O Lead foi atualizado por outro usuário. Os dados foram recarregados.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(column(page, "QUALIFIED").filter({ has: card(page, "lead-a-new") })).toBeVisible();
    expect(state.patchRequests).toHaveLength(2);
    expect(state.listRequests).toBeGreaterThan(1);
  });

  test("403 is sanitized and drag telemetry emits only safe non-PII fields", async ({ page }) => {
    const state = await installCrmMock(page, { nextPatch: "forbidden" });
    await page.goto("/admin/crm/leads");
    await expect(page.getByRole("heading", { name: "Leads", exact: true })).toBeVisible();
    await dragMouse(page, "lead-a-new", "CONTACTED");
    await page.mouse.up();
    await expect(
      page.getByText("Não foi possível mover o Lead. Ele voltou à coluna original.", {
        exact: true,
      }),
    ).toBeVisible();
    const events = await page.evaluate(() => window.__crmDragEvents || []);
    expect(events.map((event) => event.event)).toEqual(
      expect.arrayContaining(["DRAG_STARTED", "DRAG_DROPPED", "DRAG_FAILED"]),
    );
    for (const event of events) {
      expect(event.duration).toBeGreaterThanOrEqual(0);
      expect(Object.keys(event).sort()).toEqual(
        expect.arrayContaining(["correlationId", "duration", "event", "fromStage", "leadId"]),
      );
      for (const forbidden of [
        "reason",
        "body",
        "token",
        "unitId",
        "userId",
        "email",
        "phone",
        "metadata",
      ])
        expect(event).not.toHaveProperty(forbidden);
    }
    expect(state.patchRequests).toHaveLength(1);
  });
});
