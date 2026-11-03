import type { NextConfig } from "next";

// Cache Components is intentionally OFF: ACC is a fully dynamic, local, single-user
// app; data flows through route handlers + TanStack Query. See CLAUDE.md.
const nextConfig: NextConfig = {
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  serverExternalPackages: ["@prisma/client", "playwright", "pptxgenjs"],
};

export default nextConfig;
