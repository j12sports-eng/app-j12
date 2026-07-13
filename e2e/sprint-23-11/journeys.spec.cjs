const { expect, test } = require("@playwright/test");
const { JOURNEYS } = require("./journey-catalog.cjs");

const IMPLEMENTED = new Set(["J01"]);
const REMAINING_BLOCKER =
  "BLOCKED: functional synthetic fixture and mutation assertions are not yet implemented for this journey.";

test.describe("Sprint 23.11 - 21 canonical browser journeys", () => {
  for (const journey of JOURNEYS) {
    test(`${journey.id} - ${journey.name}`, async ({ page }) => {
      test.skip(!IMPLEMENTED.has(journey.id), REMAINING_BLOCKER);

      const unexpectedExternalRequests = [];
      page.on("request", (request) => {
        const url = new URL(request.url());
        if (
          !["127.0.0.1", "localhost"].includes(url.hostname) &&
          !["data:", "blob:"].includes(url.protocol)
        )
          unexpectedExternalRequests.push(request.url());
      });

      await page.goto("/login");
      await expect(page.getByRole("form", { name: "Login J12" })).toBeVisible();
      await page.getByLabel("E-mail").fill("admin@j12.com");
      await page.locator("#login-password").fill(requiredPassword());
      await page.getByRole("button", { name: "Entrar" }).click();

      await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/);
      await expect(page.getByText("Admin J12", { exact: false }).first()).toBeVisible();
      expect(unexpectedExternalRequests).toEqual([]);
    });
  }
});

function requiredPassword() {
  const password = String(process.env.E2E_AUTH_PASSWORD || "");
  if (!password) throw new Error("E2E_AUTH_PASSWORD is required for functional journeys.");
  return password;
}
