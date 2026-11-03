import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { AppProviders } from "@/components/providers/app-providers";
import { themeConfig } from "@/config/theme";
import { getSetting } from "@/lib/settings/server";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: themeConfig.appName, template: `%s · ${themeConfig.wordmark}` },
  description: themeConfig.tagline,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const appearance = await getSetting("appearance").catch(() => null);
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-accent={appearance?.accent ?? themeConfig.defaultAccent}
      data-density={appearance?.density ?? "comfortable"}
      className={`${GeistSans.variable} ${GeistMono.variable} h-full`}
    >
      <body className="min-h-full">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
