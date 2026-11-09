import "server-only";
import { practiceLabel } from "@/config/practice-areas";
import { day, money } from "@/lib/export/build-helpers";
import type { SectionBuilders } from "@/lib/export/builder-types";
import { OPEN_STAGES, STAGE_LABELS, type Stage } from "@/lib/domain/enums";
import { computeForecast, nextPeriods } from "@/lib/pipeline/analytics";
import { listOpportunities } from "@/lib/server/opportunities";
import { plansForAccount } from "@/lib/server/action-plans";
import { SIDE_LABELS, STATUS_LABELS, isOverdue, mapProgress, sortSteps, type MapStep } from "@/lib/map/model";
import { DEAL_RISK_LABELS } from "@/lib/scoring/deal-risk";
import { getModuleSettings } from "@/lib/settings/server";

export const builders: SectionBuilders = {
  "opportunities.pipeline": async (ctx) => {
    const opps = (
      await listOpportunities({
        accountId: { in: ctx.accounts.map((a) => a.id) },
        stage: { in: [...OPEN_STAGES] },
      })
    ).sort((a, b) => b.amount - a.amount);
    if (!opps.length) return [{ kind: "paragraph", text: "No open opportunities.", field: "name" }];
    const byStage = OPEN_STAGES.map((s) =>
      opps.filter((o) => o.stage === s).reduce((t, o) => t + o.amount, 0),
    );
    const multi = ctx.accounts.length > 1;
    const list = opps.slice(0, 25);
    return [
      {
        kind: "chart",
        field: "amount",
        title: "Open pipeline by stage",
        spec: {
          type: "hbar",
          categories: OPEN_STAGES.map((s) => STAGE_LABELS[s]),
          series: [{ name: "Pipeline", values: byStage }],
          valueFormat: "currency",
        },
      },
      {
        kind: "table",
        field: "name",
        caption:
          opps.length > list.length
            ? `Top ${list.length} of ${opps.length} open opportunities by amount`
            : undefined,
        columns: [
          { key: "name", label: "Opportunity", field: "name" },
          ...(multi ? [{ key: "account", label: "Account", field: "name" }] : []),
          { key: "practice", label: "Practice", field: "practiceArea" },
          { key: "stage", label: "Stage", field: "stage" },
          { key: "amount", label: "Amount", align: "right" as const, field: "amount" },
          { key: "probability", label: "Prob.", align: "right" as const, field: "probability" },
          { key: "close", label: "Target date", field: "closeDate" },
          { key: "competitors", label: "Competitors", field: "competitors" },
          { key: "risk", label: "Risks", field: "riskFlags" },
        ],
        rows: list.map((o) => ({
          name: { text: o.name },
          account: { text: o.accountName },
          practice: { text: practiceLabel(o.practiceArea, true) },
          stage: { text: STAGE_LABELS[o.stage as Stage] },
          amount: { text: money(o.amount) },
          probability: { text: `${o.probability}%` },
          close: { text: day(o.closeDate) },
          competitors: { text: o.competitors.join(", ") || "—" },
          risk: { text: o.riskFlags.map((f) => DEAL_RISK_LABELS[f]).join("; ") || "—" },
        })),
      },
    ];
  },
  "opportunities.forecast": async (ctx) => {
    const opps = await ctx.db.opportunity.findMany({
      where: { accountId: { in: ctx.accounts.map((a) => a.id) } },
      select: {
        stage: true,
        amount: true,
        probability: true,
        forecastCategory: true,
        closeDate: true,
        createdAt: true,
        closedAt: true,
        stageChangedAt: true,
        practiceArea: true,
      },
    });
    const { quarterlyTarget } = await getModuleSettings<{ quarterlyTarget: number }>(
      "opportunities",
    );
    const periods = nextPeriods(ctx.now, "quarter", 4, -1);
    const f = computeForecast(opps, "quarter", periods);
    return [
      {
        kind: "chart",
        field: "forecast",
        title: "Forecast by quarter",
        spec: {
          type: "bar",
          categories: periods.map((p) => p.replace("-", " ")),
          series: [
            { name: "Closed won", values: f.map((b) => b.closedWon) },
            { name: "Commit", values: f.map((b) => b.commit) },
            { name: "Best case", values: f.map((b) => b.bestCase) },
          ],
          valueFormat: "currency",
          reference:
            ctx.scope === "portfolio" && quarterlyTarget > 0
              ? { label: `Target ${money(quarterlyTarget)}`, value: quarterlyTarget }
              : undefined,
        },
      },
      {
        kind: "table",
        field: "forecast",
        columns: [
          { key: "q", label: "Quarter", field: "forecast" },
          { key: "won", label: "Closed won", align: "right", field: "forecast" },
          { key: "commit", label: "Commit", align: "right", field: "forecast" },
          { key: "best", label: "Best case", align: "right", field: "forecast" },
          { key: "pipe", label: "Pipeline", align: "right", field: "forecast" },
        ],
        rows: f.map((b) => ({
          q: { text: b.key },
          won: { text: money(b.closedWon) },
          commit: { text: money(b.commit) },
          best: { text: money(b.bestCase) },
          pipe: { text: money(b.pipeline) },
        })),
      },
    ];
  },
  "opportunities.action-plan": async (ctx) => {
    const plans = (await Promise.all(ctx.accounts.map((a) => plansForAccount(a.id)))).flat();
    if (!plans.length)
      return [{ kind: "paragraph", text: "No mutual action plans yet. Start one from an opportunity.", field: "steps" }];
    const now = new Date();
    const table = (steps: MapStep[], field: string, caption?: string) => ({
      kind: "table" as const,
      field,
      caption,
      columns: [
        { key: "due", label: "Due", field },
        { key: "step", label: "Step", field },
        { key: "owner", label: "Owner", field },
        { key: "status", label: "Status", field },
        { key: "note", label: "Internal note", field: "notes" },
      ],
      rows: sortSteps(steps).map((s) => ({
        due: { text: s.dueDate ? day(`${s.dueDate}T12:00:00Z`) : "TBD" },
        step: { text: s.title },
        owner: { text: `${SIDE_LABELS[s.side]}${s.owner ? ` · ${s.owner}` : ""}` },
        status: { text: isOverdue(s, now) && s.status !== "at-risk" ? "Overdue" : STATUS_LABELS[s.status] },
        note: { text: s.note },
      })),
    });
    return plans.flatMap((p) => {
      const visible = p.steps.filter((s) => s.customerVisible);
      const hidden = p.steps.filter((s) => !s.customerVisible);
      return [
        { kind: "heading" as const, level: 3 as const, text: p.title, field: "steps" },
        ...(p.objective ? [{ kind: "paragraph" as const, text: p.objective, field: "steps" }] : []),
        {
          kind: "paragraph" as const,
          field: "progress",
          text: `Target decision date: ${p.targetDate ? day(`${p.targetDate}T12:00:00Z`) : "TBD"}. ${mapProgress(visible, p.targetDate, now).summary}`,
        },
        table(visible, "steps"),
        ...(hidden.length ? [table(hidden, "hiddenSteps", "Internal steps (not shown to the customer)")] : []),
      ];
    });
  },
};
