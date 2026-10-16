"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  activeCount,
  applyFilters,
  EMPTY_FILTERS,
  facets as buildFacets,
  parseFilters,
  priceRange,
  serializeFilters,
  SORTS,
  type Facet,
  type ShopFilters,
  type SortKey,
  LIST_KEYS,
} from "@/lib/catalog/filters";
import { useLiveCatalog } from "@/lib/catalog/live";
import type { CatalogProduct } from "@/lib/catalog/types";
import { cn } from "@/lib/cn";
import { Button, IconButton } from "@/components/ui/button";
import { CloseIcon, FilterIcon, SearchIcon } from "@/components/ui/icons";
import { ProductCard } from "./product-card";

// Filter state lives in the URL (?club=…&size=M&sort=price-asc), so every view
// is a shareable link. The static HTML renders the unfiltered list; the URL is
// applied right after hydration.
const URL_EVENT = "kittora:url";
const subscribe = (cb: () => void) => {
  addEventListener("popstate", cb);
  addEventListener(URL_EVENT, cb);
  return () => {
    removeEventListener("popstate", cb);
    removeEventListener(URL_EVENT, cb);
  };
};
const getSearch = () => location.search;
const getServerSearch = () => "";

function useUrlFilters(): [ShopFilters, (f: ShopFilters) => void] {
  const search = useSyncExternalStore(subscribe, getSearch, getServerSearch);
  const filters = useMemo(() => parseFilters(search), [search]);
  const set = (f: ShopFilters) => {
    history.replaceState(history.state, "", `${location.pathname}${serializeFilters(f)}`);
    dispatchEvent(new Event(URL_EVENT));
  };
  return [filters, set];
}

type ListKey = (typeof LIST_KEYS)[number];
const NO_HIDE: ListKey[] = [];

