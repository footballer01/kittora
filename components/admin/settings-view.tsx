"use client";

import { useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { getSettings, publicUrl, saveSettings, uploadQr, type SettingsRow } from "@/lib/admin/api";
import { normalizePhone } from "@/lib/checkout/rules";
import { paiseToRupeesInput } from "@/lib/admin/product-form";
import { toast } from "@/lib/stores/toast";
import { Button } from "@/components/ui/button";
import { TextArea, TextField } from "@/components/ui/input";
import { Card, ErrorNote, Loading, PageHeader, useLoad } from "./ui";

// Everything the storefront shows about payment, shipping, contact and
// policies. Empty fields are hidden in the shop. Changes apply instantly.

const TEXT = [
  "upi_id",
  "payee_name",
  "whatsapp_number",
  "contact_email",
  "contact_phone",
  "contact_address",
  "instagram_url",
  "facebook_url",
  "youtube_url",
  "x_url",
  "shipping_policy",
  "returns_policy",
  "terms_text",
  "privacy_text",
] as const;
type Key = (typeof TEXT)[number] | "unpaid_timeout_minutes" | "shipping_fee" | "free_shipping_threshold";
type Draft = Record<Key, string>;

const rupees = z
  .string()
  .trim()
  .refine((s) => s === "" || /^\d{1,7}(\.\d{1,2})?$/.test(s), "Enter rupees, e.g. 99")
  .transform((s) => (s === "" ? 0 : Math.round(Number(s) * 100)));
const https = z
  .string()
  .trim()
  .refine((s) => s === "" || /^https:\/\/\S+$/.test(s), "Paste the full link starting with https://");
const opt = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters`);

const schema = z.object({
  upi_id: z
    .string()
    .trim()
    .refine((s) => s === "" || /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/.test(s), "A UPI ID looks like name@bank"),
  payee_name: opt(60),
  whatsapp_number: z
    .string()
    .trim()
    .refine((s) => s === "" || normalizePhone(s) !== null, "A 10-digit Indian mobile number"),
  unpaid_timeout_minutes: z
    .string()
    .trim()
    .refine((s) => /^\d{1,5}$/.test(s || "0"), "Whole minutes, e.g. 1440 for a day")
    .transform((s) => Number(s || "0")),
  shipping_fee: rupees,
  free_shipping_threshold: rupees,
  contact_email: z
    .string()
    .trim()
    .refine((s) => s === "" || z.email().safeParse(s).success, "Enter a valid email"),
  contact_phone: opt(30),
  contact_address: opt(300),
  instagram_url: https,
  facebook_url: https,
  youtube_url: https,
  x_url: https,
  shipping_policy: opt(20000),
  returns_policy: opt(20000),
  terms_text: opt(20000),
  privacy_text: opt(20000),
});

function toDraft(s: SettingsRow): Draft {
  const d = Object.fromEntries(TEXT.map((k) => [k, (s[k] as string | null) ?? ""])) as Draft;
  d.unpaid_timeout_minutes = String(s.unpaid_timeout_minutes ?? 0);
  d.shipping_fee = (s.shipping_fee_paise as number) ? paiseToRupeesInput(s.shipping_fee_paise as number) : "";
  d.free_shipping_threshold = (s.free_shipping_threshold_paise as number) ? paiseToRupeesInput(s.free_shipping_threshold_paise as number) : "";
  return d;
}

export function SettingsView() {
  const settings = useLoad(getSettings);
  if (settings.error) return <ErrorNote message={settings.error} onRetry={settings.reload} />;
  if (!settings.data) return <Loading />;
  return <Form row={settings.data} reload={settings.reload} />;
}

function Form({ row, reload }: { row: SettingsRow; reload: () => void }) {
  const [d, setD] = useState<Draft>(() => toDraft(row));
  const [qr, setQr] = useState<string | null>((row.qr_image_path as string | null) ?? null);
  const [errors, setErrors] = useState<Partial<Record<Key, string>>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const qrInput = useRef<HTMLInputElement>(null);

  const field = (k: Key, label: string, extra: Record<string, unknown> = {}) => (
    <TextField label={label} value={d[k]} error={errors[k]} onChange={(e) => setD({ ...d, [k]: e.target.value })} {...extra} />
  );
  const area = (k: Key, label: string, hint?: string) => (
    <TextArea label={label} rows={6} value={d[k]} error={errors[k]} hint={hint} onChange={(e) => setD({ ...d, [k]: e.target.value })} />
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(d);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])));
      toast("Check the highlighted fields.", "warning");
      return;
    }
    setErrors({});
    const { shipping_fee, free_shipping_threshold, ...rest } = parsed.data;
    const values: SettingsRow = { ...Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, v === "" ? null : v])), qr_image_path: qr };
    values.whatsapp_number = rest.whatsapp_number ? normalizePhone(rest.whatsapp_number) : null;
    values.shipping_fee_paise = shipping_fee;
    values.free_shipping_threshold_paise = free_shipping_threshold;
    setSaving(true);
    try {
      await saveSettings(values);
      toast("Settings saved. The shop uses them right away.", "success");
      reload();
    } catch (err) {
      toast((err as Error).message, "warning");
    } finally {
      setSaving(false);
    }
  }

  async function onQr(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      setQr(await uploadQr(file));
      toast("QR uploaded. Save settings to use it.", "success");
    } catch (err) {
      toast((err as Error).message, "warning");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 pb-24" noValidate>
      <PageHeader title="Settings" intro="Empty fields are hidden in the shop." />

      <Card title="Payment (UPI)">
        <div className="grid gap-4 sm:grid-cols-2">
          {field("upi_id", "UPI ID", { placeholder: "e.g. kittora@okhdfcbank", autoCapitalize: "none", spellCheck: false, hint: "The pay page makes a QR with the exact amount from this." })}
          {field("payee_name", "Payee name", { hint: "Shown in the customer's UPI app." })}
          {field("whatsapp_number", "WhatsApp number", { inputMode: "tel", hint: "Customers can ask for the UPI ID here." })}
          {field("unpaid_timeout_minutes", "Cancel unpaid orders after (minutes)", {
            inputMode: "numeric",
            hint: "0 = never. Orders holding tracked stock still expire after 48 hours.",
          })}
        </div>
        <div className="mt-4 grid gap-3 border-t border-line pt-4">
          <p className="font-medium">Your own QR image (optional)</p>
          <p className="text-step-n1 text-ink-muted">Used only when no UPI ID is set. The amount is written beside it.</p>
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element -- public site asset
            <img src={publicUrl("site-assets", qr)} alt="Payment QR" className="size-40 rounded-xl bg-white object-contain p-2" />
          )}
          <input ref={qrInput} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Upload QR image" tabIndex={-1} onChange={(e) => void onQr(e.target.files?.[0])} />
          <div className="grid gap-2 sm:flex">
            <Button variant="secondary" size="lg" loading={uploading} onClick={() => qrInput.current?.click()}>
              {qr ? "Replace QR image" : "Upload QR image"}
            </Button>
            {qr && (
              <Button variant="ghost" size="lg" onClick={() => setQr(null)}>
                Remove QR image
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card title="Shipping">
        <div className="grid gap-4 sm:grid-cols-2">
          {field("shipping_fee", "Shipping fee (₹)", { inputMode: "decimal", placeholder: "0", hint: "Empty or 0 = free shipping." })}
          {field("free_shipping_threshold", "Free shipping from (₹)", { inputMode: "decimal", placeholder: "0", hint: "Orders at or above this ship free. Empty = off." })}
        </div>
      </Card>

      <Card title="Contact">
        <div className="grid gap-4 sm:grid-cols-2">
          {field("contact_email", "Email", { type: "email", autoCapitalize: "none" })}
          {field("contact_phone", "Phone", { inputMode: "tel" })}
          <div className="sm:col-span-2">
            <TextArea label="Address" rows={3} value={d.contact_address} error={errors.contact_address} onChange={(e) => setD({ ...d, contact_address: e.target.value })} />
          </div>
        </div>
      </Card>

      <Card title="Social links">
        <div className="grid gap-4 sm:grid-cols-2">
          {field("instagram_url", "Instagram", { type: "url", placeholder: "https://instagram.com/…" })}
          {field("facebook_url", "Facebook", { type: "url", placeholder: "https://facebook.com/…" })}
          {field("youtube_url", "YouTube", { type: "url", placeholder: "https://youtube.com/…" })}
          {field("x_url", "X (Twitter)", { type: "url", placeholder: "https://x.com/…" })}
        </div>
      </Card>

      <Card title="Policy pages">
        <p className="mb-4 text-step-n1 text-ink-muted">Plain text. Leave a blank line between paragraphs. Each page says &ldquo;being written&rdquo; until filled in.</p>
        <div className="grid gap-4">
          {area("shipping_policy", "Shipping (/shipping)")}
          {area("returns_policy", "Returns & exchanges (/returns)")}
          {area("terms_text", "Terms of sale (/terms)")}
          {area("privacy_text", "Privacy (/privacy)")}
        </div>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl justify-end">
          <Button type="submit" size="lg" loading={saving} className="w-full sm:w-auto">
            Save settings
          </Button>
        </div>
      </div>
    </form>
  );
}
