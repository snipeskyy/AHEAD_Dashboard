import "server-only";
import { DEFAULT_PRACTICE_AREAS, practiceLabel } from "@/config/practice-areas";
import { perAccount, pct, day } from "@/lib/export/build-helpers";
import type { SectionBuilders } from "@/lib/export/builder-types";
import { BUYING_ROLE_LABELS, type BuyingRole } from "@/lib/domain/enums";
import { committeeGaps } from "@/lib/intel/committee";
import type { Block, Cell } from "@/lib/export/types";

const STATUS: Record<string, string> = {
  NotEngaged: "Not engaged",
  Exploring: "Exploring",
  ActiveOpp: "Active",
  Delivered: "Delivered",
};
const srcLabel = (source: string) =>
  source === "user-hypothesis" ? "Hypothesis" : source === "seed" ? "Demo data" : source;

const money = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n / 1e3)}K`);

export const builders: SectionBuilders = {
  "account-intel.brief": (ctx) =>
    perAccount(ctx, async (acc) => {
      const { buildBrief } = await import("@/lib/server/brief");
      const b = await buildBrief(ctx.db, acc.id, ctx.now);
      const blocks: Block[] = [
        {
          kind: "kv",
          field: "snapshot",
          items: [
            { label: "Industry", value: b.account.industry },
            { label: "Headquarters", value: b.account.hq ?? "—" },
            { label: "Size", value: [b.account.employeeBand, b.account.revenueBand].filter(Boolean).join(" · ") || "—" },
            { label: "Budget timing", value: b.fiscal?.label ?? "Fiscal year end unknown" },
            ...(b.meeting ? [{ label: "Meeting", value: `${b.meeting.title} · ${new Date(b.meeting.startsAt).toLocaleString("en-US")}` }] : []),
          ],
        },
      ];
      if (b.account.description) blocks.push({ kind: "paragraph", field: "snapshot", text: b.account.description });
      blocks.push(
        { kind: "heading", level: 3, text: "Suggested questions", field: "questions" },
        { kind: "list", ordered: true, field: "questions", items: b.questions.map((q) => ({ text: q.q, sub: q.why })) },
      );
      if (b.signals.length)
        blocks.push(
          { kind: "heading", level: 3, text: "Latest signals", field: "signals" },
          { kind: "list", field: "signals", items: b.signals.map((s) => ({ text: s.title, sub: `${s.type} · ${day(new Date(s.publishedAt))}`, href: s.url ?? undefined })) },
        );
      if (b.opps.length)
        blocks.push(
          { kind: "heading", level: 3, text: "Open opportunities", field: "opps" },
          {
            kind: "table",
            field: "opps",
            columns: [
              { key: "name", label: "Opportunity" },
              { key: "stage", label: "Stage" },
              { key: "amount", label: "Amount", align: "right" },
              { key: "close", label: "Close" },
              { key: "next", label: "Next step" },
            ],
            rows: b.opps.map((o) => ({
              name: { text: o.name },
              stage: { text: o.stage },
              amount: { text: money(o.amount) },
              close: { text: day(new Date(o.closeDate)) },
              next: { text: [o.nextStep, o.nextStepDate ? `by ${day(new Date(o.nextStepDate))}` : ""].filter(Boolean).join(" ") || "—" },
            })),
          },
        );
      blocks.push(
        { kind: "heading", level: 3, text: "Buying committee", field: "committee" },
        {
          kind: "list",
          field: "committee",
          items: [
            ...b.committee.contacts.map((c) => ({ text: [c.name, c.title].filter(Boolean).join(", "), sub: `${c.role} · ${c.engagement}` })),
            ...b.committee.gaps.map((g) => ({ text: `Gap: ${g}` })),
          ],
        },
      );
      if (b.touches.length)
        blocks.push(
          { kind: "heading", level: 3, text: "Last touches", field: "touches" },
          { kind: "list", field: "touches", items: b.touches.map((t) => ({ text: `${t.channel} with ${t.persona}`, sub: [day(new Date(t.completedAt)), t.outcome, t.angle].filter(Boolean).join(" · ") })) },
        );
      if (b.initiatives.length)
        blocks.push(
          { kind: "heading", level: 3, text: "Initiative evidence", field: "evidence" },
          {
            kind: "list",
            field: "evidence",
            items: b.initiatives.map((i) => ({ text: i.title, sub: [i.evidence ? `“${i.evidence}”` : "", i.section].filter(Boolean).join(" · "), href: i.sourceUrl ?? undefined })),
          },
        );
      if (b.plays.length)
        blocks.push(
          { kind: "heading", level: 3, text: "Recommended plays", field: "plays" },
          { kind: "list", field: "plays", items: b.plays.map((p) => ({ text: p.name, sub: p.reasons.slice(0, 2).join("; ") })) },
        );
      return blocks;
    }),
  "account-intel.overview": (ctx) =>
    perAccount(ctx, async (acc) => {
      const a = await ctx.db.account.findUniqueOrThrow({ where: { id: acc.id } });
      return [
        {
          kind: "kv",
          items: [
            {
              label: "Industry",
              value: [a.industry, a.subIndustry].filter(Boolean).join(" · "),
              field: "firmographics",
            },
            { label: "Headquarters", value: a.hq ?? "—", field: "firmographics" },
            {
              label: "Employees / revenue",
              value: [a.employeeBand, a.revenueBand].filter(Boolean).join(" · ") || "—",
              field: "firmographics",
            },
            { label: "Tier", value: a.tier, field: "tier" },
            {
              label: "Health score",
              value: `${Math.round(a.healthScore)} / 100`,
              field: "healthScore",
            },
            {
              label: "Whitespace score",
              value: `${Math.round(a.whitespaceScore)} / 100`,
              field: "whitespaceScore",
            },
          ],
        },
      ];
    }),

  "account-intel.initiatives": (ctx) =>
    perAccount(ctx, async (acc) => {
      const items = await ctx.db.initiative.findMany({
        where: { accountId: acc.id },
        orderBy: { confidence: "desc" },
        take: 8,
      });
      if (!items.length)
        return [
          { kind: "paragraph", text: "No initiatives identified yet.", field: "initiatives" },
        ];
      const rows: Array<Record<string, Cell>> = items.map((i) => ({
        title: { text: i.title },
        practice: {
          text: (i.practiceAreas as string[]).map((p) => practiceLabel(p, true)).join(", "),
        },
        confidence: { text: pct(i.confidence) },
        evidence: i.sourceUrl
          ? { text: srcLabel(i.source), href: i.sourceUrl }
          : { text: srcLabel(i.source) },
      }));
      return [
        {
          kind: "table",
          field: "initiatives",
          columns: [
            { key: "title", label: "Initiative", field: "initiatives" },
            { key: "practice", label: "Practice", field: "initiatives" },
            { key: "confidence", label: "Confidence", align: "right", field: "confidence" },
            { key: "evidence", label: "Evidence", field: "evidence" },
          ],
          rows,
        },
      ];
    }),

  "account-intel.buying-committee": (ctx) =>
    perAccount(ctx, async (acc) => {
      const contacts = await ctx.db.contact.findMany({
        where: { accountId: acc.id },
        orderBy: { seniority: "asc" },
      });
      const gaps = committeeGaps(contacts);
      return [
        {
          kind: "table",
          field: "personas",
          columns: [
            { key: "title", label: "Persona", field: "personas" },
            { key: "role", label: "Buying role", field: "personas" },
            { key: "engagement", label: "Engagement", field: "personas" },
          ],
          rows: contacts.map((c) => ({
            title: { text: c.displayName ? `${c.title} (${c.displayName})` : c.title },
            role: { text: BUYING_ROLE_LABELS[c.buyingRole as BuyingRole] ?? c.buyingRole },
            engagement: { text: c.engagement },
          })),
        },
        ...(gaps.length
          ? [
              {
                kind: "list" as const,
                field: "gaps",
                items: gaps.map((g) => ({ text: g.message, sub: g.severity })),
              },
            ]
          : []),
      ];
    }),

  "account-intel.whitespace": async (ctx) => {
    const list = ctx.accounts.slice(0, 25);
    const statuses = await ctx.db.accountPracticeStatus.findMany({
      where: { accountId: { in: list.map((a) => a.id) } },
    });
    const by = new Map(statuses.map((s) => [`${s.accountId}|${s.practiceArea}`, s.status]));
    const columns = [
      { key: "account", label: "Account", field: "matrix" },
      ...DEFAULT_PRACTICE_AREAS.map((p) => ({ key: p.id, label: p.short, field: "matrix" })),
    ];
    const rows = list.map((a) => ({
      account: { text: a.name },
      ...Object.fromEntries(
        DEFAULT_PRACTICE_AREAS.map((p) => [
          p.id,
          { text: STATUS[by.get(`${a.id}|${p.id}`) ?? "NotEngaged"] },
        ]),
      ),
    }));
    const blocks: Block[] = [
      { kind: "table", field: "matrix", caption: "Engagement by practice area", columns, rows },
    ];
    if (ctx.accounts.length > list.length)
      blocks.push({
        kind: "callout",
        text: `Showing ${list.length} of ${ctx.accounts.length} accounts.`,
        tone: "info",
      });
    // Portfolio-level summary chart: how many accounts are engaged per practice.
    if (list.length > 1) {
      const counts = DEFAULT_PRACTICE_AREAS.map(
        (p) =>
          list.filter((a) => (by.get(`${a.id}|${p.id}`) ?? "NotEngaged") !== "NotEngaged").length,
      );
      blocks.unshift({
        kind: "chart",
        field: "matrix",
        title: "Accounts engaged per practice area",
        spec: {
          type: "hbar",
          categories: DEFAULT_PRACTICE_AREAS.map((p) => p.short),
          series: [{ name: "Accounts engaged", values: counts }],
          valueFormat: "number",
        },
      });
    }
    return blocks;
  },

  "account-intel.plan": (ctx) =>
    perAccount(ctx, async (acc) => {
      const [items, account] = await Promise.all([
        ctx.db.accountPlanItem.findMany({
          where: { accountId: acc.id },
          orderBy: [{ sortOrder: "asc" }],
        }),
        ctx.db.account.findUniqueOrThrow({ where: { id: acc.id }, select: { ownerNotes: true } }),
      ]);
      const blocks: Block[] = [];
      const objectives = items.filter((i) => i.kind === "objective");
      if (!objectives.length)
        blocks.push({
          kind: "paragraph",
          text: "No account plan recorded yet.",
          field: "objectives",
        });
      for (const o of objectives) {
        blocks.push({ kind: "heading", text: o.text, level: 3, field: "objectives" });
        const strategies = items.filter((i) => i.parentId === o.id);
        const actions = items.filter((i) => strategies.some((s) => s.id === i.parentId));
        if (strategies.length)
          blocks.push({
            kind: "list",
            field: "objectives",
            items: strategies.map((s) => ({ text: `Strategy: ${s.text}` })),
          });
        if (actions.length)
          blocks.push({
            kind: "table",
            field: "actions",
            columns: [
              { key: "action", label: "Action", field: "actions" },
              { key: "owner", label: "Owner", field: "actions" },
              { key: "due", label: "Due", field: "actions" },
              { key: "status", label: "Status", field: "actions" },
            ],
            rows: actions.map((a) => ({
              action: { text: a.text },
              owner: { text: a.owner ?? "—" },
              due: { text: a.dueDate ? day(a.dueDate) : "—" },
              status: { text: a.status },
            })),
          });
      }
      if (account.ownerNotes)
        blocks.push({
          kind: "callout",
          text: `Internal notes: ${account.ownerNotes}`,
          field: "internalNotes",
        });
      return blocks;
    }),
};
