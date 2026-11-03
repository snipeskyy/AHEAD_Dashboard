import type { ExportSectionDefinition } from "@/modules/types";
import type { Block, DocSection } from "./types";

export interface RedactionPolicy {
  audience: "internal" | "customer";
  hiddenFields: string[];
  mode: "apply" | "preview";
}

/** The set of "<sectionId>.<fieldId>" keys that must not appear, given audience + explicit toggles. */
export function hiddenFieldSet(
  defs: ExportSectionDefinition[],
  policy: Pick<RedactionPolicy, "audience" | "hiddenFields">,
): Set<string> {
  const hidden = new Set(policy.hiddenFields);
  if (policy.audience === "customer")
    for (const d of defs)
      for (const f of d.fields) if (f.visibility === "internal") hidden.add(`${d.id}.${f.id}`);
  return hidden;
}

/** Fields the user may toggle; in customer mode internal fields are locked off. */
export function fieldStates(
  def: ExportSectionDefinition,
  policy: Pick<RedactionPolicy, "audience" | "hiddenFields">,
) {
  return def.fields.map((f) => {
    const key = `${def.id}.${f.id}`;
    const locked = policy.audience === "customer" && f.visibility === "internal";
    return { ...f, key, locked, visible: !locked && !policy.hiddenFields.includes(key) };
  });
}

/**
 * Applies redaction. "apply" removes hidden content entirely (used for every real export);
 * "preview" keeps it but marks it `redacted` so the builder can highlight what will disappear.
 * Customer-facing audiences drop internal-only sections wholesale.
 */
export function applyRedaction(
  sections: DocSection[],
  defs: ExportSectionDefinition[],
  policy: RedactionPolicy,
) {
  const hidden = hiddenFieldSet(defs, policy);
  const removedFields = new Set<string>();
  const removedSections: string[] = [];
  const preview = policy.mode === "preview";
  const isHidden = (sectionId: string, field?: string) => {
    if (!field) return false;
    const key = `${sectionId}.${field}`;
    if (hidden.has(key)) {
      removedFields.add(key);
      return true;
    }
    return false;
  };

  const out: DocSection[] = [];
  for (const s of sections) {
    const def = defs.find((d) => d.id === s.id);
    if (policy.audience === "customer" && (s.internalOnly || def?.internalOnly)) {
      removedSections.push(s.id);
      if (preview) out.push({ ...s, redacted: true });
      continue;
    }
    const blocks: Block[] = [];
    for (const b of s.blocks) {
      if (isHidden(s.id, b.field)) {
        if (preview) blocks.push({ ...b, redacted: true });
        continue;
      }
      blocks.push(redactInside(s.id, b, isHidden, preview));
    }
    // Drop sections that became empty (apart from headings).
    if (!preview && blocks.every((b) => b.kind === "heading")) {
      removedSections.push(s.id);
      continue;
    }
    out.push({ ...s, blocks });
  }
  return { sections: out, removedFields: [...removedFields].sort(), removedSections };
}

function redactInside(
  sectionId: string,
  b: Block,
  isHidden: (s: string, f?: string) => boolean,
  preview: boolean,
): Block {
  const keep = <T extends { field?: string; redacted?: boolean }>(xs: T[]): T[] =>
    preview
      ? xs.map((x) => (isHidden(sectionId, x.field) ? { ...x, redacted: true } : x))
      : xs.filter((x) => !isHidden(sectionId, x.field));
  switch (b.kind) {
    case "kv":
      return { ...b, items: keep(b.items) };
    case "list":
      return { ...b, items: keep(b.items) };
    case "table": {
      const columns = keep(b.columns);
      if (preview) return { ...b, columns };
      const allowed = new Set(columns.map((c) => c.key));
      return {
        ...b,
        columns,
        rows: b.rows.map((r) =>
          Object.fromEntries(Object.entries(r).filter(([k]) => allowed.has(k))),
        ),
      };
    }
    default:
      return b;
  }
}
