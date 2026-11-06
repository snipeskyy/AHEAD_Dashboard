import "server-only";
import { loadBrandPack, readBrandAsset } from "@/lib/brand/brand-pack";
import { brandTheme, NEUTRAL_THEME } from "./theme";
import type { DeckTheme } from "./types";

export type ThemeChoice = "brand" | "neutral";

/**
 * The deck theme for an export. "brand" uses the local, git-ignored brand pack (logo + AA-adjusted primary)
 * when one is installed, and falls back to the neutral theme otherwise. PNG logos render everywhere;
 * SVG logos need a recent PowerPoint.
 */
export async function resolveDeckTheme(choice: ThemeChoice): Promise<DeckTheme> {
  if (choice !== "brand") return NEUTRAL_THEME;
  const pack = await loadBrandPack();
  if (!pack.tokens && !pack.assets.includes("logo")) return NEUTRAL_THEME;
  const asset = await readBrandAsset("logo").catch(() => null);
  const logo = asset ? `data:${asset.type};base64,${asset.body.toString("base64")}` : null;
  return brandTheme({
    primary: pack.tokens?.light.primary ?? `#${NEUTRAL_THEME.primary}`,
    logo,
    footerNote: pack.footerNote ?? null,
    name: pack.appName ?? "Brand",
  });
}
