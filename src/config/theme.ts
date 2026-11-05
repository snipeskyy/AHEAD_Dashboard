/**
 * ALL committed branding lives here and stays neutral (no third-party logos).
 * Company branding comes from the local, git-ignored brand pack in `brand/` (see brand/README.md):
 * it overrides these names and adds the "brand" accent. The wordmark and accent can also be
 * changed at runtime in Settings → Appearance.
 */
export const themeConfig = {
  appName: "Account Command Center",
  wordmark: "ACC",
  tagline: "Portfolio intelligence",
  defaultAccent: "blue" as AccentId,
};

export const ACCENTS = {
  blue: { label: "Blue", swatch: "#2a78d6" },
  teal: { label: "Teal", swatch: "#0f8a7e" },
  violet: { label: "Violet", swatch: "#6250d6" },
  slate: { label: "Graphite", swatch: "#475467" },
  amber: { label: "Amber", swatch: "#b86e00" },
  /** Colors from brand/brand.json; only offered when the brand pack defines them. */
  brand: { label: "Brand", swatch: "var(--primary)" },
} as const;

export type AccentId = keyof typeof ACCENTS;
export const ACCENT_IDS = Object.keys(ACCENTS) as AccentId[];
