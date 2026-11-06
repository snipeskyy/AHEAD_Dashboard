import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { dedupeHash } from "@/lib/adapters/dedupe";
import type { NormalizedSignal } from "@/lib/adapters/types";
import { SignalTypeSchema } from "@/lib/domain/enums";
import { intelPolicyViolation } from "@/lib/intel/policy";
import { computeRelevance } from "@/lib/scoring/relevance";
import { readSetting } from "@/lib/settings/store";
import { tagText, toTagIndex } from "@/lib/tagging/rules";

export const NormalizedSignalSchema = z.object({
  accountId: z.string().min(1),
  type: SignalTypeSchema,
  title: z.string().trim().min(3).max(400),
  summary: z.string().max(4000).nullable(),
  url: z.string().url().nullable(),
  source: z.string().min(1),
  publishedAt: z.date(),
  tagText: z.string().optional(),
  dedupeKey: z.string().optional(),
  evidence: z.array(z.any()).optional(),
  priority: z.literal("high").optional(),
});

export interface IngestResult {
  received: number;
  inserted: number;
  duplicates: number;
  invalid: number;
  evidence: number;
  alerts: number;
  insertedIds: string[];
}

/**
 * The single path every signal takes into the database: validate → dedupe → tag → score →
 * insert → derived evidence (policy-checked) → notifications above the alert threshold.
 */
export async function ingestSignals(
  db: PrismaClient,
  items: NormalizedSignal[],
  now = new Date(),
): Promise<IngestResult> {
  const res: IngestResult = {
    received: items.length,
    inserted: 0,
    duplicates: 0,
    invalid: 0,
    evidence: 0,
    alerts: 0,
    insertedIds: [],
  };
  if (!items.length) return res;
  const [rules, relCfg, modSettings] = await Promise.all([
    readSetting(db, "tagging.rules"),
    readSetting(db, "scoring.relevance"),
    readSetting(db, "modules.settings"),
  ]);
  const threshold = Number(modSettings.signals?.alertThreshold ?? 75);
  const accounts = new Map(
    (
      await db.account.findMany({
        where: { id: { in: [...new Set(items.map((i) => i.accountId))] } },
        select: { id: true, name: true, tier: true, isDemo: true },
      })
    ).map((a) => [a.id, a]),
  );

  for (const raw of items) {
    const parsed = NormalizedSignalSchema.safeParse(raw);
    const account = accounts.get(raw.accountId);
    if (!parsed.success || !account) {
      res.invalid++;
      continue;
    }
    const s = parsed.data;
    const hash = dedupeHash(s.accountId, s.url, s.title, s.dedupeKey);
    if (await db.signal.findUnique({ where: { dedupeHash: hash }, select: { id: true } })) {
      res.duplicates++;
      continue;
    }
    const tags = tagText(`${s.title} ${s.summary ?? ""} ${s.tagText ?? ""}`, rules);
    const scored = computeRelevance(
      {
        publishedAt: s.publishedAt,
        source: s.source,
        keywordHits: tags.hits.length,
        tier: account.tier,
        now,
      },
      relCfg,
    );
    const rel =
      s.priority === "high" && scored.value < 90
        ? { ...scored, value: 90, parts: { ...scored.parts, priorityFloor: 90 } }
        : scored;
    const created = await db.signal.create({
      data: {
        accountId: s.accountId,
        type: s.type,
        title: s.title,
        summary: s.summary,
        url: s.url,
        source: s.source,
        publishedAt: s.publishedAt,
        dedupeHash: hash,
        practiceTags: tags.tags,
        tagIndex: toTagIndex(tags.tags),
        relevance: rel.value,
        relevanceParts: { ...rel.parts } as Prisma.InputJsonObject,
        isDemo: account.isDemo,
      },
    });
    res.inserted++;
    res.insertedIds.push(created.id);

    for (const ev of raw.evidence ?? []) {
      const violation = intelPolicyViolation(account, { source: s.source, sourceUrl: s.url });
      if (violation) continue;
      if (ev.kind === "initiative") {
        const exists = await db.initiative.findFirst({
          where: { accountId: s.accountId, title: ev.title },
        });
        if (exists)
          await db.initiative.update({
            where: { id: exists.id },
            data: {
              confidence: Math.max(exists.confidence, ev.confidence),
              sourceUrl: s.url,
              signalId: created.id,
            },
          });
        else
          await db.initiative.create({
            data: {
              accountId: s.accountId,
              title: ev.title,
              description: ev.description,
              practiceAreas: ev.practiceAreas,
              source: "job-post",
              sourceUrl: s.url,
              signalId: created.id,
              confidence: ev.confidence,
            },
          });
        res.evidence++;
      } else if (ev.kind === "tech") {
        const exists = await db.techStackHypothesis.findFirst({
          where: { accountId: s.accountId, technology: ev.technology },
        });
        if (!exists) {
          await db.techStackHypothesis.create({
            data: {
              accountId: s.accountId,
              category: ev.category,
              technology: ev.technology,
              evidence: ev.evidence,
              source: "job-post",
              sourceUrl: s.url,
              confidence: ev.confidence,
            },
          });
          res.evidence++;
        }
      }
    }

    if (rel.value >= threshold || s.priority === "high") {
      await db.notification.create({
        data: {
          kind: "signal",
          title: `${account.name}: ${s.title}`.slice(0, 300),
          body: `Relevance ${Math.round(rel.value)}`,
          href: `/signals?focus=${created.id}`,
        },
      });
      res.alerts++;
    }
  }
  return res;
}
