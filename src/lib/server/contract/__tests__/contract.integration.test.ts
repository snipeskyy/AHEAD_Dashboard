import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CONTRACT_EXAMPLE } from "@/lib/contract/example";
import { ContractSchema } from "@/lib/contract/schema";

// The pipeline uses the app's db singleton, so point it at a throwaway DB before importing.
let dir: string;
let db: PrismaClient;
let imp: typeof import("../import");
let exp: typeof import("../export");
let refs: typeof import("../refs");
let undo: typeof import("../../import/undo");
let api: typeof import("../../local-api");
let staging: typeof import("../staging");

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "acc-contract-"));
  const url = `file:${path.join(dir, "test.db")}`;
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url, CHECKPOINT_DISABLE: "1" },
    stdio: "ignore",
  });
  process.env.DATABASE_URL = url;
  db = (await import("@/lib/db")).db;
  imp = await import("../import");
  exp = await import("../export");
  refs = await import("../refs");
  undo = await import("../../import/undo");
  api = await import("../../local-api");
  staging = await import("../staging");
}, 120_000);

afterAll(async () => {
  await db?.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

const example = () => ContractSchema.parse(structuredClone(CONTRACT_EXAMPLE));

describe("data contract import / export (integration)", () => {
  let groupId = "";

  it("previews the example: everything new, refs to in-file accounts are fine", async () => {
    const p = await imp.previewContract(example());
    const by = Object.fromEntries(p.entities.map((e) => [e.key, e]));
    expect(by.accounts).toMatchObject({ total: 1, create: 1, errors: [] });
    expect(by.contacts).toMatchObject({ total: 2, create: 2, errors: [] });
    expect(by.opportunities.create).toBe(1);
    expect(by.activities.create).toBe(1);
    expect(by.tasks.create).toBe(1);
    expect(by.partnerReps.create).toBe(1);
  });

  it("imports every entity type with external ids, then re-import changes nothing", async () => {
    const r = await imp.commitContract(example(), "example.acc-data.json");
    groupId = r.groupId;
    expect(await db.account.count()).toBe(1);
    expect(await db.contact.count()).toBe(2);
    const opp = await db.opportunity.findFirstOrThrow();
    expect(opp.amount).toBe(450000);
    expect(opp.nextStepDate?.toISOString().slice(0, 10)).toBe("2026-11-20");
    expect(await db.touch.count()).toBe(1);
    expect(await db.task.count()).toBe(1);
    expect(await db.note.count()).toBe(1);
    expect(await db.partnerRepAccount.count()).toBe(1);
    expect(await db.externalRef.count({ where: { system: "example-system" } })).toBe(8);
    expect(await db.importBatch.count({ where: { groupId } })).toBeGreaterThanOrEqual(5);

    const again = await imp.previewContract(example());
    for (const e of again.entities) expect(e.create, e.key).toBe(0);
  });

  it("merges a changed file by external id and keeps amounts when a file omits them", async () => {
    const c = example();
    c.entities.opportunities[0] = {
      ...c.entities.opportunities[0],
      stage: "Solution",
      amount: undefined,
    };
    c.entities.tasks[0] = { ...c.entities.tasks[0], status: "done" };
    const p = await imp.previewContract(c);
    expect(p.entities.find((e) => e.key === "opportunities")?.merge).toBe(1);
    expect(p.entities.find((e) => e.key === "tasks")?.merge).toBe(1);
    await imp.commitContract(c, "changed.json");
    const opp = await db.opportunity.findFirstOrThrow();
    expect(opp.stage).toBe("Solution");
    expect(opp.amount).toBe(450000);
    expect((await db.task.findFirstOrThrow()).status).toBe("done");
  });

  it("exports internal and customer-safe files that validate, with the sender's ids", async () => {
    const internal = await exp.exportContract({ visibility: "internal" });
    expect(ContractSchema.safeParse(internal).success).toBe(true);
    expect(internal.entities.accounts[0].externalRefs).toEqual({ "example-system": "A-1001" });
    expect(internal.entities.notes).toHaveLength(1);
    const safe = await exp.exportContract({ visibility: "customer-safe" });
    expect(safe.entities.notes).toEqual([]);
    expect(safe.entities.opportunities[0]).not.toHaveProperty("amount");
    expect(() => refs.parseContract({ ...internal, visibility: "customer-safe" })).toThrow(
      /internal fields/,
    );
    // Round trip: re-importing ACC's own export creates nothing.
    const p = await imp.previewContract(refs.parseContract(internal));
    expect(p.entities.reduce((s, e) => s + e.create, 0)).toBe(0);
  });

  it("undoing any batch of the first import undoes its whole group and its external ids", async () => {
    const later = await db.importBatch.findMany({
      where: { NOT: { groupId } },
      select: { id: true },
    });
    for (const b of later) await undo.undoImport(b.id).catch(() => undefined);
    const one = await db.importBatch.findFirstOrThrow({ where: { groupId, status: "applied" } });
    await undo.undoImport(one.id);
    expect(await db.importBatch.count({ where: { groupId, status: "applied" } })).toBe(0);
    expect(await db.account.count()).toBe(0);
    expect(await db.task.count()).toBe(0);
    expect(await db.partnerRep.count()).toBe(0);
    expect(await db.externalRef.count()).toBe(0);
  });

  it("local API: off → 403, on without a token → 401, valid token passes", async () => {
    const req = (auth?: string) =>
      new Request("http://localhost/api/v1/accounts", {
        headers: auth ? { authorization: auth } : {},
      });
    await expect(api.requireApiToken(req())).rejects.toMatchObject({ status: 403 });
    await api.setLocalApiEnabled(true);
    await expect(api.requireApiToken(req())).rejects.toMatchObject({ status: 401 });
    const { token } = await api.generateToken();
    await expect(api.requireApiToken(req("Bearer nope"))).rejects.toMatchObject({ status: 401 });
    await expect(api.requireApiToken(req(`Bearer ${token}`))).resolves.toBeUndefined();
    await api.revokeToken();
    await expect(api.requireApiToken(req(`Bearer ${token}`))).rejects.toMatchObject({
      status: 401,
    });
    expect(() =>
      api.assertSameOrigin(
        new Request("http://localhost:3000/x", {
          headers: { origin: "https://evil.example", host: "localhost:3000" },
        }),
      ),
    ).toThrow();
  });
});

describe("review queue and remove-by-source (Phase 15)", () => {
  const glean = () => {
    const c = example();
    return { ...c, source: { system: "glean" } };
  };

  it("staging writes nothing; review shows field-level changes; discard clears the payload", async () => {
    const before = await db.account.count();
    const s = await staging.stageContract(glean(), "paste", "Pasted from Glean");
    expect(await db.account.count()).toBe(before);
    const r = await staging.reviewStaged(s.id);
    const accounts = r.preview.entities.find((e) => e.key === "accounts")!;
    expect(accounts.changes[0]).toMatchObject({ label: "Example Holdings Inc.", action: "create" });
    await staging.discardStaged(s.id);
    const row = await db.stagedImport.findUniqueOrThrow({ where: { id: s.id } });
    expect(row.status).toBe("discarded");
    expect(row.payload).toEqual({});
    await expect(staging.applyStaged(s.id)).rejects.toMatchObject({ status: 409 });
  });

  it("apply imports with provenance links; remove-by-source undoes it all (backup first)", async () => {
    const s = await staging.stageContract(glean(), "api", "glean-action.json");
    await staging.applyStaged(s.id);
    expect(await db.account.count({ where: { name: "Example Holdings Inc." } })).toBe(1);
    const opp = await db.opportunity.findFirstOrThrow({ where: { name: "Data center refresh" } });
    const prov = await refs.provenanceFor("opportunity", opp.id);
    expect(prov[0]).toMatchObject({
      system: "glean",
      sourceUrl: "https://crm.example/opportunity/O-77",
    });
    expect(
      (await staging.sourcesOverview()).find((x) => x.system === "glean")?.imports,
    ).toBeGreaterThan(0);

    await expect(staging.removeSource("glean", "remove glean")).rejects.toMatchObject({
      status: 400,
    });
    const r = await staging.removeSource("glean", "REMOVE glean");
    expect(r.undone).toBe(1);
    expect(r.backup).toMatch(/^pre-remove-/);
    rmSync(path.join("backups", r.backup!), { force: true }); // test-only backup; backups/ is git-ignored
    expect(await db.account.count({ where: { name: "Example Holdings Inc." } })).toBe(0);
    expect(await db.externalRef.count({ where: { system: "glean" } })).toBe(0);
  });

  it("staging API needs the API on, staging allowed and a token; rejects oversized bodies", async () => {
    const send = (token: string, body: string) =>
      api.readStagingRequest(
        new Request("http://localhost/api/v1/staged-imports", {
          method: "POST",
          headers: { authorization: `Bearer ${token}` },
          body,
        }),
      );
    await api.setLocalApiEnabled(true);
    const { token } = await api.generateToken();
    await expect(send(token, "{}")).rejects.toMatchObject({ status: 403 });
    await api.setStagingAllowed(true);
    await expect(send(token, JSON.stringify(glean()))).resolves.toMatchObject({
      format: "acc-data",
    });
    await expect(send("acc_wrong", "{}")).rejects.toMatchObject({ status: 401 });
    await expect(send(token, "x".repeat(api.STAGING_MAX_BYTES + 1))).rejects.toMatchObject({
      status: 413,
    });
    await api.setStagingAllowed(false);
    await api.setLocalApiEnabled(false);
  });
});
