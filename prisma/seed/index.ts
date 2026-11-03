/**
 * Deterministic demo seed. All companies are FICTIONAL. CLI: `npm run seed` (prisma/seed/run.ts);
 * also used by Settings → "Reset demo data".
 * Same SEED → same content; dates are relative to the anchor (today, UTC midnight)
 * so the demo always looks current.
 */
import { createHash } from "node:crypto";
import { PrismaClient, type Prisma } from "@prisma/client";
import { DEFAULT_PRACTICE_AREAS } from "../../src/config/practice-areas";
import { computeScoresForAccounts } from "../../src/lib/scoring/account-scores";
import { computeRelevance } from "../../src/lib/scoring/relevance";
import { createSqliteSearchProvider } from "../../src/lib/search/sqlite-provider";
import { tagText, toTagIndex } from "../../src/lib/tagging/rules";
import {
  generateAccounts,
  generateContacts,
  generatePracticeStatuses,
  INITIATIVE_TEMPLATES,
  TECH_STACK_TEMPLATES,
} from "./generators/accounts";
import { generateTouch, PLAN_TEMPLATES, SEED_EVENTS } from "./generators/engagement";
import { generateOpportunity } from "./generators/opportunities";
import { SEED_PLAYS } from "./generators/plays";
import { generateSignalContent } from "./generators/signals";
import { createRng, daysFrom, DAY } from "./rng";

export const SEED = "acc-demo-v1";
export const COUNTS = { accounts: 150, opportunities: 600, signals: 15_000, touches: 2_000 };

