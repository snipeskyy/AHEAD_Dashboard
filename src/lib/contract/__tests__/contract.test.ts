import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  contactRows,
  internalFieldsPresent,
  makeResolver,
  opportunityRows,
  partnerRepRows,
  redactContract,
} from "../convert";
import { CONTRACT_EXAMPLE } from "../example";
import { openApiDocument } from "../openapi";
import { ContractSchema, contractJsonSchema } from "../schema";

const committed = (f: string) => JSON.parse(readFileSync(`docs/contract/${f}`, "utf8"));

describe("data contract v1", () => {
  it("committed JSON Schema, example and OpenAPI match the code (run npm run contract:schema)", () => {
    expect(committed("acc-data-v1.schema.json")).toEqual(contractJsonSchema());
    expect(committed("example.acc-data.json")).toEqual(CONTRACT_EXAMPLE);
    expect(committed("openapi.json")).toEqual(openApiDocument());
  });

  it("the example validates and has no personal contact fields anywhere in the schema", () => {
    expect(ContractSchema.safeParse(CONTRACT_EXAMPLE).success).toBe(true);
    const keys: string[] = [];
    const walk = (n: unknown) => {
      if (!n || typeof n !== "object") return;
      const o = n as Record<string, unknown>;
      if (o.properties && typeof o.properties === "object") keys.push(...Object.keys(o.properties));
      Object.values(o).forEach(walk);
    };
    walk(contractJsonSchema());
    expect(keys.length).toBeGreaterThan(40);
    for (const k of keys)
      expect(k.toLowerCase()).not.toMatch(/email|phone|address|price|margin|cost/);
  });

  it("rejects unknown versions and account refs without any key", () => {
    expect(ContractSchema.safeParse({ ...CONTRACT_EXAMPLE, version: "2.0" }).success).toBe(false);
    const bad = structuredClone(CONTRACT_EXAMPLE);
    bad.entities.contacts[0].account = {};
    expect(ContractSchema.safeParse(bad).success).toBe(false);
  });

  it("resolves refs by in-file externalId, then known ids, then domain/name", () => {
    const c = ContractSchema.parse(CONTRACT_EXAMPLE);
    const r = makeResolver(c, new Map([["A-OLD", "old.example"]]));
    expect(r({ externalId: "A-1001" })).toBe("holdings.example");
    expect(r({ externalId: "A-OLD" })).toBe("old.example");
    expect(r({ name: "Other Co" })).toBe("Other Co");
    expect(r({ externalId: "missing" })).toBeNull();
    expect(contactRows(c, r)[0].account).toBe("holdings.example");
    expect(contactRows(c, r)[1].account).toBe("holdings.example");
    const opp = opportunityRows(c, r)[0];
    expect(opp).toMatchObject({ amount: "450000", closeDate: "2027-03-31", stage: "Discover" });
    expect(partnerRepRows(c, r)[0].accounts).toBe("holdings.example");
  });

  it("customer-safe redaction drops internal fields and notes; roles hide amounts and probability", () => {
    const c = ContractSchema.parse({
      ...CONTRACT_EXAMPLE,
      entities: {
        ...CONTRACT_EXAMPLE.entities,
        accounts: [{ ...CONTRACT_EXAMPLE.entities.accounts[0], ownerNotes: "x" }],
      },
    });
    expect(internalFieldsPresent(c)).toEqual(
      expect.arrayContaining(["accounts.ownerNotes", "opportunities.amount", "notes"]),
    );
    const safe = redactContract(c, { visibility: "customer-safe", hidden: new Set() });
    expect(safe.visibility).toBe("customer-safe");
    expect(internalFieldsPresent(safe)).toEqual([]);
    expect(ContractSchema.safeParse(safe).success).toBe(true);
    const role = redactContract(c, {
      visibility: "internal",
      hidden: new Set(["opp.amount", "opp.forecast"]),
    });
    expect(role.entities.opportunities[0]).not.toHaveProperty("amount");
    expect(role.entities.notes).toHaveLength(1);
    expect(
      redactContract(c, { visibility: "internal", hidden: new Set(["notes"]) }).entities.notes,
    ).toEqual([]);
  });
});
