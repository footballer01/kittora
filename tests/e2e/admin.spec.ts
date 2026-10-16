import { expect, test, type Page } from "@playwright/test";
import { mockAdmin, PASSWORD } from "./mock-admin";

// Admin panel against a mocked Supabase. SHOTS=1 saves 390px screenshots.
const shot = async (page: Page, name: string) => {
  // 16px side gutter. Edge-to-edge chip scrollers and the fixed save bar are exempt.
  const limit = page.viewportSize()!.width - 16;
  const wide = await page.evaluate(
    (max) =>
      [...document.querySelectorAll("main *")]
        .filter((el) => {
          if (el.closest(".sr-only")) return false;
          for (let a: Element | null = el; a; a = a.parentElement) {
            const st = getComputedStyle(a);
            if (st.overflowX === "auto" || st.position === "fixed") return false;
          }
          return el.getBoundingClientRect().right > max + 0.5;
        })
        .map((el) => `<${el.tagName.toLowerCase()} class="${el.getAttribute("class") ?? ""}">`),
    limit,
  );
  expect(wide, `${name} breaks the right gutter`).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} scrolls sideways`).toBe(true);
  if (process.env.SHOTS && test.info().project.name === "mobile") {
    await page.waitForTimeout(400);
    await page.screenshot({ path: `screenshots/phase4-admin-${name}-390.png`, fullPage: true });
  }
};

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Username").fill("keeper");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

test("admin pages are noindex and redirect to sign-in without a session", async ({ page }) => {
  await mockAdmin(page);
  await page.goto("/admin/orders");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  const sitemap = await (await page.request.get("/sitemap.xml")).text();
  expect(sitemap).not.toContain("/admin");
});

test("sign-in shows one generic error for a wrong password", async ({ page }) => {
  await mockAdmin(page);
  await page.goto("/admin/login");
  await page.getByLabel("Username").fill("keeper");
  await page.getByLabel("Password").fill("wrong password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("That username and password don't match.");
});

test("dashboard, verifying a payment and editing a product", async ({ page }) => {
  const calls = await mockAdmin(page);
  await signIn(page);
  await expect(page.getByRole("link", { name: /Payments to verify\s*2/ })).toBeVisible();
  await expect(page.getByText("Order marked paid")).toBeVisible();
  await expect(page.getByText("Live — last published")).toBeVisible();
  await shot(page, "dashboard");

  await page.getByRole("link", { name: /Payments to verify/ }).click();
  const order = page.getByRole("article", { name: "Order KT7H2Q9MXC4P" });
  await expect(order.getByText("412398765432")).toBeVisible();
  await shot(page, "orders");
  await order.getByRole("button", { name: "Mark paid" }).click();
  await expect.poll(() => calls.status).toEqual([{ p_order: "o1", p_status: "paid", p_note: null }]);

  await page.getByRole("link", { name: "Products", exact: true }).click();
  await page.getByRole("button", { name: /Needs details/ }).click();
  await expect(page).toHaveURL(/filter=needs/);
  await page.getByRole("link", { name: /Real Madrid Green/ }).click();
  await expect(page.getByText("Empty — needs details").first()).toBeVisible();
  await expect(page.getByRole("switch", { name: /Track stock/ })).toBeChecked();
  await shot(page, "product-edit");
  await page.getByLabel("Fit").fill("Fan version");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect.poll(() => calls.productUpdates.length).toBe(1);
  expect(calls.productUpdates[0]).toMatchObject({ fit: "Fan version", price_paise: 90000 });
});
