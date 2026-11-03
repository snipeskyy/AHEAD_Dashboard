import { z } from "zod";
import { DEFAULT_PRACTICE_AREAS } from "@/config/practice-areas";
import { CLOSED_STAGES, OPEN_STAGES, StageSchema } from "@/lib/domain/enums";
import { handler, json, readJson } from "@/lib/server/http";
import { createOpportunity, listOpportunities } from "@/lib/server/opportunities";

const Query = z.object({
  status: z.enum(["open", "closed", "all"]).default("all"),
  accountId: z.string().optional(),
});

export const GET = handler(async (req: Request) => {
  const { status, accountId } = Query.parse(Object.fromEntries(new URL(req.url).searchParams));
  const stage =
    status === "open"
      ? { in: [...OPEN_STAGES] }
      : status === "closed"
        ? { in: [...CLOSED_STAGES] }
        : undefined;
  return json({ items: await listOpportunities({ stage, accountId }) });
});

const Create = z.object({
  accountId: z.string().min(1),
  name: z.string().trim().min(2).max(160),
  practiceArea: z.enum(DEFAULT_PRACTICE_AREAS.map((p) => p.id) as [string, ...string[]]),
  stage: StageSchema.default("Qualify"),
  amount: z.number().min(0).max(1e10),
  closeDate: z.coerce.date(),
  nextStep: z.string().max(500).nullish(),
  sourceSignalId: z.string().nullish(),
});

export const POST = handler(async (req: Request) => {
  const input = Create.parse(await readJson(req));
  return json(await createOpportunity(input), { status: 201 });
});
