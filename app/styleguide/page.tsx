import type { Metadata } from "next";
import type { ReactNode } from "react";
import tokens from "@/scripts/import/tokens.proposal.json";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { ArrowRightIcon, BagIcon, SearchIcon } from "@/components/ui/icons";
import { SelectField, TextArea, TextField } from "@/components/ui/input";
import { FeaturedGrid } from "@/components/store/featured-grid";
import { PegRail } from "@/components/store/peg-rail";
import { ProductCard } from "@/components/store/product-card";
import { CATEGORIES, countCategories, visibleCategories } from "@/lib/catalog/categories";
import { MIN_PEG_RAIL, homeShowcase } from "@/lib/catalog/peg-rail";
import { getCatalog } from "@/lib/catalog/source";
import { contrast } from "@/lib/color";
import { cn } from "@/lib/cn";
import { AddToCartDemo, SizeSelectorDemo, ToastDemo } from "./demos";

export const metadata: Metadata = { title: "Style guide", robots: { index: false, follow: false } };

const SWATCHES = ["--bg", "--surface-2", "--surface", "--line", "--line-strong", "--ink-muted", "--ink", "--brand-50", "--brand-100", "--brand", "--brand-600", "--brand-700", "--brand-text", "--accent", "--success", "--warning"] as const;

// Preview only: sample shirt numbers to show the rail. Real numbers come from admins.
const PREVIEW_NUMBERS = [7, 10, 22, 9, 11, 8];

