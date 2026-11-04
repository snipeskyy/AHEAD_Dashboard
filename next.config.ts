import type { NextConfig } from "next";

// Cache Components is intentionally OFF: ACC is a fully dynamic, local, single-user
// app; data flows through route handlers + TanStack Query. See CLAUDE.md.
const nextConfig: NextConfig = {
  devIndicators: false,
  // Lets CI/verification builds run alongside `next dev` (e.g. NEXT_DIST_DIR=.next-build).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  serverExternalPackages: ["@prisma/client", "playwright", "pptxgenjs", "exceljs"],
};

export default nextConfig;
