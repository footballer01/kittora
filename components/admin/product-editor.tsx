"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { deleteProduct, getProduct, saveProduct, saveVariants, setStockForAllSizes, type AdminProduct } from "@/lib/admin/api";
import { missingDetails, type DetailField } from "@/lib/admin/needs-details";
import { AUDIENCES, KIT_TYPES, paiseToRupeesInput, parseStock, productSchema, SIZE_PRESET, slugify, type ProductInput } from "@/lib/admin/product-form";
import { toast } from "@/lib/stores/toast";
import { Button } from "@/components/ui/button";
import { SelectField, TextArea, TextField } from "@/components/ui/input";
import { Card, ErrorNote, Loading, PageHeader, Toggle, useLoad } from "./ui";
import { ImageManager, VideoManager } from "./product-media";

const EMPTY: ProductInput = {
  name: "",
  slug: "",
  club: "",
  country: "",
  player: "",
  number: "",
  season: "",
  kit_type: "",
  fit: "",
  audience: [],
  price: "",
  description: "",
  story_title: "",
  story: "",
  published: true,
  featured: false,
  featured_position: "",
  track_stock: false,
};

function toInput(p: AdminProduct): ProductInput {
  return {
    name: p.name,
    slug: p.slug,
    club: p.club ?? "",
    country: p.country ?? "",
    player: p.player ?? "",
    number: p.number == null ? "" : String(p.number),
    season: p.season ?? "",
    kit_type: p.kit_type ?? "",
    fit: p.fit ?? "",
    audience: p.audience,
    price: paiseToRupeesInput(p.price_paise),
    description: p.description ?? "",
    story_title: p.story_title ?? "",
    story: p.story ?? "",
    published: p.published,
    featured: p.featured,
    featured_position: p.featured_position == null ? "" : String(p.featured_position),
    track_stock: p.track_stock,
  };
}

const KIT_LABEL: Record<(typeof KIT_TYPES)[number], string> = { home: "Home", away: "Away", third: "Third", retro: "Retro", special: "Special edition" };

export function ProductEditor() {
  const id = useSearchParams().get("id");
  const product = useLoad(() => (id ? getProduct(id) : Promise.resolve(null)), [id]);
  if (product.error) return <ErrorNote message={product.error} onRetry={product.reload} />;
  if (product.loading) return <Loading />;
  // Remount the form when a different product (or a new one) loads.
  return <Form key={`${id}-${product.data?.updated_at}`} product={product.data ?? null} reload={product.reload} />;
}

