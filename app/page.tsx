import { ButtonLink } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/ui/icons";
import { HomeShowcase } from "@/components/store/home-showcase";
import { getCatalog } from "@/lib/catalog/source";

// Phase 2 builds the full home page; this keeps v1's hero copy meanwhile.
export default function Home() {
  return (
    <main>
      <section className="mx-auto max-w-7xl px-4 pt-16 pb-8 sm:px-6 lg:px-8 lg:pt-24">
        <p className="text-step-n1 font-medium text-brand-text">New season archive</p>
        <h1 className="mt-3 text-step-5 font-extrabold sm:text-step-6">
          Wear the <span className="text-brand-text">heritage.</span>
        </h1>
        <p className="mt-5 max-w-[60ch] text-step-1 text-ink-muted">
          Authenticated football jerseys, curated like museum pieces. From the terraces to your door — craftsmanship, provenance, and the
          game&rsquo;s enduring spirit.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/shop" size="lg" iconEnd={<ArrowRightIcon width={18} height={18} />}>
            Shop the Archive
          </ButtonLink>
          <ButtonLink href="/category/men" size="lg" variant="secondary">
            Explore Men
          </ButtonLink>
        </div>
      </section>
      <HomeShowcase products={getCatalog()} />
    </main>
  );
}
