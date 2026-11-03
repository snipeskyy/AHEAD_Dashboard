import type { ZodObject, ZodRawShape, ZodType } from "zod";

/** Introspects a flat Zod object schema into form field descriptors (number / boolean / string / enum). */
export interface SchemaField {
  key: string;
  label: string;
  kind: "number" | "boolean" | "string" | "enum";
  defaultValue: unknown;
  min?: number;
  max?: number;
  integer?: boolean;
  options?: string[];
}

interface Def {
  type: string;
  innerType?: ZodType;
  defaultValue?: unknown;
  entries?: Record<string, string>;
  checks?: Array<{
    _zod?: { def?: { check?: string; value?: number; inclusive?: boolean; format?: string } };
  }>;
}

const defOf = (t: ZodType) => (t as unknown as { def: Def }).def;

export function describeSchema(schema: ZodObject<ZodRawShape>): SchemaField[] {
  const defaults = schema.safeParse({});
  return Object.entries(schema.shape).map(([key, outer]) => {
    let t = outer as ZodType;
    const label = (outer as ZodType).description ?? key;
    while (["default", "optional", "nullable"].includes(defOf(t).type) && defOf(t).innerType)
      t = defOf(t).innerType!;
    const def = defOf(t);
    const field: SchemaField = {
      key,
      label,
      kind:
        def.type === "number"
          ? "number"
          : def.type === "boolean"
            ? "boolean"
            : def.type === "enum"
              ? "enum"
              : "string",
      defaultValue: defaults.success ? (defaults.data as Record<string, unknown>)[key] : undefined,
    };
    if (def.type === "enum" && def.entries) field.options = Object.values(def.entries);
    for (const c of def.checks ?? []) {
      const cd = c._zod?.def;
      if (!cd) continue;
      if (cd.check === "greater_than") field.min = cd.value;
      if (cd.check === "less_than") field.max = cd.value;
      if (cd.check === "number_format" && cd.format === "safeint") field.integer = true;
    }
    return field;
  });
}