export default function StyleGuide() {
  const catalog = getCatalog();
  const counts = countCategories(catalog);
  const showcase = homeShowcase(catalog);
  const railPreview = catalog.slice(0, PREVIEW_NUMBERS.length).map((p, i) => ({ ...p, number: PREVIEW_NUMBERS[i] }));
  const demoProduct = { ...catalog[0], variants: catalog[0].variants };

  return (
    <main className="pb-24">
      <div className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8">
        <p className="text-step-n1 font-medium text-brand-text">Design system · Phase 1</p>
        <h1 className="mt-2 text-step-5 font-extrabold">Style guide</h1>
        <p className="mt-3 max-w-[62ch] text-ink-muted">
          v1&rsquo;s dark theme, coral and type, refined. Dark is the default; a light variant is shown alongside. Header and footer are the live ones on this page.
        </p>
        <nav aria-label="Sections" className="mt-6 flex flex-wrap gap-2 text-step-n1">
          {["Colour", "Type", "Buttons", "Inputs", "Sizes", "Cards", "Peg rail", "Cart & toast", "Navigation", "Light"].map((s) => (
            <a key={s} href={`#${slug(s)}`} className="rounded-full border border-line px-3 py-1.5 text-ink-muted hover:border-line-strong hover:text-ink">
              {s}
            </a>
          ))}
        </nav>
      </div>

      <Section title="Colour" note="Tokens from tokens.proposal.json. Every text pair passes WCAG AA.">
        <div className="grid gap-6 lg:grid-cols-2">
          {(["dark", "light"] as const).map((theme) => (
            <div key={theme} data-theme={theme} className="rounded-[var(--radius-card)] border border-line p-4">
              <p className="mb-3 font-heading font-semibold capitalize">{theme}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {SWATCHES.map((name) => {
                  const value = (tokens.themes[theme] as Record<string, { value: string }>)[name].value;
                  const onBg = contrast(value, tokens.themes[theme]["--bg"].value);
                  return (
                    <div key={name} className="overflow-hidden rounded-xl border border-line">
                      <div className="h-12" style={{ background: value }} />
                      <div className="px-2.5 py-2">
                        <p className="font-mono text-[0.7rem] text-ink">{name}</p>
                        <p className="font-mono text-[0.7rem] text-ink-muted">
                          {value} · {onBg.toFixed(1)}:1
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type" note="Outfit for headings, Inter for text, JetBrains Mono for prices and SKUs. 17px base, 1.25 ratio.">
        <div className="grid gap-5">
          {[
            ["step-6", "text-step-6", "font-heading font-extrabold", "Wear the heritage."],
            ["step-5", "text-step-5", "font-heading font-extrabold", "Wear the heritage."],
            ["step-4", "text-step-4", "font-heading font-bold", "Featured jerseys"],
            ["step-3", "text-step-3", "font-heading font-bold", "Shop by club"],
            ["step-2", "text-step-2", "font-heading font-bold", "Barcelona 2009 home — Messi"],
            ["step-1", "text-step-1", "font-sans", "Authenticated football jerseys, curated like museum pieces."],
            ["step-0", "text-step-0", "font-sans", "From the terraces to your door — craftsmanship, provenance, and the game’s enduring spirit."],
            ["step-n1", "text-step-n1", "font-sans text-ink-muted", "Arrives by Tue 21 Oct · Only 3 left in M"],
            ["mono", "text-step-0", "font-mono font-semibold text-brand-text", "₹900  KTR-RMA-GRN-MBP10"],
          ].map(([label, size, cls, text]) => (
            <div key={label} className="grid items-baseline gap-1 border-b border-line pb-4 sm:grid-cols-[120px_1fr]">
              <span className="font-mono text-step-n2 text-ink-muted">{label}</span>
              <span className={cn(size, cls, "leading-tight")}>{text}</span>
            </div>
          ))}
          <div className="flex items-end gap-6 overflow-x-auto">
            {[7, 10, 22].map((n) => (
              <span key={n} className="font-number text-[clamp(6rem,14vw,14rem)] leading-[0.8] font-black tracking-[-0.03em] text-number transition-colors hover:text-brand">
                {n}
              </span>
            ))}
            <p className="max-w-[28ch] pb-4 text-step-n1 text-ink-muted">Big Shoulders, shirt numbers only. Ghosted at 8% ink; coral on hover.</p>
          </div>
        </div>
      </Section>

      <Section title="Buttons" note="Coral fill keeps v1’s colour; near-black text passes AA (7.4:1).">
        <div className="grid gap-6">
          <Row label="Variants">
            <Button>Add to cart</Button>
            <Button variant="secondary">Buy now</Button>
            <Button variant="ghost">View details</Button>
            <ButtonLink href="/shop" iconEnd={<ArrowRightIcon width={18} height={18} />}>
              Shop the Archive
            </ButtonLink>
          </Row>
          <Row label="Sizes">
            <Button size="sm">Small</Button>
            <Button>Medium</Button>
            <Button size="lg">Large</Button>
          </Row>
          <Row label="States">
            <Button disabled>Disabled</Button>
            <Button loading>Placing order</Button>
            <Button icon={<BagIcon width={18} height={18} />}>With icon</Button>
            <IconButton label="Search">
              <SearchIcon />
            </IconButton>
          </Row>
        </div>
      </Section>

      <Section title="Inputs" note="Borders use --line-strong (3:1). Errors are written as directions.">
        <div className="grid max-w-3xl gap-5 sm:grid-cols-2">
          <TextField label="Full name" placeholder="Rohan Sharma" autoComplete="name" />
          <TextField label="Pincode" inputMode="numeric" maxLength={6} defaultValue="560034" hint="Arrives by Tue 21 Oct" />
          <TextField label="Phone" inputMode="tel" defaultValue="98765" error="Enter a 10-digit mobile number, like 98765 43210." />
          <SelectField label="Sort by" defaultValue="newest">
            <option value="newest">Newest</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
          </SelectField>
          <TextArea label="Message" placeholder="Questions about an order, sizing or availability?" className="sm:col-span-2" />
        </div>
      </Section>

      <Section title="Sizes" note="Preview stock levels: low stock gets a dot and a note; sold out is struck through.">
        <SizeSelectorDemo />
      </Section>

      <Section title="Cards" note="Wide v1 photos are contained on white, not cropped. Numbers appear once admins add them.">
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 lg:grid-cols-4">
          {catalog.slice(0, 3).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
          <ProductCard product={{ ...catalog[4], number: 7 }} />
        </div>
        <p className="mt-3 text-step-n2 text-ink-muted">Fourth card shows a preview shirt number.</p>
      </Section>

      <div id="peg-rail" className="scroll-mt-24">
        <div className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8">
          <SectionHeading title="Peg rail" note={`Needs ${MIN_PEG_RAIL}+ jerseys with a shirt number. Today ${catalog.filter((p) => p.number != null).length} have one, so home shows the featured grid. Preview below uses sample numbers.`} />
        </div>
        <div className="mt-6">
          <PegRail products={railPreview} title="Browse by number" />
        </div>
        <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
          <p className="text-step-n1 text-ink-muted">
            Fallback in use now: <span className="font-mono text-ink">{showcase.kind}</span>
          </p>
        </div>
        <FeaturedGrid products={showcase.products.slice(0, 4)} />
      </div>

      <Section title="Cart & toast" note="Cart is saved in this browser; prices are re-checked at checkout.">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
          <AddToCartDemo product={demoProduct} />
          <ToastDemo />
        </div>
      </Section>

      <Section title="Navigation" note="Categories without products are hidden, and reappear as soon as one is added (live count from Supabase).">
        <ul className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const shown = visibleCategories(counts).some((v) => v.key === c.key);
            return (
              <li key={c.key} className={cn("rounded-full border px-3.5 py-1.5 text-step-n1", shown ? "border-line-strong text-ink" : "border-dashed border-line text-ink-muted")}>
                {c.label} · {counts[c.key]} {shown ? "shown" : "hidden"}
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Light" note="The light variant, built from v1’s light footer colours.">
        <div data-theme="light" className="grid gap-8 rounded-[var(--radius-card)] border border-line p-5 sm:p-8 lg:grid-cols-2">
          <div className="grid content-start gap-6">
            <Row label="Buttons">
              <Button>Add to cart</Button>
              <Button variant="secondary">Buy now</Button>
              <Button variant="ghost">Details</Button>
            </Row>
            <TextField label="Pincode" defaultValue="400001" hint="Arrives by Mon 20 Oct" />
            <SizeSelectorDemo />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {catalog.slice(5, 7).map((p, i) => (
              <ProductCard key={p.id} product={i === 0 ? { ...p, number: 10 } : p} />
            ))}
          </div>
        </div>
      </Section>
    </main>
  );
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z]+/g, "-").replace(/-$/, "");
}

function SectionHeading({ title, note }: { title: string; note?: string }) {
  return (
    <div className="border-t border-line pt-8">
      <h2 className="text-step-3 font-bold">{title}</h2>
      {note && <p className="mt-2 max-w-[70ch] text-step-n1 text-ink-muted">{note}</p>}
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section id={slug(title)} className="mx-auto max-w-7xl scroll-mt-24 px-4 pt-16 sm:px-6 lg:px-8">
      <SectionHeading title={title} note={note} />
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2.5">
      <p className="font-mono text-step-n2 text-ink-muted">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}
