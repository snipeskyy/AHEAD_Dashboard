import "server-only";
import { hiddenFor } from "@/config/roles";
import { currentUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/db-extensions";
import { redactContract } from "@/lib/contract/convert";
import {
  CONTRACT_FORMAT,
  CONTRACT_VERSION,
  ContractSchema,
  type Contract,
} from "@/lib/contract/schema";
import { HttpError } from "../http";
import { externalIdsFor } from "./refs";

const opt = <T>(v: T | null | undefined) =>
  v === null || v === undefined || v === "" ? undefined : v;
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : undefined);

export interface ContractExportOptions {
  visibility: Contract["visibility"];
  accountIds?: string[];
  /** The local read API exports without an audit row per call. */
  quiet?: boolean;
}

/**
 * The workspace (or chosen accounts) in contract format. Demo accounts are never exported. The acting user's
 * role hides the same fields as on screen; customer-safe drops internal fields and all notes.
 */
export async function exportContract(opts: ContractExportOptions): Promise<Contract> {
  const where = {
    isDemo: false,
    ...(opts.accountIds?.length ? { id: { in: opts.accountIds } } : {}),
  };
  const accounts = await db.account.findMany({ where, orderBy: { name: "asc" } });
  const ids = accounts.map((a) => a.id);
  const inAcc = { accountId: { in: ids } };
  const [contacts, opps, touches, notes, tasks, reps] = await Promise.all([
    db.contact.findMany({ where: inAcc }),
    db.opportunity.findMany({ where: { ...inAcc, isDemo: false } }),
    db.touch.findMany({ where: { ...inAcc, isDemo: false }, orderBy: { scheduledAt: "asc" } }),
    db.note.findMany({
      where: { entityType: "account", entityId: { in: ids } },
      orderBy: { createdAt: "asc" },
    }),
    db.task.findMany({
      where: opts.accountIds?.length ? inAcc : {},
      orderBy: { createdAt: "asc" },
    }),
    db.partnerRep.findMany({
      where: opts.accountIds?.length ? { accounts: { some: inAcc } } : {},
      include: { accounts: { select: { accountId: true } } },
    }),
  ]);
  const [aRefs, cRefs, oRefs, tRefs, kRefs, pRefs, nRefs] = await Promise.all([
    externalIdsFor("account", ids),
    externalIdsFor(
      "contact",
      contacts.map((x) => x.id),
    ),
    externalIdsFor(
      "opportunity",
      opps.map((x) => x.id),
    ),
    externalIdsFor(
      "touch",
      touches.map((x) => x.id),
    ),
    externalIdsFor(
      "task",
      tasks.map((x) => x.id),
    ),
    externalIdsFor(
      "partner-rep",
      reps.map((x) => x.id),
    ),
    externalIdsFor(
      "note",
      notes.map((x) => x.id),
    ),
  ]);
  const known = new Set(ids);
  const ref = (id: string) => ({ externalId: id });
  const keys = (id: string, refs: Map<string, Record<string, string>>) => ({
    externalId: id,
    accId: id,
    ...(refs.get(id) ? { externalRefs: refs.get(id) } : {}),
  });

  const raw = {
    format: CONTRACT_FORMAT,
    version: CONTRACT_VERSION,
    exportedAt: new Date().toISOString(),
    source: { system: "acc", note: "Exported from Account Command Center" },
    visibility: "internal" as const,
    entities: {
      accounts: accounts.map((a) => ({
        ...keys(a.id, aRefs),
        name: a.name,
        domain: opt(a.domain),
        ticker: opt(a.ticker),
        industry: opt(a.industry),
        subIndustry: opt(a.subIndustry),
        hq: opt(a.hq),
        tier: opt(a.tier),
        employeeBand: opt(a.employeeBand),
        revenueBand: opt(a.revenueBand),
        ownerNotes: opt(a.ownerNotes),
      })),
      contacts: contacts.map((c) => ({
        ...keys(c.id, cRefs),
        account: ref(c.accountId),
        displayName: opt(c.displayName),
        title: c.title,
        function: opt(c.function),
        seniority: opt(c.seniority),
        buyingRole: opt(c.buyingRole),
        engagement: opt(c.engagement),
      })),
      opportunities: opps.map((o) => ({
        ...keys(o.id, oRefs),
        account: ref(o.accountId),
        name: o.name,
        practiceArea: o.practiceArea,
        stage: o.stage,
        amount: o.amount,
        closeDate: day(o.closeDate)!,
        probability: o.probability,
        nextStep: opt(o.nextStep),
        nextStepDate: day(o.nextStepDate),
      })),
      activities: touches.map((t) => ({
        ...keys(t.id, tRefs),
        account: ref(t.accountId),
        channel: t.channel,
        persona: t.persona,
        date: day(t.completedAt ?? t.scheduledAt)!,
        completed: !!t.completedAt,
        outcome: opt(t.outcome),
        summary: opt(t.angle),
      })),
      notes: notes.map((n) => ({
        ...keys(n.id, nRefs),
        account: ref(n.entityId),
        body: n.body,
        date: day(n.createdAt),
      })),
      tasks: tasks
        .filter((t) => !t.accountId || known.has(t.accountId))
        .map((t) => ({
          ...keys(t.id, kRefs),
          ...(t.accountId ? { account: ref(t.accountId) } : {}),
          title: t.title,
          dueDate: day(t.dueDate),
          priority: t.priority === "urgent" ? "high" : t.priority,
          status: t.status,
        })),
      partnerReps: reps.map((p) => ({
        ...keys(p.id, pRefs),
        partnerCompany: p.partnerCompany,
        name: p.name,
        title: opt(p.title),
        territory: opt(p.territory),
        accounts: p.accounts.filter((x) => known.has(x.accountId)).map((x) => ref(x.accountId)),
      })),
    },
  };
  const parsed = ContractSchema.safeParse(raw);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    throw new HttpError(
      500,
      `Export did not match the contract at ${i.path.join(".")}: ${i.message}`,
    );
  }
  const user = await currentUser();
  const out = redactContract(parsed.data, {
    visibility: opts.visibility,
    hidden: hiddenFor(user.role),
  });
  if (!opts.quiet)
    await audit(db, {
      action: "contract.export",
      entityType: "export",
      entityId: "contract",
      summary: `Exported ${accounts.length} account${accounts.length === 1 ? "" : "s"} in the data contract format (${opts.visibility})`,
      meta: { visibility: opts.visibility, accounts: accounts.length },
    });
  return out;
}
