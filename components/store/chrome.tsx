import type { ReactNode } from "react";
import { countCategories } from "@/lib/catalog/categories";
import { LiveCatalog } from "@/lib/catalog/live";
import { getCatalog } from "@/lib/catalog/source";
import { CartDrawer, CartHydrator } from "./cart-drawer";
import { Footer } from "./footer";
import { Header } from "./header";

// Name only the clicked card's image "product-hero" so it morphs into the
// product page's first photo (one named element per page, so repeats are fine).
const VIEW_TRANSITION_SCRIPT = `addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a[data-vt]");if(!a)return;document.querySelectorAll("[data-vt-img],[data-vt-hero]").forEach(function(n){n.style.viewTransitionName=""});var r=a.closest("[data-vt-root]"),i=r&&r.querySelector("[data-vt-img]");if(i)i.style.viewTransitionName="product-hero"},true);addEventListener("pageshow",function(){document.querySelectorAll("[data-vt-img]").forEach(function(n){n.style.viewTransitionName=""})});`;

// Prefetch product pages when a link is hovered or pressed (Chromium; ignored elsewhere).
const SPECULATION_RULES = JSON.stringify({
  prefetch: [{ where: { or: [{ href_matches: "/product/*" }] }, eagerness: "moderate" }],
});

/** Header, footer, cart and live data around every store page (and the 404). */
export function StoreChrome({ children }: { children: ReactNode }) {
  const counts = countCategories(getCatalog());
  return (
    <>
      <Header counts={counts} />
      <div id="main" className="flex flex-1 flex-col">
        {children}
      </div>
      <Footer counts={counts} />
      <CartDrawer />
      <CartHydrator />
      <LiveCatalog />
      <script dangerouslySetInnerHTML={{ __html: VIEW_TRANSITION_SCRIPT }} />
      <script type="speculationrules" dangerouslySetInnerHTML={{ __html: SPECULATION_RULES }} />
    </>
  );
}
