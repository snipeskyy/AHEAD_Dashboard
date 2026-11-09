import { formatCurrencyCompact as money } from "@/lib/format";

/**
 * Weekly team digest (Phase 14). Pure: the server gathers the week's facts, this turns them into sections and
 * Markdown. Every line is a count, a record name or a date from the workspace; nothing is summarized by a model.
 */
export interface DigestInput {
  teamName: string;
  weekStart: Date;
  now: Date;
  /** When the acting role hides deal amounts, amounts are left out. */
  showAmounts: boolean;
  stageMoves: Array<{
    opp: string;
    account: string;
    from: string | null;
    to: string;
    amount: number;
    at: Date;
  }>;
  created: Array<{ opp: string; account: string; amount: number }>;
  closingSoon: Array<{ opp: string; account: string; amount: number; closeDate: Date }>;
  tasksDone: Array<{ title: string; assignee: string }>;
  tasksOverdue: Array<{ title: string; assignee: string; dueDate: Date; account: string | null }>;
  planSteps: Array<{ plan: string; step: string; dueDate: string; overdue: boolean }>;
  topSignals: Array<{ title: string; account: string; relevance: number }>;
}

export interface DigestSection {
  id: string;
  title: string;
  empty: string;
  items: string[];
}

const fmtDay = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const label = (s: string) => s.replace(/^Closed/, "Closed ").replace(/([a-z])([A-Z])/g, "$1 $2");

export function buildDigest(i: DigestInput): {
  title: string;
  summary: string;
  sections: DigestSection[];
  markdown: string;
} {
  const amt = (n: number) => (i.showAmounts ? ` (${money(n)})` : "");
  const won = i.stageMoves.filter((m) => m.to === "ClosedWon");
  const lost = i.stageMoves.filter((m) => m.to === "ClosedLost");
  const advanced = i.stageMoves.filter(
    (m) => m.to !== "ClosedWon" && m.to !== "ClosedLost" && m.from,
  );
  const byPerson = new Map<string, number>();
  for (const t of i.tasksOverdue) byPerson.set(t.assignee, (byPerson.get(t.assignee) ?? 0) + 1);

  const sections: DigestSection[] = [
    {
      id: "wins",
      title: "Won and lost",
      empty: "No deals closed this week.",
      items: [
        ...won.map((m) => `Won: ${m.opp} · ${m.account}${amt(m.amount)}`),
        ...lost.map((m) => `Lost: ${m.opp} · ${m.account}${amt(m.amount)}`),
      ],
    },
    {
      id: "moves",
      title: "Deals that moved",
      empty: "No stage changes this week.",
      items: advanced
        .slice(0, 15)
        .map((m) => `${m.opp} · ${m.account}: ${label(m.from!)} → ${label(m.to)}`),
    },
    {
      id: "new",
      title: "New pipeline",
      empty: "No new opportunities this week.",
      items: i.created.slice(0, 15).map((c) => `${c.opp} · ${c.account}${amt(c.amount)}`),
    },
    {
      id: "closing",
      title: "Closing in the next 14 days",
      empty: "Nothing scheduled to close in the next two weeks.",
      items: i.closingSoon
        .slice(0, 15)
        .map((c) => `${fmtDay(c.closeDate)}: ${c.opp} · ${c.account}${amt(c.amount)}`),
    },
    {
      id: "plans",
      title: "Mutual action plan steps due",
      empty: "No plan steps due in the next 14 days.",
      items: i.planSteps
        .slice(0, 15)
        .map(
          (s) =>
            `${s.overdue ? "Overdue " : ""}${fmtDay(new Date(`${s.dueDate}T12:00:00Z`))}: ${s.step} (${s.plan})`,
        ),
    },
    {
      id: "tasks",
      title: "Team tasks",
      empty: "No tasks completed or overdue.",
      items: [
        ...(i.tasksDone.length
          ? [`${i.tasksDone.length} task${i.tasksDone.length === 1 ? "" : "s"} completed this week`]
          : []),
        ...[...byPerson.entries()].map(([who, n]) => `${who}: ${n} overdue`),
        ...i.tasksOverdue
          .slice(0, 10)
          .map(
            (t) =>
              `Overdue since ${fmtDay(t.dueDate)}: ${t.title}${t.account ? ` · ${t.account}` : ""} (${t.assignee})`,
          ),
      ],
    },
    {
      id: "signals",
      title: "Top signals",
      empty: "No new signals this week.",
      items: i.topSignals
        .slice(0, 5)
        .map((s) => `${s.account}: ${s.title} (relevance ${Math.round(s.relevance)})`),
    },
  ];

  const title = `${i.teamName} weekly digest: ${fmtDay(i.weekStart)} to ${fmtDay(i.now)}`;
  const summary = [
    `${won.length} won`,
    `${lost.length} lost`,
    `${advanced.length} moved`,
    `${i.created.length} new`,
    `${i.tasksOverdue.length} overdue task${i.tasksOverdue.length === 1 ? "" : "s"}`,
  ].join(" · ");
  const md = [
    `# ${title}`,
    "",
    summary,
    "",
    ...sections.flatMap((s) => [
      `## ${s.title}`,
      "",
      ...(s.items.length ? s.items.map((x) => `- ${x}`) : [`_${s.empty}_`]),
      "",
    ]),
    "_Internal. Generated from the workspace; every line comes from a record._",
    "",
  ].join("\n");
  return { title, summary, sections, markdown: md };
}
