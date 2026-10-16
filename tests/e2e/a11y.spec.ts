import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { mockAdmin, PASSWORD } from "./mock-admin";
import { mockSupabase } from "./mock-supabase";

// One axe scan per key page: no serious or critical violations.
const serious = async (page: import("@playwright/test").Page) =>
  (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);

for (const path of ["/", "/shop", "/product/arsenal-red-and-white-saka-7-jersey", "/cart", "/checkout", "/track", "/shipping"]) {
  test(`axe: ${path}`, async ({ page }) => {
    await mockSupabase(page);
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(await serious(page)).toEqual([]);
  });
}

test("axe: admin pages", async ({ page }) => {
  await mockAdmin(page);
  await page.goto("/admin/login");
  expect(await serious(page), "login").toEqual([]);
  await page.getByLabel("Username").fill("keeper");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  for (const path of ["/admin", "/admin/orders", "/admin/products", "/admin/products/edit?id=00000000-0000-4000-8000-000000000001", "/admin/settings", "/admin/zones", "/admin/edits"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("main h1")).toBeVisible();
    expect(await serious(page), path).toEqual([]);
  }
});
