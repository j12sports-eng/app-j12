const { expect, test } = require("@playwright/test");
const { card, installCrmMock } = require("./fixtures.cjs");

test.describe("CRM timing and SLA", () => {
  test("Kanban and detail expose read-only timing without contact data", async ({ page }) => {
    await installCrmMock(page);
    await page.goto("/admin/crm/leads");
    const leadCard = card(page, "lead-a-new");
    await expect(leadCard).toContainText("Tempo na etapa");
    await expect(leadCard).toContainText("SLA não configurado");
    await leadCard.getByRole("button").filter({ hasText: "lead-a-new" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Tempo no funil" })).toBeVisible();
    await expect(dialog).toContainText("Cobertura");
    await expect(dialog).toContainText("Resumo por etapa");
    await expect(dialog).not.toContainText("synthetic@example.invalid");
  });
});
