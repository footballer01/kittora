import type { Metadata } from "next";
import "./globals.css";

// Fonts and design tokens arrive in Phase 1, built from v1's extracted theme.
export const metadata: Metadata = {
  title: "Terrace Archive",
  description: "Kittora — football jerseys, curated like museum pieces.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
