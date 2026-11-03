import { z } from "zod";
import { db } from "@/lib/db";
import { SignalTypeSchema } from "@/lib/domain/enums";
import { ingestSignals } from "@/lib/ingest/ingest";
import { classifySignalType } from "@/lib/adapters/classify";
import { logActivity } from "@/lib/server/activity";
import { HttpError, handler, json, readJson } from "@/lib/server/http";
import { querySignals, querySignalsByIds } from "@/lib/server/signals";

const list = (s?: string) => (s ? s.split(",").filter(Boolean) : undefined);
const Query = z.object({
  accountId: z.string().optional(),
  accountIds: z.string().optional().transform(list),
  types: z.string().optional().transform(list),
  practices: z.string().optional().transform(list),
  sources: z.string().optional().transform(list),
  tiers: z.string().optional().transform(list),
  q: z.string().max(200).optional(),
  minRelevance: z.coerce.number().min(0).max(100).optional(),
  sinceDays: z.coerce.number().min(0).max(3650).optional(),
  starred: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  unread: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  inNextSummary: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  includeDismissed: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  demo: z.enum(["only", "exclude"]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  sort: z.enum(["recent", "relevance"]).default("recent"),
});

/** Cursor-paginated, server-filtered signal feed. */
export const GET = handler(async (req: Request) => {
  const q = Query.parse(Object.fromEntries(new URL(req.url).searchParams));
  return json(
    await querySignals({
      ...q,
      since:
        q.sinceDays !== undefined ? new Date(Date.now() - q.sinceDays * 86_400_000) : undefined,
    }),
  );
});

const Manual = z.object({
  accountId: z.string().min(1),
  url: z.string().url(),
  title: z.string().trim().min(3).max(300),
  type: SignalTypeSchema.optional(),
  notes: z.string().trim().max(5000).optional(),
  publishedAt: z.coerce.date().optional(),
});

/** Manual signal entry: paste a public URL plus notes. Goes through the same ingest pipeline. */
export const POST = handler(async (req: Request) => {
  const m = Manual.parse(await readJson(req));
  if (!/^https?:\/\//i.test(m.url)) throw new HttpError(400, "URL must be http(s)");
  const r = await ingestSignals(db, [
    {
      accountId: m.accountId,
      type: m.type ?? classifySignalType(`${m.title} ${m.notes ?? ""}`),
      title: m.title,
      summary: m.notes ?? null,
      url: m.url,
      source: "manual",
      publishedAt: m.publishedAt ?? new Date(),
      tagText: m.notes,
    },
  ]);
  if (r.duplicates) throw new HttpError(409, "This signal already exists for the account");
  if (!r.inserted) throw new HttpError(400, "Signal was not accepted (check account and URL)");
  const id = r.insertedIds[0];
  if (m.notes)
    await db.note.create({ data: { entityType: "signal", entityId: id, body: m.notes } });
  await logActivity({
    entityType: "account",
    entityId: m.accountId,
    action: "signal.manual",
    summary: `Manual signal added: ${m.title.slice(0, 100)}`,
  });
  return json((await querySignalsByIds([id]))[0], { status: 201 });
});
