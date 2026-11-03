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

export const builders: SectionBuilders = {
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
