import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-start justify-center px-4 py-24 sm:px-6 lg:px-8">
      <p aria-hidden className="shirt-number text-[clamp(7rem,30vw,16rem)]">
        404
      </p>
      <h1 className="mt-6 text-step-4 font-bold">This shirt isn’t on the rail</h1>
      <p className="mt-3 max-w-[48ch] text-ink-muted">The page may have moved, or the jersey has left the archive. Try a search, or browse everything we have.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/shop">Shop all jerseys</ButtonLink>
        <ButtonLink href="/search" variant="secondary">
          Search
        </ButtonLink>
      </div>
    </main>
  );
}
