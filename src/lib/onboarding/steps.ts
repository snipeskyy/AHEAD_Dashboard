import type { LucideIcon } from "lucide-react";
import { ClipboardCheck, FileUp, Fingerprint, Sparkles } from "lucide-react";

/**
 * First-run flow: Import accounts → Resolve identities → Enrich → Review.
 * `available: false` steps are shown (so the path is clear) but not actionable yet; Phase 6
 * flips Resolve and Enrich on when the enrichment engine lands.
 */
export interface OnboardingStep {
  id: "import" | "resolve" | "enrich" | "review";
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  cta: string;
  available: boolean;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "import",
    title: "Import your accounts",
    description:
      "Upload a CSV or Excel file, or paste a list of company names (optionally with domains).",
    icon: FileUp,
    href: "/import?kind=accounts",
    cta: "Import accounts",
    available: true,
  },
  {
    id: "resolve",
    title: "Resolve identities",
    description:
      "Confirm which legal entity each account is (SEC, GLEIF, Wikidata, company website).",
    icon: Fingerprint,
    href: "/accounts",
    cta: "Resolve",
    available: false,
  },
  {
    id: "enrich",
    title: "Enrich from public sources",
    description:
      "Fill firmographics, financials, hierarchy and evidence, each with its source link.",
    icon: Sparkles,
    href: "/accounts",
    cta: "Enrich",
    available: false,
  },
  {
    id: "review",
    title: "Review and fill the gaps",
    description:
      "Accept proposed values, then add what only you know: relationships, budget notes.",
    icon: ClipboardCheck,
    href: "/accounts",
    cta: "Open accounts",
    available: true,
  },
];
