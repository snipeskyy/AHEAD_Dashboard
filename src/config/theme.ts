/**
 * ALL branding lives here. Neutral by design: no third-party logos or brand assets.
 * The wordmark and accent can also be overridden at runtime in Settings → Appearance.
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
} as const;

export type AccentId = keyof typeof ACCENTS;
export const ACCENT_IDS = Object.keys(ACCENTS) as AccentId[];
