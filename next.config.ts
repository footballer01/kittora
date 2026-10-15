import type { NextConfig } from "next";

// Fully static site: `next build` writes plain HTML/JS/CSS to `out/`, served by
// Cloudflare static assets. No server code runs anywhere but Supabase.
const nextConfig: NextConfig = {
  output: "export",
  images: {
    // Phase 2 swaps this for a custom loader that picks pre-sized WebP files
    // generated at upload time (no paid image service).
    unoptimized: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
