import { z } from "zod";
import { isPincode, normalizePhone } from "./rules";

// Checkout form. The same limits are enforced again by place_order().
export const checkoutSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80, "Use at most 80 characters"),
  phone: z
    .string()
    .trim()
    .refine((s) => normalizePhone(s) !== null, "Enter a 10-digit Indian mobile number")
    .transform((s) => normalizePhone(s)!),
  email: z
    .string()
    .trim()
    .max(254)
    .refine((s) => s === "" || z.email().safeParse(s).success, "Enter a valid email, or leave it empty")
    .transform((s) => s.toLowerCase()),
  address: z.string().trim().min(5, "Enter your house, street and area").max(300, "Use at most 300 characters"),
  pincode: z.string().trim().refine(isPincode, "Enter a 6-digit pincode"),
  city: z.string().trim().min(2, "Enter your city").max(80),
  state: z.string().trim().min(2, "Enter your state").max(80),
});

export type CheckoutInput = z.input<typeof checkoutSchema>;
export type CheckoutValues = z.output<typeof checkoutSchema>;
export type CheckoutErrors = Partial<Record<keyof CheckoutInput, string>>;

export function validateCheckout(input: CheckoutInput): { ok: true; values: CheckoutValues } | { ok: false; errors: CheckoutErrors } {
  const r = checkoutSchema.safeParse(input);
  if (r.success) return { ok: true, values: r.data };
  const errors: CheckoutErrors = {};
  for (const issue of r.error.issues) {
    const key = issue.path[0] as keyof CheckoutInput;
    errors[key] ??= issue.message;
  }
  return { ok: false, errors };
}

export const utrSchema = z
  .string()
  .transform((s) => s.replace(/\s/g, "").toUpperCase())
  .refine((s) => /^[A-Z0-9]{6,35}$/.test(s), "Enter the UPI reference (UTR) from your payment app, usually 12 digits");

export const PROOF_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
export const PROOF_MAX_BYTES = 5 * 1024 * 1024;

export function proofError(file: File): string | null {
  if (!PROOF_TYPES.includes(file.type)) return "Choose a photo or screenshot (JPG, PNG, WebP or HEIC)";
  if (file.size > PROOF_MAX_BYTES) return "The screenshot must be 5 MB or smaller";
  return null;
}