function Form({ product, reload }: { product: AdminProduct | null; reload: () => void }) {
  const router = useRouter();
  const [v, setV] = useState<ProductInput>(product ? toInput(product) : EMPTY);
  const [slugTouched, setSlugTouched] = useState(!!product);
  const [sizes, setSizes] = useState(
    (product?.variants ?? SIZE_PRESET.map((size, i) => ({ id: "", size, stock: null, position: i }))).map((x) => ({ size: x.size, stock: x.stock == null ? "" : String(x.stock) })),
  );
  const [newSize, setNewSize] = useState("");
  const [allStock, setAllStock] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof ProductInput>(k: K, value: ProductInput[K]) => setV((s) => ({ ...s, [k]: value }));
  const missing = new Set<DetailField>(
    (() => {
      const m = missingDetails({
        club: v.club,
        country: v.country,
        season: v.season,
        kit_type: v.kit_type || null,
        fit: v.fit,
        description: v.description,
        audience: v.audience,
        player: v.player,
        number: v.number === "" ? null : Number(v.number),
        product_images: product?.product_images ?? [],
      });
      return [...m.required, ...m.optional];
    })(),
  );
  const hint = (f: DetailField, extra?: ReactNode) =>
    missing.has(f) ? <span className="text-warning">Empty — needs details{extra ? <> · {extra}</> : null}</span> : undefined;
  const mark = (f: DetailField) => (missing.has(f) ? "rounded-[calc(var(--radius-input)+4px)] ring-2 ring-warning/60 ring-offset-4 ring-offset-surface" : "");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = productSchema.safeParse(v);
    const stockValues = sizes.map((s) => ({ size: s.size, stock: parseStock(s.stock) }));
    const badStock = stockValues.find((s) => s.stock === "invalid");
    if (!parsed.success || badStock) {
      const errs: Record<string, string> = {};
      if (!parsed.success) for (const issue of parsed.error.issues) errs[String(issue.path[0])] ??= issue.message;
      if (badStock) errs.sizes = `Stock for ${badStock.size} must be a whole number (or empty).`;
      setErrors(errs);
      toast("Check the highlighted fields.", "warning");
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const { price, ...rest } = parsed.data;
      const savedId = await saveProduct(product?.id ?? null, { ...rest, price_paise: price });
      await saveVariants(savedId, product?.variants ?? [], stockValues as { size: string; stock: number | null }[]);
      toast(product ? "Saved. Publish changes to update the shop pages." : "Product created. Now add photos.", "success");
      if (product) reload();
      else router.replace(`/admin/products/edit?id=${savedId}`);
    } catch (err) {
      toast((err as Error).message, "warning");
    } finally {
      setSaving(false);
    }
  }

  async function onSetAll() {
    const n = parseStock(allStock);
    if (!product || n === null || n === "invalid") return toast("Enter a whole number, e.g. 10.", "warning");
    try {
      await setStockForAllSizes(product.id, n);
      setSizes((s) => s.map((x) => ({ ...x, stock: String(n) })));
      toast(`Every size now has ${n} in stock.`, "success");
    } catch (err) {
      toast((err as Error).message, "warning");
    }
  }

  async function onDelete() {
    if (!product || !window.confirm(`Delete “${product.name}” for good? Past orders keep their details.`)) return;
    try {
      await deleteProduct(product.id);
      toast("Product deleted.", "success");
      router.replace("/admin/products");
    } catch (err) {
      toast((err as Error).message, "warning");
    }
  }

  const addSize = (size: string) => {
    const s = size.trim().toUpperCase().slice(0, 10);
    if (!s || sizes.some((x) => x.size === s)) return;
    setSizes((x) => [...x, { size: s, stock: "" }]);
    setNewSize("");
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-6 pb-24" noValidate>
      <PageHeader
        title={product ? product.name : "New product"}
        intro={
          product ? (
            <>
              <a href={`/product/${product.slug}`} target="_blank" rel="noopener" className="underline underline-offset-4">
                View in shop
              </a>{" "}
              · Shop pages update after you publish.
            </>
          ) : (
            "Save once to add photos and video."
          )
        }
      />

      <Card title="Basics">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Name"
            value={v.name}
            error={errors.name}
            onChange={(e) => {
              set("name", e.target.value);
              if (!slugTouched) set("slug", slugify(e.target.value));
            }}
            className="sm:col-span-2"
            required
          />
          <TextField label="Price (₹)" inputMode="decimal" value={v.price} error={errors.price} onChange={(e) => set("price", e.target.value)} required />
          <TextField
            label="Web address"
            value={v.slug}
            error={errors.slug}
            hint={product ? "Changing this changes the page link." : "Filled in from the name."}
            onChange={(e) => {
              setSlugTouched(true);
              set("slug", e.target.value);
            }}
            spellCheck={false}
            autoCapitalize="none"
          />
        </div>
        <div className="mt-4 grid gap-3 border-t border-line pt-4">
          <Toggle label="Show in shop" hint="Off hides it from the shop (it stays here)." checked={v.published} onChange={(x) => set("published", x)} />
          <Toggle label="Featured on home page" checked={v.featured} onChange={(x) => set("featured", x)} />
          {v.featured && (
            <TextField label="Featured order (1 = first)" inputMode="numeric" value={v.featured_position} error={errors.featured_position} onChange={(e) => set("featured_position", e.target.value)} />
          )}
        </div>
      </Card>

      <Card title="Details">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Club" value={v.club} onChange={(e) => set("club", e.target.value)} hint={hint("club", "Club or country is enough")} className={mark("club")} />
          <TextField label="Country" value={v.country} onChange={(e) => set("country", e.target.value)} hint={hint("club", "Club or country is enough")} className={mark("club")} />
          <TextField label="Player" value={v.player} onChange={(e) => set("player", e.target.value)} hint={missing.has("player") ? "Optional" : undefined} />
          <TextField label="Shirt number" inputMode="numeric" value={v.number} error={errors.number} onChange={(e) => set("number", e.target.value)} hint={missing.has("number") ? "Optional, 0–99" : undefined} />
          <TextField label="Season" placeholder="e.g. 2024/25" value={v.season} onChange={(e) => set("season", e.target.value)} hint={hint("season")} className={mark("season")} />
          <SelectField label="Kit type" value={v.kit_type} onChange={(e) => set("kit_type", e.target.value as ProductInput["kit_type"])} hint={hint("kit_type")} className={mark("kit_type")}>
            <option value="">Not set</option>
            {KIT_TYPES.map((k) => (
              <option key={k} value={k}>
                {KIT_LABEL[k]}
              </option>
            ))}
          </SelectField>
          <TextField label="Fit" placeholder="e.g. Fan version" value={v.fit} onChange={(e) => set("fit", e.target.value)} hint={hint("fit")} className={mark("fit")} />
          <fieldset className={cn("grid content-start gap-2", mark("audience"))}>
            <legend className="mb-1.5 text-step-n1 font-medium">Shown under</legend>
            <div className="flex flex-wrap gap-2">
              {AUDIENCES.map((a) => {
                const on = v.audience.includes(a);
                return (
                  <label key={a} className={cn("inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border px-4 capitalize", on ? "border-ink bg-ink text-bg" : "border-line-strong")}>
                    <input type="checkbox" className="sr-only" checked={on} onChange={() => set("audience", on ? v.audience.filter((x) => x !== a) : [...v.audience, a])} />
                    {a}
                  </label>
                );
              })}
            </div>
            {missing.has("audience") && <p className="text-step-n1 text-warning">Empty — needs details</p>}
          </fieldset>
        </div>
      </Card>

      <Card title="Description and story">
        <div className="grid gap-4">
          <TextArea label="Description" rows={5} value={v.description} onChange={(e) => set("description", e.target.value)} hint={hint("description")} className={mark("description")} />
          <TextField label="Story title (optional)" value={v.story_title} onChange={(e) => set("story_title", e.target.value)} />
          <TextArea label="Kit story (optional)" rows={5} value={v.story} onChange={(e) => set("story", e.target.value)} hint="Shown on the product page when filled in." />
        </div>
      </Card>

      <Card title="Photos">
        {product ? (
          <ImageManager product={product} onChanged={reload} missing={{ front: missing.has("front_image"), back: missing.has("back_image") }} />
        ) : (
          <p className="text-step-n1 text-ink-muted">Save the product first, then add photos here.</p>
        )}
      </Card>

      <Card title="Video (optional)">
        {product ? <VideoManager product={product} onChanged={reload} /> : <p className="text-step-n1 text-ink-muted">Save the product first.</p>}
      </Card>

      <Card title="Sizes and stock">
        <Toggle
          label="Track stock"
          hint={v.track_stock ? "On: each size sells only while it has stock. 0 shows as sold out." : "Off: every size can always be ordered, and no stock messages show."}
          checked={v.track_stock}
          onChange={(x) => set("track_stock", x)}
        />
        {errors.sizes && <p className="mt-3 text-step-n1 text-brand-text">{errors.sizes}</p>}
        <ul className={cn("mt-4 grid gap-2", !v.track_stock && "opacity-60")}>
          {sizes.map((s, i) => (
            <li key={s.size} className="flex items-end gap-2">
              <TextField
                label={`Stock for ${s.size}`}
                inputMode="numeric"
                value={s.stock}
                placeholder={v.track_stock ? "0" : "Not tracked"}
                onChange={(e) => setSizes((x) => x.map((y, j) => (j === i ? { ...y, stock: e.target.value } : y)))}
                className="min-w-0 flex-1"
              />
              <Button variant="ghost" size="lg" aria-label={`Remove size ${s.size}`} onClick={() => setSizes((x) => x.filter((_, j) => j !== i))}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-end gap-2">
          <TextField label="Add a size" value={newSize} onChange={(e) => setNewSize(e.target.value)} placeholder="e.g. XXL or 10-11Y" className="min-w-0 flex-1" />
          <Button variant="secondary" size="lg" onClick={() => addSize(newSize)}>
            Add
          </Button>
        </div>
        {product && v.track_stock && (
          <div className="mt-4 flex items-end gap-2 border-t border-line pt-4">
            <TextField label="Set stock for all sizes" inputMode="numeric" value={allStock} onChange={(e) => setAllStock(e.target.value)} placeholder="e.g. 10" className="min-w-0 flex-1" />
            <Button variant="secondary" size="lg" onClick={() => void onSetAll()}>
              Set all
            </Button>
          </div>
        )}
      </Card>

      {product && (
        <div className="flex justify-end">
          <Button variant="ghost" className="text-brand-text" onClick={() => void onDelete()}>
            Delete product
          </Button>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl justify-end gap-2">
          <Button type="submit" size="lg" loading={saving} className="w-full sm:w-auto">
            {product ? "Save changes" : "Create product"}
          </Button>
        </div>
      </div>
    </form>
  );
}

