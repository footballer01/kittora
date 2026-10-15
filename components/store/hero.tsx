import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/ui/icons";

/** v1's hero image and copy, on a real type scale with one primary action. */
export function Hero({ image }: { image: { src: string; width: number; height: number } }) {
  return (
    <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 pt-8 pb-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:px-8 lg:pt-14 lg:pb-20">
      <div>
        <p className="text-step-n1 font-medium text-ink-muted">New season archive</p>
        <h1 className="mt-4 font-heading text-[clamp(3.2rem,9vw,6.4rem)] leading-[0.95] font-extrabold tracking-[-0.035em]">
          Wear the <span className="text-brand-text">heritage.</span>
        </h1>
        <p className="mt-6 max-w-[46ch] text-step-1 leading-relaxed text-ink-muted">
          Authenticated football jerseys, curated like museum pieces. From the terraces to your door — craftsmanship, provenance, and the game&rsquo;s
          enduring spirit.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
          <ButtonLink href="/shop" size="lg" iconEnd={<ArrowRightIcon width={18} height={18} />}>
            Shop the Archive
          </ButtonLink>
          <Link href="/category/men" className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-ink underline-offset-4 hover:underline">
            Explore Men
          </Link>
        </div>
      </div>
      <div className="relative overflow-hidden rounded-[28px] bg-surface">
        <Image
          src={image.src}
          alt="A blue football jersey with an embroidered crest, seen from behind in a floodlit stadium"
          width={image.width}
          height={image.height}
          priority
          sizes="(min-width: 1024px) 600px, 100vw"
          className="hero-settle aspect-[4/5] w-full object-cover sm:aspect-[5/4] lg:aspect-square"
        />
      </div>
    </section>
  );
}