export function ShopView({
  products: built,
  title,
  eyebrow,
  intro,
  hide = NO_HIDE,
  searchFirst = false,
}: {
  products: CatalogProduct[];
  title: string;
  eyebrow?: string;
  intro?: ReactNode;
  /** Facets fixed by the page (e.g. club on a club page). */
  hide?: ListKey[];
  /** /search: the search box leads and takes focus. */
  searchFirst?: boolean;
}) {
  const products = useLiveCatalog(built);
  const [filters, setFilters] = useUrlFilters();
  const results = useMemo(() => applyFilters(products, filters), [products, filters]);
  const facets = useMemo(() => buildFacets(products, filters, hide), [products, filters, hide]);
  const range = useMemo(() => priceRange(products), [products]);
  const active = activeCount(filters);
  const [sheet, setSheet] = useState(false);
  const countId = useId();

  const toggle = (key: ListKey, value: string) => {
    const list = filters[key];
    setFilters({ ...filters, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] });
  };
  const clear = () => setFilters({ ...EMPTY_FILTERS, q: filters.q, sort: filters.sort });
  const chips = LIST_KEYS.flatMap((k) =>
    filters[k].map((v) => ({ key: k, value: v, label: facets.find((f) => f.key === k)?.options.find((o) => o.value === v)?.label ?? v })),
  );

  const panel = (
    <FilterPanel facets={facets} filters={filters} range={range} onToggle={toggle} onPrice={(min, max) => setFilters({ ...filters, min, max })} />
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pt-8 pb-20 sm:px-6 lg:px-8 lg:pt-12">
      <header className="max-w-[62ch]">
        {eyebrow && <p className="text-step-n1 font-medium text-ink-muted">{eyebrow}</p>}
        <h1 className="mt-1 text-step-4 font-bold sm:text-step-5">{title}</h1>
        {intro && <div className="mt-3 text-ink-muted">{intro}</div>}
      </header>

      <div className={cn("mt-8 flex flex-wrap items-center gap-3", searchFirst && "mt-6")}>
        <SearchBox value={filters.q} onChange={(q) => setFilters({ ...filters, q })} autoFocus={searchFirst} className={searchFirst ? "w-full sm:w-[28rem]" : "w-full sm:w-80"} />
        <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto [&>*:last-child]:ml-auto sm:[&>*:last-child]:ml-0">
          {facets.length > 0 || range ? (
            <Dialog.Root open={sheet} onOpenChange={setSheet}>
              <Dialog.Trigger asChild>
                <Button variant="secondary" icon={<FilterIcon width={18} height={18} />} className="lg:hidden">
                  Filters{active ? ` (${active})` : ""}
                </Button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 transition-opacity duration-200 data-[state=closed]:animate-fade-out starting:opacity-0" />
                <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-[1.25rem] border-t border-line bg-surface-2 transition-transform duration-300 ease-out starting:translate-y-full">
                  <div className="flex items-center justify-between border-b border-line px-4 py-2">
                    <Dialog.Title className="font-heading text-step-1 font-bold">Filters</Dialog.Title>
                    <Dialog.Close asChild>
                      <IconButton label="Close filters">
                        <CloseIcon />
                      </IconButton>
                    </Dialog.Close>
                  </div>
                  <Dialog.Description className="sr-only">Narrow the jerseys shown</Dialog.Description>
                  <div className="overflow-y-auto px-4 py-2">{panel}</div>
                  <div className="flex gap-3 border-t border-line px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                    <Button variant="ghost" onClick={clear} disabled={!active}>
                      Clear
                    </Button>
                    <Button className="flex-1" onClick={() => setSheet(false)}>
                      Show {results.length} {results.length === 1 ? "jersey" : "jerseys"}
                    </Button>
                  </div>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          ) : null}
          <SortSelect value={filters.sort} onChange={(sort) => setFilters({ ...filters, sort })} />
        </div>
      </div>

      <div className="mt-6 flex min-h-8 flex-wrap items-center gap-2">
        <p id={countId} aria-live="polite" className="mr-2 text-step-n1 text-ink-muted">
          {results.length} {results.length === 1 ? "jersey" : "jerseys"}
          {filters.q.trim() && <> for “{filters.q.trim()}”</>}
        </p>
        {chips.map((c) => (
          <button
            key={`${c.key}:${c.value}`}
            type="button"
            onClick={() => toggle(c.key, c.value)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line-strong px-3 text-step-n1 text-ink hover:border-ink"
            aria-label={`Remove filter ${c.label}`}
          >
            {c.label} <CloseIcon width={14} height={14} />
          </button>
        ))}
        {(filters.min != null || filters.max != null) && (
          <button
            type="button"
            onClick={() => setFilters({ ...filters, min: null, max: null })}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line-strong px-3 text-step-n1 text-ink hover:border-ink"
          >
            ₹{filters.min ?? "0"}–{filters.max ?? "any"} <CloseIcon width={14} height={14} />
          </button>
        )}
        {active > 1 && (
          <button type="button" onClick={clear} className="h-8 px-2 text-step-n1 font-semibold text-ink underline underline-offset-4">
            Clear all
          </button>
        )}
      </div>

      <div className={cn("mt-4 grid gap-10", (facets.length > 0 || range) && "lg:grid-cols-[15rem_minmax(0,1fr)]")}>
        {(facets.length > 0 || range) && (
          <aside aria-label="Filters" className="hidden lg:block">
            <div className="sticky top-28 max-h-[calc(100dvh-8rem)] overflow-y-auto pr-2">{panel}</div>
          </aside>
        )}
        {results.length > 0 ? (
          <ul aria-describedby={countId} className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3">
            {results.map((p, i) => (
              <li key={p.id}>
                <ProductCard product={p} priority={i < 2} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-[var(--radius-card)] border border-line px-6 py-16 text-center">
            <p className="font-heading text-step-2 font-bold">Nothing matches yet</p>
            <p className="mx-auto mt-2 max-w-[44ch] text-ink-muted">Try a different spelling, or clear a filter or two.</p>
            <Button variant="secondary" className="mt-6" onClick={() => setFilters({ ...EMPTY_FILTERS, sort: filters.sort })}>
              Clear search and filters
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}

function SearchBox({ value, onChange, autoFocus, className }: { value: string; onChange: (q: string) => void; autoFocus?: boolean; className?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <form role="search" onSubmit={(e) => (e.preventDefault(), ref.current?.blur())} className={cn("relative", className)}>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-muted" width={18} height={18} />
      <input
        ref={ref}
        type="search"
        name="q"
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 80))}
        autoFocus={autoFocus}
        enterKeyHint="search"
        placeholder="Search club, player or number"
        aria-label="Search jerseys"
        className="h-11 w-full rounded-full border border-line-strong bg-surface pr-4 pl-11 text-ink placeholder:text-ink-muted/80 hover:border-ink-muted focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-0"
      />
    </form>
  );
}

function SortSelect({ value, onChange }: { value: SortKey; onChange: (s: SortKey) => void }) {
  return (
    <label className="relative">
      <span className="sr-only">Sort by</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
        className="h-11 appearance-none rounded-full border border-line-strong bg-bg pr-10 pl-4 text-[0.95rem] font-semibold text-ink hover:border-ink"
      >
        {SORTS.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>
      <svg className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-ink-muted" width="12" height="12" viewBox="0 0 12 12" aria-hidden>
        <path d="M2 4.5 6 8l4-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </label>
  );
}

function FilterPanel({
  facets,
  filters,
  range,
  onToggle,
  onPrice,
}: {
  facets: Facet[];
  filters: ShopFilters;
  range: [number, number] | null;
  onToggle: (key: ListKey, value: string) => void;
  onPrice: (min: number | null, max: number | null) => void;
}) {
  return (
    <div className="divide-y divide-line">
      {facets.map((f) => (
        <fieldset key={f.key} className="py-5 first:pt-1">
          <legend className="float-left mb-3 w-full font-heading text-step-n1 font-semibold text-ink">{f.label}</legend>
          <div className={cn("clear-both", f.key === "size" || f.key === "number" ? "flex flex-wrap gap-2" : "grid gap-1")}>
            {f.options.map((o) => {
              const checked = filters[f.key].includes(o.value);
              const disabled = !checked && o.count === 0;
              return f.key === "size" || f.key === "number" ? (
                <label
                  key={o.value}
                  className={cn(
                    "flex h-10 min-w-12 cursor-pointer items-center justify-center rounded-full border border-line-strong px-3 font-mono text-step-n1 font-semibold text-ink transition-colors hover:border-ink",
                    "has-checked:border-ink has-checked:bg-ink has-checked:text-bg has-focus-visible:outline-2 has-focus-visible:outline-focus",
                    "has-disabled:cursor-not-allowed has-disabled:border-line has-disabled:text-ink-muted/50",
                  )}
                >
                  <input type="checkbox" className="sr-only" checked={checked} disabled={disabled} onChange={() => onToggle(f.key, o.value)} />
                  {o.label}
                </label>
              ) : (
                <label
                  key={o.value}
                  className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg text-[0.95rem] text-ink has-disabled:cursor-not-allowed has-disabled:text-ink-muted/50"
                >
                  <input type="checkbox" checked={checked} disabled={disabled} onChange={() => onToggle(f.key, o.value)} className="size-4.5 accent-[var(--brand)]" />
                  <span className="flex-1">{o.label}</span>
                  <span className="font-mono text-step-n2 text-ink-muted tabular-nums">{o.count}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
      {range && <PriceFilter range={range} min={filters.min} max={filters.max} onChange={onPrice} />}
    </div>
  );
}

function PriceFilter({ range, min, max, onChange }: { range: [number, number]; min: number | null; max: number | null; onChange: (min: number | null, max: number | null) => void }) {
  const parse = (s: string) => (/^\d+$/.test(s) ? Number(s) : null);
  const field = "h-10 w-full rounded-[var(--radius-input)] border border-line-strong bg-surface px-3 font-mono text-step-n1 text-ink";
  return (
    <fieldset className="py-5">
      <legend className="mb-3 font-heading text-step-n1 font-semibold text-ink">Price (₹)</legend>
      <div className="flex items-center gap-2">
        <input inputMode="numeric" aria-label="Minimum price in rupees" placeholder={String(range[0])} value={min ?? ""} onChange={(e) => onChange(parse(e.target.value), max)} className={field} />
        <span className="text-ink-muted">–</span>
        <input inputMode="numeric" aria-label="Maximum price in rupees" placeholder={String(range[1])} value={max ?? ""} onChange={(e) => onChange(min, parse(e.target.value))} className={field} />
      </div>
    </fieldset>
  );
}
