/**
 * Smart lists (pure): saved filters over accounts, opportunities or signals. Rules are evaluated against plain
 * row objects, so the same definition works on the server (results API) and in tests.
 */
import { z } from "zod";

export const SMART_ENTITIES = ["account", "opportunity", "signal"] as const;
export type SmartEntity = (typeof SMART_ENTITIES)[number];
export type FieldType = "text" | "number" | "enum" | "date" | "boolean" | "list";

export interface SmartField {
  id: string;
  label: string;
  type: FieldType;
  options?: string[];
}

export const OPS: Record<FieldType, Array<{ id: string; label: string }>> = {
  text: [{ id: "contains", label: "contains" }, { id: "eq", label: "is" }, { id: "empty", label: "is empty" }, { id: "notEmpty", label: "is not empty" }],
  number: [{ id: "gte", label: "≥" }, { id: "lte", label: "≤" }, { id: "eq", label: "=" }],
  enum: [{ id: "in", label: "is any of" }, { id: "notIn", label: "is none of" }],
  date: [{ id: "withinDays", label: "within last N days" }, { id: "olderThanDays", label: "older than N days" }, { id: "nextDays", label: "within next N days" }, { id: "empty", label: "is empty" }],
  boolean: [{ id: "isTrue", label: "is yes" }, { id: "isFalse", label: "is no" }],
  list: [{ id: "has", label: "includes" }, { id: "lacks", label: "does not include" }, { id: "empty", label: "is empty" }],
};

export const RuleSchema = z.object({ field: z.string().max(60), op: z.string().max(20), value: z.unknown().optional() });
export const RulesSchema = z.object({ match: z.enum(["all", "any"]).default("all"), rules: z.array(RuleSchema).max(20) });
export type Rules = z.infer<typeof RulesSchema>;

const DAY = 86_400_000;
const lc = (v: unknown) => String(v ?? "").toLowerCase();

export function evalRule(row: Record<string, unknown>, r: z.infer<typeof RuleSchema>, now: Date): boolean {
  const v = row[r.field];
  const n = Number(r.value);
  const arr = Array.isArray(r.value) ? (r.value as unknown[]).map(lc) : [lc(r.value)];
  switch (r.op) {
    case "contains": return lc(v).includes(lc(r.value));
    case "eq": return typeof v === "number" ? v === n : lc(v) === lc(r.value);
    case "empty": return v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length);
    case "notEmpty": return !(v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length));
    case "gte": return typeof v === "number" && v >= n;
    case "lte": return typeof v === "number" && v <= n;
    case "in": return arr.includes(lc(v));
    case "notIn": return !arr.includes(lc(v));
    case "isTrue": return v === true;
    case "isFalse": return v === false || v === null || v === undefined;
    case "has": return Array.isArray(v) && v.map(lc).some((x) => arr.includes(x));
    case "lacks": return !Array.isArray(v) || !v.map(lc).some((x) => arr.includes(x));
    case "withinDays": return !!v && now.getTime() - new Date(String(v)).getTime() <= n * DAY;
    case "olderThanDays": return !v || now.getTime() - new Date(String(v)).getTime() > n * DAY;
    case "nextDays": {
      if (!v) return false;
      const t = new Date(String(v)).getTime() - now.getTime();
      return t >= 0 && t <= n * DAY;
    }
    default: return false;
  }
}

export function matches(row: Record<string, unknown>, rules: Rules, now: Date) {
  if (!rules.rules.length) return true;
  const res = rules.rules.map((r) => evalRule(row, r, now));
  return rules.match === "all" ? res.every(Boolean) : res.some(Boolean);
}
