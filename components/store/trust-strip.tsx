import { ReturnIcon, ShieldIcon, TruckIcon } from "@/components/ui/icons";

// v1's three trust points, one plain line each.
const TRUST = [
  { icon: ShieldIcon, title: "Authenticated craft", body: "Every jersey verified for authenticity and quality." },
  { icon: TruckIcon, title: "Pan-India delivery", body: "Secure shipping to your doorstep, tracked end to end." },
  { icon: ReturnIcon, title: "Easy returns", body: "Seven-day hassle-free returns on unworn jerseys." },
];

export function TrustStrip() {
  return (
    <section aria-label="Why Kittora" className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-3 sm:px-6 lg:px-8 lg:py-16">
      {TRUST.map(({ icon: Icon, title, body }) => (
        <div key={title} className="flex gap-4">
          <Icon className="mt-0.5 shrink-0 text-accent" width={22} height={22} />
          <div>
            <p className="font-heading font-semibold">{title}</p>
            <p className="mt-0.5 text-step-n1 text-ink-muted">{body}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
