import { expect, test } from "@playwright/test";

test("home page renders the hero", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Terrace Archive/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Wear the\s*heritage\./);
});

test("shop filters sync to the URL", async ({ page }) => {
  await page.goto("/shop");
  await expect(page.getByRole("heading", { level: 1, name: "All jerseys" })).toBeVisible();
  const cards = page.locator("main ul > li article");
  await expect(cards).toHaveCount(13);
  await page.goto("/shop?club=Arsenal");
  await expect(cards).toHaveCount(1);
  await page.getByRole("button", { name: "Remove filter Arsenal" }).click();
  await expect(page).toHaveURL(/\/shop$/);
  await expect(cards).toHaveCount(13);
});

test("search matches without accents", async ({ page }) => {
  await page.goto("/search");
  await page.getByRole("searchbox", { name: "Search jerseys" }).fill("mbappe");
  await expect(page).toHaveURL(/q=mbappe/);
  await expect(page.locator("main ul > li article")).toHaveCount(1);
});

test("product page has structured data and a wishlist toggle", async ({ page }) => {
  await page.goto("/product/arsenal-red-and-white-saka-7-jersey");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Arsenal/);
  const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
  expect(JSON.parse(ld!).map((x: { "@type": string }) => x["@type"])).toEqual(["Product", "BreadcrumbList"]);
  const save = page.getByRole("button", { name: /Save .* to wishlist/ }).last();
  await save.click();
  await expect(page.getByRole("button", { name: /Remove .* from wishlist/ }).last()).toHaveAttribute("aria-pressed", "true");
});

test("v1 product links redirect and unknown pages 404", async ({ page }) => {
  await page.goto("/product/6ace0c3a3becfe14cb06a7bd");
  await expect(page).toHaveURL(/\/product\/arsenal-red-and-white-saka-7-jersey$/);
  const res = await page.goto("/no-such-page");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/isn’t on the rail/);
});
