import type { DeckTheme } from "./types";

/** Validated categorical series palette (same order as the app's --series-1..8). Never brand-colored. */
export const SERIES = ["2A78D6", "EB6834", "1BAF7A", "EDA100", "E87BA4", "008300", "6250D6", "E34948"];

/** Neutral theme committed to the repo. Company branding comes only from the local brand pack. */
export const NEUTRAL_THEME: DeckTheme = {
  name: "Neutral",
  primary: "256ABF",
  onPrimary: "FFFFFF",
  ink: "121211",
  muted: "5C5B57",
  surface: "FFFFFF",
  soft: "EEF3FB",
  rule: "E4E3DF",
  series: SERIES,
  fontHead: "Arial",
  fontBody: "Arial",
  logo: null,
  footerNote: null,
};

const clean = (hex: string) => hex.replace("#", "").toUpperCase().slice(0, 6).padStart(6, "0");

/** Mix a hex color toward white (amount 0..1) for soft backgrounds. */
export function tint(hex: string, amount: number) {
  const h = clean(hex);
  return [0, 2, 4]
    .map((i) => parseInt(h.slice(i, i + 2), 16))
    .map((c) => Math.round(c + (255 - c) * amount).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/** Brand theme from the (AA-adjusted) brand primary. Chart series keep the validated palette. */
export function brandTheme(input: {
  primary: string;
  logo?: string | null;
  footerNote?: string | null;
  name?: string;
}): DeckTheme {
  const primary = clean(input.primary);
  return {
    ...NEUTRAL_THEME,
    name: input.name ?? "Brand",
    primary,
    soft: tint(primary, 0.9),
    logo: input.logo ?? null,
    footerNote: input.footerNote ?? null,
  };
}
