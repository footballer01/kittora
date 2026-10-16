"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { formatPaise } from "@/lib/money";
import { listProducts, publicUrl, type AdminProduct } from "@/lib/admin/api";
import { DETAIL_LABELS, missingDetails, needsDetails } from "@/lib/admin/needs-details";
import { ButtonLink } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { Chip, ErrorNote, Loading, PageHeader, useLoad } from "./ui";

const FILTERS = [
  { key: "all", label: "All", test: () => true },
  { key: "needs", label: "Needs details", test: needsDetails },
  { key: "hidden", label: "Hidden", test: (p: AdminProduct) => !p.published },
  { key: "featured", label: "Featured", test: (p: AdminProduct) => p.featured },
  { key: "stock", label: "Tracking stock", test: (p: AdminProduct) => p.track_stock },
] as const;

export function ProductsView() {
  const params = useSearchParams();
  const router = useRouter();
  const filter = FILTERS.find((f) => f.key === params.get("filter")) ?? FILTERS[0];
  const [search, setSearch] = useState("");
  const products = useLoad(listProducts);

  const q = search.trim().toLowerCase();
  const shown = (products.data ?? []).filter((p) => filter.test(p) && (!q || `${p.name} ${p.club ?? ""} ${p.player ?? ""}`.toLowerCase().includes(q)));

  return (
    <>
      <PageHeader
        title="Products"
        intro="Fields imported from the old site are kept as they were. Fill in the rest; highlighted fields are empty."
        action={
          <ButtonLink href="/admin/products/edit" size="lg">
            Add product
          </ButtonLink>
        }
      />
      <TextField label="Search products" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, club or player" />
      <nav aria-label="Product filter" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
        <ul className="flex gap-2">
          {FILTERS.map((f) => {
            const count = products.data?.filter(f.test).length;
            return (
              <li key={f.key}>
                <button
                  type="button"
                  aria-pressed={filter.key === f.key}
                  onClick={() => router.replace(`/admin/products?filter=${f.key}`, { scroll: false })}
                  className={cn(
                    "h-10 rounded-full border px-4 text-step-n1 font-medium whitespace-nowrap",
                    filter.key === f.key ? "border-ink bg-ink text-bg" : "border-line-strong text-ink-muted hover:text-ink",
                  )}
                >
                  {f.label}
                  {count !== undefined && <span className="ml-1.5 tabular-nums opacity-70">{count}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      {products.error ? (
        <ErrorNote message={products.error} onRetry={products.reload} />
      ) : !products.data ? (
        <Loading />
      ) : shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-ink-muted">No products match.</p>
      ) : (
        <ul className="grid gap-3">
          {shown.map((p) => {
            const missing = missingDetails(p).required;
            const img = p.product_images.find((i) => i.kind === "front") ?? p.product_images[0];
            return (
              <li key={p.id}>
                <Link href={`/admin/products/edit?id=${p.id}`} className="flex min-w-0 gap-3 rounded-2xl border border-line bg-surface p-3 transition-colors hover:border-ink-muted">
                  <span className="size-16 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnails straight from Storage */}
                    {img && <img src={publicUrl("product-images", img.storage_path)} alt="" className="size-full object-cover" loading="lazy" />}
                  </span>
                  <span className="grid min-w-0 flex-1 content-start gap-1">
                    <span className="truncate font-medium">{p.name}</span>
                    <span className="text-step-n1 text-ink-muted">{formatPaise(p.price_paise)}</span>
                    <span className="flex flex-wrap gap-1.5">
                      {!p.published && <Chip>Hidden</Chip>}
                      {p.featured && <Chip tone="success">Featured</Chip>}
                      {p.track_stock && <Chip>Stock tracked</Chip>}
                      {missing.length > 0 && (
                        <Chip tone="warning">
                          Needs: {missing.slice(0, 3).map((m) => DETAIL_LABELS[m].toLowerCase()).join(", ")}
                          {missing.length > 3 ? ` +${missing.length - 3}` : ""}
                        </Chip>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
