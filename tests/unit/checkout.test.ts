import { describe, expect, it } from "vitest";
import { proofError, utrSchema, validateCheckout } from "@/lib/checkout/form";
import { deliveryEstimate, formatDays, lineIssue, maxQty, normalizeOrderNumber, normalizePhone, shippingFor } from "@/lib/checkout/rules";
import { upiAmount, upiLink, whatsappLink } from "@/lib/checkout/upi";
import { effectiveStock } from "@/lib/catalog/from-db";
import { settingsFromRow } from "@/lib/settings";

describe("phone and order numbers", () => {
  it("normalises Indian mobile numbers like the database does", () => {
    expect(normalizePhone("+91 98765 43210")).toBe("9876543210");
    expect(normalizePhone("098765-43210")).toBe("9876543210");
    expect(normalizePhone("5876543210")).toBeNull();
    expect(normalizePhone("98765")).toBeNull();
  });

  it("forgives case, spaces and dashes in order numbers", () => {
    expect(normalizeOrderNumber(" kt7h2q-9mxc 4p ")).toBe("KT7H2Q9MXC4P");
  });
});

describe("checkout form", () => {
  const good = { name: "Asha K", phone: "98765 43210", email: "", address: "12 FC Road", pincode: "411005", city: "Pune", state: "Maharashtra" };

  it("accepts a valid guest and normalises fields", () => {
    const r = validateCheckout({ ...good, email: " Asha@Example.com " });
    expect(r).toEqual({ ok: true, values: { ...good, phone: "9876543210", email: "asha@example.com" } });
  });

  it("reports the first problem per field", () => {
    const r = validateCheckout({ ...good, phone: "123", pincode: "011005", email: "nope", name: "A" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["email", "name", "phone", "pincode"]);
  });

  it("checks UTRs and screenshot files", () => {
    expect(utrSchema.parse("4123 5678 9012")).toBe("412356789012");
    expect(utrSchema.safeParse("12").success).toBe(false);
    expect(proofError(new File(["x"], "a.pdf", { type: "application/pdf" }))).toMatch(/photo or screenshot/);
    expect(proofError(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "a.png", { type: "image/png" }))).toMatch(/5 MB/);
    expect(proofError(new File(["x"], "a.png", { type: "image/png" }))).toBeNull();
  });
});

describe("shipping and delivery", () => {
  it("charges the fee below the threshold, nothing above it", () => {
    const s = { shippingFeePaise: 9900, freeShippingThresholdPaise: 200000 };
    expect(shippingFor(150000, s)).toEqual({ feePaise: 9900, free: false, remainingPaise: 50000 });
    expect(shippingFor(200000, s)).toEqual({ feePaise: 0, free: true, remainingPaise: 0 });
    expect(shippingFor(100, { shippingFeePaise: 0, freeShippingThresholdPaise: 0 })).toEqual({ feePaise: 0, free: false, remainingPaise: 0 });
  });

  it("picks the longest matching pincode prefix, or none", () => {
    const zones = [
      { name: "West", prefix: "4", minDays: 3, maxDays: 5 },
      { name: "Pune", prefix: "411", minDays: 1, maxDays: 2 },
    ];
    expect(deliveryEstimate("411005", zones)?.name).toBe("Pune");
    expect(deliveryEstimate("400001", zones)?.name).toBe("West");
    expect(deliveryEstimate("110001", zones)).toBeNull();
    expect(deliveryEstimate("41100", zones)).toBeNull();
    expect(formatDays(zones[1])).toBe("1–2 days");
    expect(formatDays({ minDays: 1, maxDays: 1 })).toBe("1 day");
  });
});

describe("stock mode and cart lines", () => {
  it("ignores counts when tracking is off and treats unset as 0 when on", () => {
    expect(effectiveStock(false, 0)).toBeNull();
    expect(effectiveStock(true, null)).toBe(0);
    expect(effectiveStock(true, 4)).toBe(4);
  });

  it("flags lines that can't be ordered as they are", () => {
    const variants = [
      { size: "M", stock: null },
      { size: "L", stock: 0 },
      { size: "XL", stock: 2 },
    ];
    expect(lineIssue(5, "M", { available: true, variants })).toBeNull();
    expect(lineIssue(1, "L", { available: true, variants })).toEqual({ kind: "sold_out" });
    expect(lineIssue(3, "XL", { available: true, variants })).toEqual({ kind: "reduce", max: 2 });
    expect(lineIssue(1, "S", { available: true, variants })).toEqual({ kind: "unavailable" });
    expect(lineIssue(1, "M", { available: false })).toEqual({ kind: "unavailable" });
    expect(lineIssue(9, "M", { available: true })).toBeNull(); // live data not loaded: server decides
    expect([maxQty(null), maxQty(2), maxQty(0), maxQty(undefined)]).toEqual([5, 2, 1, 5]);
  });
});

describe("UPI and WhatsApp links", () => {
  it("builds the exact upi://pay link", () => {
    expect(upiAmount(129900)).toBe("1299.00");
    expect(upiLink({ upiId: "kittora@okaxis", payee: null, totalPaise: 129950, orderNumber: "KT7H2Q9MXC4P" })).toBe(
      "upi://pay?pa=kittora%40okaxis&pn=KITTORA&am=1299.50&tn=KT7H2Q9MXC4P&cu=INR",
    );
    expect(upiLink({ upiId: "a@b", payee: "Kittora Store", totalPaise: 100, orderNumber: "KT1" })).toContain("pn=Kittora%20Store");
  });

  it("adds India's country code to 10-digit WhatsApp numbers", () => {
    expect(whatsappLink("97647 95606", "Hi, order KT1 (₹1,299)")).toBe(
      `https://wa.me/919764795606?text=${encodeURIComponent("Hi, order KT1 (₹1,299)")}`,
    );
  });

  it("maps settings rows and hides blank values", () => {
    const s = settingsFromRow(
      {
        upi_id: "  ",
        payee_name: null,
        qr_image_path: "payments/qr code.png",
        whatsapp_number: "9764795606",
        unpaid_timeout_minutes: 0,
        shipping_fee_paise: 0,
        free_shipping_threshold_paise: 0,
        contact_email: null,
        contact_phone: null,
        contact_address: null,
        instagram_url: null,
      },
      "https://x.supabase.co/",
    );
    expect(s.upiId).toBeNull();
    expect(s.qrImageUrl).toBe("https://x.supabase.co/storage/v1/object/public/site-assets/payments/qr%20code.png");
  });
});
