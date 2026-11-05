import type { Metadata } from "next";
import { BrandProvider } from "@/components/providers/brand-provider";
import { loadBrandPack, publicBrand } from "@/lib/brand/brand-pack";
import { db } from "@/lib/db";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { AppProviders } from "@/components/providers/app-providers";
import { themeConfig } from "@/config/theme";
import { getSetting } from "@/lib/settings/server";
import "./globals.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const b = await loadBrandPack();
  const name = b.appName ?? themeConfig.appName;
  return {
    title: { default: name, template: `%s · ${b.wordmark ?? themeConfig.wordmark}` },
    description: b.tagline ?? themeConfig.tagline,
    ...(b.assets.includes("mark") ? { icons: { icon: "/api/brand/asset?name=mark" } } : {}),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [appearance, stored, brand] = await Promise.all([
    getSetting("appearance").catch(() => null),
    db.setting.findUnique({ where: { key: "appearance" } }).catch(() => null),
    loadBrandPack(),
  ]);
  // A brand pack with colors becomes the default accent until the user picks another one.
  const accent =
    appearance?.accent === "brand" && !brand.css
      ? themeConfig.defaultAccent
      : brand.css && !stored
        ? "brand"
        : (appearance?.accent ?? themeConfig.defaultAccent);
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-accent={accent}
      data-density={appearance?.density ?? "comfortable"}
      className={`${GeistSans.variable} ${GeistMono.variable} h-full`}
    >
      <head>
        {/* Generated from validated hex colors in brand/brand.json (never user HTML). */}
        {brand.css && <style id="brand-pack">{brand.css}</style>}
      </head>
      <body className="min-h-full">
        <BrandProvider brand={{ ...publicBrand(brand), activeAccent: accent }}>
          <AppProviders>{children}</AppProviders>
        </BrandProvider>
      </body>
    </html>
  );
}