async function chunked<T>(rows: T[], size: number, fn: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

export async function clearDemoData(db: PrismaClient) {
  // Order matters only for non-cascading relations.
  await db.touch.deleteMany({ where: { isDemo: true } });
  await db.campaign.deleteMany({ where: { isDemo: true } });
  await db.eventInvite.deleteMany({ where: { account: { isDemo: true } } });
  await db.event.deleteMany({ where: { isDemo: true } });
  await db.note.deleteMany({ where: { id: { startsWith: "demo-" } } });
  await db.activityLog.deleteMany({ where: { id: { startsWith: "demo-" } } });
  await db.notification.deleteMany({ where: { id: { startsWith: "demo-" } } });
  await db.account.deleteMany({ where: { isDemo: true } }); // cascades contacts, signals, opps, …
  await db.play.deleteMany({ where: { isDemo: true } });
}

export async function runSeed(prisma: PrismaClient): Promise<string> {
  const t0 = Date.now();
  const rng = createRng(SEED);
  const anchor = new Date();
  anchor.setUTCHours(0, 0, 0, 0);
  const now = new Date();

  // Drop the FTS index during bulk load (triggers would fire per row); rebuilt at the end.
  const searchProvider = createSqliteSearchProvider(prisma);
  await searchProvider.drop();
  await clearDemoData(prisma);

  // ── Accounts + children ───────────────────────────────────────────────
  const accounts = generateAccounts(rng, COUNTS.accounts);
  await prisma.account.createMany({
    data: accounts.map((a) => ({ ...a, isDemo: true, sourceConfig: { googleNews: false } })),
  });

  const contacts = accounts.flatMap((a) => generateContacts(rng, a.id, a.tier));
  await prisma.contact.createMany({ data: contacts });

  const initiatives = accounts.flatMap((a) =>
    rng
      .sample(INITIATIVE_TEMPLATES, a.tier === "Strategic" ? rng.int(3, 4) : rng.int(1, 3))
      .map((t) => ({
        accountId: a.id,
        title: t.title,
        description: t.description,
        practiceAreas: t.practice,
        source: "seed",
        confidence: Math.round(rng.float(0.35, 0.9) * 100) / 100,
      })),
  );
  await prisma.initiative.createMany({ data: initiatives });

  await prisma.techStackHypothesis.createMany({
    data: accounts.flatMap((a) =>
      rng.sample(TECH_STACK_TEMPLATES, rng.int(3, 6)).map((t) => ({
        accountId: a.id,
        ...t,
        source: "seed",
        confidence: Math.round(rng.float(0.3, 0.85) * 100) / 100,
      })),
    ),
  });

  await prisma.accountPracticeStatus.createMany({
    data: accounts.flatMap((a) => generatePracticeStatuses(rng, a.id, a.tier)),
  });

  // ── Signals ───────────────────────────────────────────────────────────
  const tierWeight = (t: string) => (t === "Strategic" ? 2.2 : t === "Growth" ? 1 : 0.6);
  const accountWeights = accounts.map((a) => [a, tierWeight(a.tier)] as const);
  const signalRows: Prisma.SignalCreateManyInput[] = [];
  for (let i = 0; i < COUNTS.signals; i++) {
    const a = rng.weighted(accountWeights);
    const content = generateSignalContent(rng, a.name, a.industry);
    // Skew toward recent: ~3% in the last 24h, long tail to 180 days.
    const ageDays = rng.bool(0.01) ? rng.float(0, 1) : Math.pow(rng.next(), 1.25) * 180;
    const publishedAt = new Date(now.getTime() - ageDays * DAY);
    const tags = tagText(`${content.title} ${content.summary}`);
    const rel = computeRelevance({
      publishedAt,
      source: "seed",
      keywordHits: tags.hits.length,
      tier: a.tier,
      now,
    });
    signalRows.push({
      id: `demo-sig-${String(i).padStart(5, "0")}`,
      accountId: a.id,
      type: content.type,
      title: content.title,
      summary: content.summary,
      url: null,
      source: "seed",
      publishedAt,
      dedupeHash: createHash("sha1").update(`seed:${i}:${content.title}`).digest("hex"),
      practiceTags: tags.tags,
      tagIndex: toTagIndex(tags.tags),
      relevance: rel.value,
      relevanceParts: { ...rel.parts },
      read: ageDays > 3 ? rng.bool(0.85) : rng.bool(0.2),
      starred: rng.bool(0.02),
      createdAt: new Date(Math.min(now.getTime(), publishedAt.getTime() + rng.int(5, 90) * 60_000)),
      isDemo: true,
    });
  }
  await chunked(signalRows, 1000, (c) => prisma.signal.createMany({ data: c }));

  // ── Opportunities ─────────────────────────────────────────────────────
  const opps = Array.from({ length: COUNTS.opportunities }, (_, i) => {
    const a = rng.weighted(accountWeights);
    return generateOpportunity(rng, i + 1, a.id, a.name, anchor);
  });
  await chunked(opps, 200, (c) =>
    prisma.opportunity.createMany({
      data: c.map(({ history: _h, ...o }) => ({ ...o, isDemo: true })),
    }),
  );
  await chunked(
    opps.flatMap((o) => o.history.map((h) => ({ opportunityId: o.id, ...h }))),
    1000,
    (c) => prisma.stageChange.createMany({ data: c }),
  );
  // Practice status consistency: open opp ⇒ at least ActiveOpp; won ⇒ Delivered.
  for (const o of opps) {
    if (o.stage === "ClosedLost") continue;
    const status = o.stage === "ClosedWon" ? "Delivered" : "ActiveOpp";
    await prisma.accountPracticeStatus.updateMany({
      where: { accountId: o.accountId, practiceArea: o.practiceArea, NOT: { status: "Delivered" } },
      data: { status },
    });
  }

  // ── Plays, campaigns, touches ─────────────────────────────────────────
  await prisma.play.createMany({
    data: SEED_PLAYS.map((p) => ({ ...p, id: `demo-play-${p.slug}`, isDemo: true })),
  });
  const campaigns = Array.from({ length: 40 }, (_, i) => {
    const a = rng.weighted(accountWeights);
    const p = rng.pick(SEED_PLAYS);
    return {
      id: `demo-camp-${String(i + 1).padStart(3, "0")}`,
      name: `${p.name} — ${a.name}`,
      accountId: a.id,
      playId: `demo-play-${p.slug}`,
      status: rng.weighted([
        ["active", 5],
        ["planned", 2],
        ["complete", 3],
      ] as const),
      startDate: daysFrom(anchor, -rng.int(0, 90)),
      isDemo: true,
    };
  });
  await prisma.campaign.createMany({ data: campaigns });

  const personasByAccount = new Map<string, string[]>();
  for (const c of contacts)
    personasByAccount.set(c.accountId, [...(personasByAccount.get(c.accountId) ?? []), c.title]);
  const touches = Array.from({ length: COUNTS.touches }, (_, i) => {
    const camp = rng.bool(0.3) ? rng.pick(campaigns) : null;
    const a = camp ? accounts.find((x) => x.id === camp.accountId)! : rng.weighted(accountWeights);
    return generateTouch(
      rng,
      i + 1,
      a.id,
      personasByAccount.get(a.id) ?? [],
      anchor,
      camp?.id ?? null,
    );
  });
  await chunked(touches, 1000, (c) => prisma.touch.createMany({ data: c }));

  // ── Events, plans, notes, activity, notifications ─────────────────────
  for (const [i, e] of SEED_EVENTS.entries()) {
    await prisma.event.create({
      data: {
        id: `demo-evt-${String(i + 1).padStart(2, "0")}`,
        name: e.name,
        kind: e.kind,
        startsAt: daysFrom(anchor, e.offsetDays),
        location: e.location,
        isDemo: true,
        invites: {
          create: rng.sample(accounts, rng.int(3, 10)).map((a) => ({
            accountId: a.id,
            persona: rng.pick(personasByAccount.get(a.id) ?? ["Chief Information Officer"]),
            status:
              e.offsetDays < 0
                ? rng.pick(["attended", "followed-up", "invited"])
                : rng.pick(["planned", "invited", "registered"]),
          })),
        },
      },
    });
  }

  const planRows: Prisma.AccountPlanItemCreateManyInput[] = [];
  for (const a of accounts.filter((x) => x.tier === "Strategic")) {
    rng.sample(PLAN_TEMPLATES.objectives, 2).forEach((obj, oi) => {
      const objId = `${a.id}-obj${oi}`;
      planRows.push({ id: objId, accountId: a.id, kind: "objective", text: obj, sortOrder: oi });
      const stratId = `${objId}-s`;
      planRows.push({
        id: stratId,
        accountId: a.id,
        kind: "strategy",
        parentId: objId,
        text: rng.pick(PLAN_TEMPLATES.strategies),
        sortOrder: 0,
      });
      rng.sample(PLAN_TEMPLATES.actions, 2).forEach((act, ai) =>
        planRows.push({
          accountId: a.id,
          kind: "action",
          parentId: stratId,
          text: act,
          owner: rng.pick(["Me", "SE", "Partner", "Practice lead"]),
          dueDate: daysFrom(anchor, rng.int(-10, 60)),
          status: rng.pick(["open", "open", "done"]),
          sortOrder: ai,
        }),
      );
    });
  }
  await prisma.accountPlanItem.createMany({ data: planRows });

  const NOTE_BODIES = [
    "Discussed priorities for next fiscal year; AI and consolidation are top two.",
    "Champion is supportive but needs CFO air cover.",
    "Procurement wants a three-year view of costs.",
    "Follow up on the security assessment results.",
    "Team is evaluating two competing approaches; we are preferred on delivery risk.",
  ];
  await prisma.note.createMany({
    data: Array.from({ length: 150 }, (_, i) => {
      const a = rng.pick(accounts);
      return {
        id: `demo-note-${i}`,
        entityType: "account",
        entityId: a.id,
        body: rng.pick(NOTE_BODIES),
        createdAt: daysFrom(anchor, -rng.int(0, 120)),
      };
    }),
  });

  const recentChanges = opps.flatMap((o) =>
    o.history
      .slice(1)
      .filter((h) => anchor.getTime() - h.changedAt.getTime() < 10 * DAY)
      .map((h) => ({ o, h })),
  );
  await prisma.activityLog.createMany({
    data: recentChanges.map(({ o, h }, i) => ({
      id: `demo-act-${i}`,
      entityType: "opportunity",
      entityId: o.id,
      action: "stage.changed",
      summary: `${o.name}: ${h.fromStage} → ${h.toStage}`,
      diff: { from: h.fromStage, to: h.toStage },
      createdAt: h.changedAt,
    })),
  });

  const hot = signalRows.filter((s) => (s.relevance as number) >= 60).slice(0, 6);
  await prisma.notification.createMany({
    data: hot.map((s, i) => ({
      id: `demo-ntf-${i}`,
      kind: "signal",
      title: s.title,
      body: `Relevance ${s.relevance}`,
      href: `/signals?focus=${s.id}`,
      createdAt: s.createdAt as Date,
    })),
  });

  // ── Scores (health + whitespace) ──────────────────────────────────────
  await computeScoresForAccounts(prisma, { now, accountIds: accounts.map((a) => a.id) });

  await searchProvider.ensureReady(); // recreates table + triggers and rebuilds from source tables

  const counts = await Promise.all([
    prisma.account.count(),
    prisma.opportunity.count(),
    prisma.signal.count(),
    prisma.touch.count(),
  ]);
  return `[seed] ${SEED}: accounts=${counts[0]} opps=${counts[1]} signals=${counts[2]} touches=${counts[3]} practices=${DEFAULT_PRACTICE_AREAS.length} in ${((Date.now() - t0) / 1000).toFixed(1)}s`;
}
