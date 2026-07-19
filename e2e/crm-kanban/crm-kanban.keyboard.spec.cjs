const { expect, test } = require("@playwright/test");
const { card, column, installCrmMock } = require("./fixtures.cjs");

test.describe("CRM Kanban keyboard and permissions", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("keyboard can cancel drag and manual stage change remains functional", async ({ page }) => {
    const state = await installCrmMock(page);
    await page.goto("/admin/crm/leads");
    const handle = page.getByRole("button", { name: "Arrastar lead lead-a-new" });
    await handle.focus();
    await expect(handle).toBeFocused();
    await expect(handle).toHaveAttribute("aria-describedby", /DndDescribedBy/);
    await handle.press("Space");
    await expect(page.getByText("Movendo lead", { exact: true })).toBeVisible();
    await handle.press("Escape");
    await expect(page.getByText("Movendo lead", { exact: true })).toBeHidden();
    await expect(handle).toBeFocused();
    expect(state.patchRequests).toHaveLength(0);

    await handle.press("Space");
    for (let step = 0; step < 12; step += 1) await handle.press("ArrowRight");
    await expect(column(page, "CONTACTED")).toHaveClass(/border-primary/);
    await handle.press("Space");
    await expect.poll(() => state.patchRequests.length).toBe(1);
    await expect(column(page, "CONTACTED").filter({ has: card(page, "lead-a-new") })).toBeVisible();

    const manual = card(page, "lead-a-new").getByRole("button", { name: "Alterar estágio" });
    await manual.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Confirmar" }).click();
    await expect.poll(() => state.patchRequests.length).toBe(2);
    await expect(column(page, "QUALIFIED").filter({ has: card(page, "lead-a-new") })).toBeVisible();
    await expect(manual).toBeFocused();
  });

  test("admin and coordinator access while unauthorized role is redirected", async ({ page }) => {
    await installCrmMock(page, { role: "coordenador" });
    await page.goto("/admin/crm/leads");
    await expect(page.getByRole("heading", { name: "Leads", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Arrastar lead lead-a-new" })).toBeVisible();

    const denied = await page.context().newPage();
    await installCrmMock(denied, { role: "professor" });
    await denied.goto("/admin/crm/leads");
    await expect(denied).not.toHaveURL(/\/admin\/crm\/leads$/);
    await expect(denied.getByRole("button", { name: "Arrastar lead lead-a-new" })).toHaveCount(0);
    await denied.close();
  });
});
