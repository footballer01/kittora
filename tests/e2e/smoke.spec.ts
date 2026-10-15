import { expect, test } from "@playwright/test";

test("home page renders the hero", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Terrace Archive/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Wear the\s*heritage\./);
});
