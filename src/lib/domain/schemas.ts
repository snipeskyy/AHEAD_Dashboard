import { z } from "zod";
import { BuyingRoleSchema, EngagementSchema, SenioritySchema } from "./enums";

/** Shared request-body schemas (kept out of route files, which may only export handlers). */
export const ContactBody = z.object({
  title: z.string().trim().min(2).max(120),
  function: z.string().trim().min(1).max(80),
  seniority: SenioritySchema,
  buyingRole: BuyingRoleSchema,
  engagement: EngagementSchema.default("None"),
  displayName: z.string().trim().max(120).nullish(), // user-entered only
  reportsToId: z.string().nullish(),
});

export const PlanItemBody = z.object({
  kind: z.enum(["objective", "strategy", "action"]),
  parentId: z.string().nullish(),
  text: z.string().trim().min(2).max(500),
  owner: z.string().trim().max(80).nullish(),
  dueDate: z.coerce.date().nullish(),
  status: z.enum(["open", "in-progress", "done", "blocked"]).default("open"),
  sortOrder: z.number().int().default(0),
});
