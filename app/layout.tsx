import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Inter, JetBrains_Mono, Outfit } from "next/font/google";
import { CartDrawer, CartHydrator } from "@/components/store/cart-drawer";
import { Footer } from "@/components/store/footer";
import { Header } from "@/components/store/header";
import { Toaster } from "@/components/ui/toaster";
import { countCategories } from "@/lib/catalog/categories";
import { LiveCatalog } from "@/lib/catalog/live";
import { getCatalog } from "@/lib/catalog/source";
import { SITE_NAME, siteUrl } from "@/lib/seo";
import "./globals.css";

// v1's fonts, self-hosted at build time by next/font.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const outfit = Outfit({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-outfit", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-jetbrains", display: "swap", preload: false });
// New in v2: shirt numbers and the peg rail only.
// Variable font, so shirt numbers can animate their weight on hover.
const bigShoulders = Big_Shoulders({ subsets: ["latin"], variable: "--font-big-shoulders", display: "swap", preload: false });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: "Kittora — authenticated football jerseys, curated like museum pieces. Delivered across India.",
  openGraph: { siteName: SITE_NAME, locale: "en_IN", type: "website" },
};

// Name only the clicked card's image "product-hero" so it morphs into the
// product page's first photo (one named element per page, so repeats are fine).
const VIEW_TRANSITION_SCRIPT = `addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a[data-vt]");if(!a)return;document.querySelectorAll("[data-vt-img],[data-vt-hero]").forEach(function(n){n.style.viewTransitionName=""});var r=a.closest("[data-vt-root]"),i=r&&r.querySelector("[data-vt-img]");if(i)i.style.viewTransitionName="product-hero"},true);addEventListener("pageshow",function(){document.querySelectorAll("[data-vt-img]").forEach(function(n){n.style.viewTransitionName=""})});`;

// Prefetch product pages when a link is hovered or pressed (Chromium; ignored elsewhere).
const SPECULATION_RULES = JSON.stringify({
  prefetch: [{ where: { or: [{ href_matches: "/product/*" }, { href_matches: "/preview/product/*" }] }, eagerness: "moderate" }],
});

export const viewport: Viewport = { themeColor: "#09090b", colorScheme: "dark" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  const counts = countCategories(getCatalog());
  return (
    <html lang="en-IN" className={`${inter.variable} ${outfit.variable} ${jetbrains.variable} ${bigShoulders.variable} antialiased`}>
      <body className="flex min-h-dvh flex-col">
        <a href="#main" className="sr-only z-50 rounded-full bg-brand px-4 py-2 font-semibold text-brand-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
          Skip to content
        </a>
        <Header counts={counts} />
        <div id="main" className="flex flex-1 flex-col">
          {children}
        </div>
        <Footer counts={counts} />
        <CartDrawer />
        <Toaster />
        <CartHydrator />
        <LiveCatalog />
        <script dangerouslySetInnerHTML={{ __html: VIEW_TRANSITION_SCRIPT }} />
        <script type="speculationrules" dangerouslySetInnerHTML={{ __html: SPECULATION_RULES }} />
      </body>
    </html>
  );
}
