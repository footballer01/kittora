import { expect, test } from "@playwright/test";
import { mockSupabase, NUMBER } from "./mock-supabase";

// The whole guest flow against a mocked Supabase: cart → checkout → UPI pay
// page → UTR → tracking. Set SHOTS=1 to save 390px screenshots.
const shot = async (page: import("@playwright/test").Page, name: string) => {
  // Every step keeps the 16px side gutter (and so never scrolls sideways).
  const limit = page.viewportSize()!.width - 16;
  const wide = await page.evaluate(
    (max) =>
      [...document.querySelectorAll("main *")]
        .filter((el) => !el.closest(".sr-only") && el.getBoundingClientRect().right > max + 0.5)
        .map((el) => `<${el.tagName.toLowerCase()} class="${el.getAttribute("class") ?? ""}">`),
    limit,
  );
  expect(wide, `${name} breaks the right gutter`).toEqual([]);
  if (process.env.SHOTS && test.info().project.name === "mobile") {
    await page.waitForTimeout(400);
    await page.screenshot({ path: `screenshots/phase3-${name}-390.png`, fullPage: true });
  }
};

test("guest checkout, UPI payment and tracking", async ({ page, isMobile }) => {
  let status = "awaiting_payment";
  const calls = await mockSupabase(page, { status: () => status });

  await page.goto("/product/arsenal-red-and-white-saka-7-jersey");
  await page.locator("label", { hasText: /^M$/ }).first().click();
  await page.getByRole("button", { name: "Add to cart" }).first().click();
  await page.goto("/cart");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Cart");
  await expect(page.getByRole("link", { name: /Arsenal/ }).first()).toBeVisible();
  await expect(page.getByText("₹999")).toBeVisible(); // ₹900 + ₹99 shipping from Settings
  await shot(page, "cart");

  await page.getByRole("link", { name: "Checkout" }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByText("Enter your full name")).toBeVisible();
  await page.getByLabel("Full name").fill("Asha Kulkarni");
  await page.getByLabel("Mobile number").fill("98765 43210");
  await page.getByLabel("Address").fill("12 FC Road, Shivajinagar");
  await page.getByLabel("Pincode").fill("411005");
  await expect(page.getByLabel("City")).toHaveValue("Pune");
  await expect(page.getByLabel("State")).toHaveValue("Maharashtra");
  await expect(page.getByText("Usually delivered in 2–4 days")).toBeVisible();
  await shot(page, "checkout");
  await page.getByRole("button", { name: /Place order/ }).click();

  await expect(page).toHaveURL(new RegExp(`/order/${NUMBER}/pay$`));
  expect(calls.placeOrder).toHaveLength(1);
  const sent = calls.placeOrder[0] as { items: Record<string, unknown>[]; customer: Record<string, string> };
  expect(sent.items).toEqual([{ slug: "arsenal-red-and-white-saka-7-jersey", size: "M", qty: 1 }]); // never a price
  expect(sent.customer.phone).toBe("9876543210");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pay ₹999 by UPI");
  await expect(page.getByRole("img", { name: /UPI QR code to pay ₹999/ })).toBeVisible();
  await expect(page.getByText("Scan this QR in any UPI app to pay ₹999. You can also request the UPI ID on WhatsApp at 9764795606.")).toBeVisible();
  const upi = page.getByRole("link", { name: "Pay with UPI app" });
  if (isMobile) await expect(upi).toHaveAttribute("href", `upi://pay?pa=kittora%40upi&pn=KITTORA&am=999.00&tn=${NUMBER}&cu=INR`);
  else await expect(upi).toBeHidden();
  const wa = await page.getByRole("link", { name: /WhatsApp/ }).first().getAttribute("href");
  expect(decodeURIComponent(wa!)).toContain(`https://wa.me/919764795606?text=Hi, I'd like the UPI ID to pay for order ${NUMBER} (₹999)`);
  await expect(page.getByRole("link", { name: "Cart, empty" }).or(page.getByRole("button", { name: "Cart, empty" }))).toBeVisible();
  await shot(page, "pay");

  await page.getByLabel("UPI reference (UTR)").fill("12");
  await page.getByRole("button", { name: "Submit payment details" }).click();
  await expect(page.getByText(/Enter the UPI reference/)).toBeVisible();
  await page.getByLabel("UPI reference (UTR)").fill("4123 5678 9012");
  await page.getByRole("button", { name: "Submit payment details" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/payment details received/);
  expect(calls.submitPayment[0]).toMatchObject({ p_number: NUMBER, p_phone: "9876543210", p_utr: "412356789012" });

  status = "shipped";
  await page.goto(`/track?n=${NUMBER}`);
  await expect(page.getByRole("heading", { level: 2, name: new RegExp(`${NUMBER} · Shipped`) })).toBeVisible();
  await expect(page.locator('[aria-current="step"]')).toContainText("Shipped");
  await shot(page, "track");
});

test("tracking needs the matching phone and never says which part was wrong", async ({ page }) => {
  await mockSupabase(page);
  await page.route("**/rest/v1/rpc/track_order", (r) =>
    r.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "null" }),
  );
  await page.goto("/track");
  await page.getByLabel("Order number").fill("kt7h2q9mxc4p");
  await page.getByLabel("Mobile number").fill("9000000000");
  await page.getByRole("button", { name: "Track" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText(/couldn't find an order with that number and mobile number/);
});

test("pay page asks for the phone when opened on another device", async ({ page }) => {
  await mockSupabase(page);
  await page.goto(`/order/${NUMBER}/pay`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Open your order");
  await page.getByLabel("Mobile number").fill("9876543210");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pay ₹999 by UPI");
});
