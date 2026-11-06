import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it, vi } from "vitest";
import type { Pack } from "@/lib/team/pack-schema";

/**
 * Phase 8 "done when": packs round-trip between two local databases. Each workspace is a fresh
 * SQLite file; the app's db singleton is re-created between them.
 */
const dirs: string[] = [];
async function workspace() {
  const dir = mkdtempSync(path.join(tmpdir(), "acc-pack-"));
  dirs.push(dir);
  const url = `file:${path.join(dir, "acc.db")}`;
  execFileSync("npx", ["prisma", "migrate", "deploy"], { env: { ...process.env, DATABASE_URL: url, CHECKPOINT_DISABLE: "1" }, stdio: "ignore" });
  const g = globalThis as { __accPrisma?: PrismaClient };
  await g.__accPrisma?.$disconnect();
  delete g.__accPrisma;
  vi.resetModules();
  process.env.DATABASE_URL = url;
  return {
    db: (await import("@/lib/db")).db,
    auth: await import("@/lib/auth/server"),
    accounts: await import("@/lib/server/account-import"),
    comments: await import("@/lib/server/comments"),
    store: await import("@/lib/enrich/store"),
    exp: await import("../export"),
    imp: await import("../import"),
    undo: await import("../../import/undo"),
  };
}

afterAll(async () => {
  await (globalThis as { __accPrisma?: PrismaClient }).__accPrisma?.$disconnect();
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

let pack: Pack;

describe("shareable packs (two workspaces)", () => {
  it("workspace A: stamps ownership, audits, and exports a role-gated pack", async () => {
    const A = await workspace();
    await A.auth.ensureLocalUser();
    await A.db.user.update({ where: { id: "local" }, data: { displayName: "Alex", role: "client-director" } });
    await A.db.user.create({ data: { displayName: "Sam" } });
    const { created } = await A.accounts.createRealAccounts([{ name: "Example Holdings Inc.", domain: "example.com", tier: "Strategic" }]);
    const id = created[0].id;
    await A.store.setManualValue(A.db, id, "firmographics.hq", "Springfield");
    await A.db.initiative.create({ data: { accountId: id, title: "Data center consolidation", practiceAreas: ["modern-dc"], source: "filing", sourceUrl: "https://www.sec.gov/example", confidence: 0.8 } });
    await A.db.initiative.create({ data: { accountId: id, title: "AI pilot (my read)", practiceAreas: ["ai-infra"], source: "user-hypothesis", confidence: 0.4 } });
    await A.db.contact.create({ data: { accountId: id, title: "CIO", function: "IT", seniority: "C-Level", buyingRole: "EconomicBuyer", displayName: "Pat Example" } });
    await A.db.note.create({ data: { entityType: "account", entityId: id, body: "Prefers email" } });
    await A.comments.createComment({ entityType: "account", entityId: id, body: "@Sam can you take the CIO intro?" });

    const acc = await A.db.account.findUniqueOrThrow({ where: { id } });
    expect(acc).toMatchObject({ ownerId: "local", createdBy: "local", teamId: "local-team" });
    expect(await A.db.auditLog.count({ where: { action: "enrichment.manual" } })).toBe(1);

    pack = await A.exp.buildPack({ accountIds: [id], sections: ["profile", "evidence", "contacts", "notes", "comments", "tier"] });
    expect(pack.createdBy).toEqual({ name: "Alex", role: "Client Director" });
    const p = pack.accounts[0];
    expect(p.tier).toBe("Strategic");
    expect(p.contacts![0].displayName).toBeNull(); // names are opt-in
    expect(p.comments![0]).toMatchObject({ authorName: "Alex", mentionNames: ["Sam"] });
    expect(await A.db.auditLog.count({ where: { action: "pack.export" } })).toBe(1);

    await A.db.user.update({ where: { id: "local" }, data: { role: "inside-sales" } });
    const gated = await A.exp.buildPack({ accountIds: [id], sections: ["notes", "opportunities", "amounts"] });
    expect(gated.sections).toEqual(["opportunities"]);
    expect(gated.accounts[0].notes).toBeUndefined();
    pack = JSON.parse(JSON.stringify(pack)); // what actually travels: a file
  }, 120_000);

  it("workspace B: imports as new, notifies the mentioned user, re-import merges without duplicates, undo removes it", async () => {
    const B = await workspace();
    await B.auth.ensureLocalUser();
    await B.db.user.update({ where: { id: "local" }, data: { displayName: "Sam" } });
    const parsed = B.imp.parsePack(pack);
    const plan = await B.imp.planPack(parsed);
    expect(plan[0]).toMatchObject({ decision: "create", match: null });

    const r1 = await B.imp.commitPack(parsed, {});
    expect(r1.counts).toMatchObject({ created: 1, merged: 0 });
    const a = await B.db.account.findFirstOrThrow({ where: { domain: "example.com" } });
    expect(a).toMatchObject({ tier: "Strategic", isDemo: false });
    const inits = await B.db.initiative.findMany({ where: { accountId: a.id }, orderBy: { title: "asc" } });
    expect(inits.map((i) => i.source)).toEqual(["user-hypothesis", "filing"]);
    const props = await B.db.fieldProposal.findMany({ where: { accountId: a.id } });
    expect(props.find((x) => x.field === "firmographics.hq")).toMatchObject({ status: "pending", enricherId: "pack" });
    expect(await B.db.accountField.count({ where: { accountId: a.id } })).toBe(0); // nothing applied without review
    expect(await B.db.note.count()).toBe(1);
    expect(await B.db.notification.count({ where: { kind: "mention" } })).toBe(1);
    expect(await B.db.comment.findFirstOrThrow()).toMatchObject({ authorName: "Alex", mentions: ["local"] });

    const plan2 = await B.imp.planPack(parsed);
    expect(plan2[0]).toMatchObject({ decision: "merge", match: { id: a.id, by: "domain" } });
    const r2 = await B.imp.commitPack(parsed, {});
    expect(r2.counts).toMatchObject({ created: 0, merged: 1 });
    expect(await B.db.initiative.count()).toBe(2);
    expect(await B.db.contact.count()).toBe(1);
    expect(await B.db.comment.count()).toBe(1);
    expect(await B.db.note.count()).toBe(1);
    expect(await B.db.notification.count({ where: { kind: "mention" } })).toBe(1);

    await B.undo.undoImport(r1.batchId);
    expect(await B.db.account.count()).toBe(0);
    expect(await B.db.comment.count()).toBe(0);
    expect(await B.db.auditLog.count({ where: { action: { in: ["pack.import", "import.undo"] } } })).toBe(3);
  }, 120_000);
});
