/**
 * Field-level visibility by role (Phase 8). Config only: edit this file to change who sees what.
 * `hidden` lists UI field keys; each key maps to the export fields ("<sectionId>.<fieldId>") it also hides,
 * so the same rule applies on screen, in exports and in shareable packs.
 */
export const VISIBILITY_FIELDS = {
  "opp.amount": { label: "Deal amounts & pipeline $", export: ["opportunities.pipeline.amount", "opportunities.forecast.forecast", "account-intel.brief.opps"] },
  "opp.forecast": { label: "Forecast category & probability", export: ["opportunities.pipeline.probability", "opportunities.forecast.forecast"] },
  "opp.meddpicc": { label: "MEDDPICC qualification", export: [] },
  "opp.competitors": { label: "Competitors", export: ["opportunities.pipeline.competitors"] },
  "account.scores": { label: "Health & whitespace scores", export: ["account-intel.overview.tier"] },
  "signal.relevance": { label: "Signal relevance scores", export: ["signals.key-signals.relevance"] },
  "partner.registrations": { label: "Partner deal registrations", export: [] },
  "notes": { label: "Private notes", export: [] },
} as const satisfies Record<string, { label: string; export: readonly string[] }>;

export type VisibilityField = keyof typeof VISIBILITY_FIELDS;

export const ROLES = [
  { id: "client-director", label: "Client Director", hidden: [] },
  { id: "associate-client-director", label: "Associate Client Director", hidden: [] },
  { id: "solutions-architect", label: "Solutions Architect", hidden: ["opp.forecast", "partner.registrations", "notes"] },
  { id: "inside-sales", label: "Inside Sales", hidden: ["opp.amount", "opp.forecast", "opp.meddpicc", "opp.competitors", "partner.registrations", "notes"] },
] as const satisfies ReadonlyArray<{ id: string; label: string; hidden: readonly VisibilityField[] }>;

export type RoleId = (typeof ROLES)[number]["id"];
export const ROLE_IDS = ROLES.map((r) => r.id) as [RoleId, ...RoleId[]];
export const DEFAULT_ROLE: RoleId = "associate-client-director";

export const roleById = (id: string | null | undefined) => ROLES.find((r) => r.id === id) ?? ROLES.find((r) => r.id === DEFAULT_ROLE)!;
export const hiddenFor = (role: string | null | undefined): ReadonlySet<VisibilityField> => new Set(roleById(role).hidden);
export const canSee = (role: string | null | undefined, field: VisibilityField) => !hiddenFor(role).has(field);
/** Export field keys this role may not export (merged into the export's redaction policy). */
export const exportHiddenFor = (role: string | null | undefined): string[] =>
  [...hiddenFor(role)].flatMap((k) => VISIBILITY_FIELDS[k].export);
