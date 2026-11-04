import { DEFAULT_PRACTICE_AREAS } from "@/config/practice-areas";
import { STAGE_LABELS, STAGES, type Stage } from "@/lib/domain/enums";
import type { ImportKindDef, RowIssue } from "../types";
import { cell, matchEnum, parseAmount, parseDate, parsePercent } from "../values";
import { ACCOUNT_REF_FIELD } from "./shared";

export interface OppImportValue {
  account: string;
  name: string;
  practiceArea: string;
  stage: Stage;
  amount: number;
  closeDate: Date;
  probability: number | null;
  nextStep: string | null;
}

const PRACTICE_IDS = DEFAULT_PRACTICE_AREAS.map((p) => p.id);
const PRACTICE_LABELS = Object.fromEntries(DEFAULT_PRACTICE_AREAS.map((p) => [p.id, p.label]));
const PRACTICE_SHORT = Object.fromEntries(
  DEFAULT_PRACTICE_AREAS.map((p) => [p.short.toLowerCase().replace(/[^a-z0-9]/g, ""), p.id]),
);

export const opportunitiesKind: ImportKindDef<OppImportValue> = {
  id: "opportunities",
  label: "Opportunities",
  singular: "opportunity",
  description:
    "Your own pipeline. Created through the same rules as the app (stage history, scoring).",
  fields: [
    ACCOUNT_REF_FIELD,
    {
      id: "name",
      label: "Opportunity name",
      required: true,
      aliases: ["name", "opportunity", "opportunity name", "deal", "deal name"],
      example: "GPU cluster pilot",
    },
    {
      id: "practiceArea",
      label: "Practice area",
      required: true,
      aliases: ["practice", "practice area", "solution area", "category"],
      example: "AI Infrastructure",
      hint: DEFAULT_PRACTICE_AREAS.map((p) => p.label).join(", "),
    },
    {
      id: "stage",
      label: "Stage",
      aliases: ["stage", "sales stage", "status"],
      example: "Discover",
      hint: "Qualify, Discover, Solution, Proposal, Negotiate, Closed won, Closed lost (default Qualify)",
    },
    {
      id: "amount",
      label: "Amount (USD)",
      required: true,
      aliases: ["amount", "value", "deal size", "tcv", "acv"],
      example: "250000",
    },
    {
      id: "closeDate",
      label: "Close date",
      required: true,
      aliases: ["close date", "close", "expected close", "close date (expected)"],
      example: "2026-12-15",
      hint: "YYYY-MM-DD or M/D/YYYY",
    },
    {
      id: "probability",
      label: "Probability %",
      aliases: ["probability", "prob", "win probability", "%"],
      example: "",
      hint: "Defaults from stage",
    },
    {
      id: "nextStep",
      label: "Next step",
      aliases: ["next step", "next steps", "next action"],
      example: "Workshop with platform team",
    },
  ],
  normalize(r) {
    const errors: RowIssue[] = [];
    const account = cell(r.account);
    if (!account) errors.push({ field: "account", message: "Account is required" });
    const name = cell(r.name).replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 160)
      errors.push({ field: "name", message: "Name is required (2–160 characters)" });
    const pRaw = cell(r.practiceArea);
    const practiceArea = pRaw
      ? matchEnum(pRaw, PRACTICE_IDS, PRACTICE_LABELS, PRACTICE_SHORT)
      : null;
    if (!practiceArea)
      errors.push({
        field: "practiceArea",
        message: pRaw ? `Unknown practice area "${pRaw}"` : "Practice area is required",
      });
    const sRaw = cell(r.stage);
    const stage = sRaw
      ? matchEnum(sRaw, STAGES, STAGE_LABELS, { won: "ClosedWon", lost: "ClosedLost" })
      : "Qualify";
    if (!stage) errors.push({ field: "stage", message: `Unknown stage "${sRaw}"` });
    const amount = parseAmount(cell(r.amount));
    if (amount === null)
      errors.push({ field: "amount", message: `Invalid amount "${cell(r.amount)}"` });
    const closeDate = parseDate(cell(r.closeDate));
    if (!closeDate)
      errors.push({ field: "closeDate", message: `Invalid close date "${cell(r.closeDate)}"` });
    const probRaw = cell(r.probability);
    const probability = probRaw ? parsePercent(probRaw) : null;
    if (probRaw && probability === null)
      errors.push({ field: "probability", message: `Invalid probability "${probRaw}"` });
    if (errors.length || !practiceArea || !stage || amount === null || !closeDate)
      return { ok: false, errors };
    return {
      ok: true,
      value: {
        account,
        name,
        practiceArea,
        stage,
        amount,
        closeDate,
        probability,
        nextStep: cell(r.nextStep).slice(0, 300) || null,
      },
    };
  },
};
