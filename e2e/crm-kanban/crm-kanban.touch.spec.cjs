const { expect, test } = require("@playwright/test");
const { card, column, installCrmMock } = require("./fixtures.cjs");

test("touch pointer moves a card and mobile layout remains usable", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Touch validation runs in the touch project.");
  const state = await installCrmMock(page);
  await page.goto("/admin/crm/leads");
  await expect(page.getByRole("heading", { name: "Leads", exact: true })).toBeVisible();
  const handle = page.getByRole("button", { name: "Arrastar lead lead-a-new" });
  await handle.scrollIntoViewIfNeeded();
  await expect(handle).toBeVisible();
  expect(await handle.evaluate((element) => getComputedStyle(element).touchAction)).toBe("none");
  expect(await handle.evaluate((element) => getComputedStyle(element).userSelect)).toBe("none");
  expect(
    await page.locator("body").evaluate((body) => getComputedStyle(body).touchAction),
  ).not.toBe("none");
  const from = await handle.boundingBox();
  const destination = column(page, "CONTACTED");
  if (!from) throw new Error("Touch source bounds unavailable.");
  const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  await handle.dispatchEvent("pointerdown", {
    bubbles: true,
    cancelable: true,
    pointerId: 7,
    pointerType: "touch",
    isPrimary: true,
    buttons: 1,
    clientX: start.x,
    clientY: start.y,
  });
  await handle.dispatchEvent("pointermove", {
    bubbles: true,
    cancelable: true,
    pointerId: 7,
    pointerType: "touch",
    isPrimary: true,
    buttons: 1,
    clientX: start.x + 12,
    clientY: start.y,
  });
  const overlay = page.getByText("Movendo lead", { exact: true });
  await expect(overlay).toBeVisible();
  const overlayBox = await overlay.boundingBox();
  const viewport = page.viewportSize();
  expect(overlayBox.x).toBeGreaterThanOrEqual(0);
  expect(overlayBox.y).toBeGreaterThanOrEqual(0);
  expect(overlayBox.x + overlayBox.width).toBeLessThanOrEqual(viewport.width);
  expect(overlayBox.y + overlayBox.height).toBeLessThanOrEqual(viewport.height);
  await destination.evaluate((element) =>
    element.scrollIntoView({ behavior: "instant", block: "nearest", inline: "center" }),
  );
  const to = await destination.boundingBox();
  if (!to) throw new Error("Touch destination bounds unavailable.");
  const end = { x: to.x + to.width / 2, y: to.y + 100 };
  for (let step = 1; step <= 12; step += 1) {
    await destination.dispatchEvent("pointermove", {
      bubbles: true,
      cancelable: true,
      pointerId: 7,
      pointerType: "touch",
      isPrimary: true,
      buttons: 1,
      clientX: start.x + 12 + ((end.x - start.x - 12) * step) / 12,
      clientY: start.y + ((end.y - start.y) * step) / 12,
    });
  }
  await expect(destination).toHaveClass(/border-primary/);
  await destination.dispatchEvent("pointerup", {
    bubbles: true,
    cancelable: true,
    pointerId: 7,
    pointerType: "touch",
    isPrimary: true,
    buttons: 0,
    clientX: end.x,
    clientY: end.y,
  });
  await expect.poll(() => state.patchRequests.length).toBe(1);
  await expect(column(page, "CONTACTED").filter({ has: card(page, "lead-a-new") })).toBeVisible();
  await expect(page.getByRole("button", { name: "Alterar estágio" }).first()).toBeVisible();
  expect(await page.locator("body").evaluate((body) => body.scrollWidth >= body.clientWidth)).toBe(
    true,
  );
});

test("tablet and mobile dialog stay inside the viewport", async ({ page }) => {
  await installCrmMock(page);
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("/admin/crm/leads");
  await expect(page.getByRole("heading", { name: "Leads", exact: true })).toBeVisible();
  const manualButtons = page.getByRole("button", { name: "Alterar estágio" });
  const count = await manualButtons.count();
  expect(count).toBeGreaterThan(0);
  await manualButtons.first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(768);
  expect(box.y + box.height).toBeLessThanOrEqual(900);
});
