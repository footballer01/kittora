import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Inter, JetBrains_Mono, Outfit } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
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

export const viewport: Viewport = { themeColor: "#09090b", colorScheme: "dark" };

// Store pages get the header, footer and cart from app/(store)/layout.tsx;
// /admin has its own shell.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${inter.variable} ${outfit.variable} ${jetbrains.variable} ${bigShoulders.variable} antialiased`}>
      <body className="flex min-h-dvh flex-col">
        <a href="#main" className="sr-only z-50 rounded-full bg-brand px-4 py-2 font-semibold text-brand-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
          Skip to content
        </a>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
