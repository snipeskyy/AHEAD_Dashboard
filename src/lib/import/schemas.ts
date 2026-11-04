import { z } from "zod";
import { IMPORT_KINDS, INPUT_TYPES } from "./types";

export const KindSchema = z.enum(IMPORT_KINDS);
const Rows = z
  .array(z.record(z.string(), z.string().max(20_000)))
  .min(1)
  .max(5000);

export const PreviewBody = z.object({ kind: KindSchema, rows: Rows });

export const CommitBody = z.object({
  kind: KindSchema,
  rows: Rows,
  decisions: z.record(z.string(), z.enum(["create", "merge", "skip"])).default({}),
  fileName: z.string().max(260).nullish(),
  inputType: z.enum(INPUT_TYPES),
});

export const MappingBody = z.object({
  kind: KindSchema,
  name: z.string().trim().min(1).max(80),
  mapping: z.record(z.string(), z.string().max(200)),
});
