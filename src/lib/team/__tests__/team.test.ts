import { describe, expect, it } from "vitest";
import { canSee, exportHiddenFor, ROLES } from "@/config/roles";
import { activeMentionQuery, findMentions, insertMention } from "../mentions";
import { DEFAULT_PACK_SECTIONS, effectiveSections, PackSchema, packFileName, proposalConfidence } from "../pack-schema";

const users = [{ id: "u1", displayName: "Sam" }, { id: "u2", displayName: "Sam Lee" }, { id: "u3", displayName: "Riley" }];

describe("mentions", () => {
  it("finds mentions, preferring the longest name and ignoring emails", () => {
    expect(findMentions("ping @Sam Lee about it", users)).toEqual(["u2"]);
    expect(findMentions("@sam and @Riley", users).sort()).toEqual(["u1", "u3"]);
    expect(findMentions("mail sam@example.com", users)).toEqual([]);
    expect(findMentions("@Samuel", users)).toEqual([]);
  });
  it("tracks the @query being typed and inserts the chosen name", () => {
    expect(activeMentionQuery("hi @Ri", 6)).toEqual({ start: 3, query: "Ri" });
    expect(activeMentionQuery("a@b", 3)).toBeNull();
    expect(insertMention("hi @Ri tail", 3, 6, "Riley")).toEqual({ text: "hi @Riley  tail", caret: 10 });
  });
});

describe("roles", () => {
  it("defines the four roles; Inside Sales can't see amounts and their export fields are hidden", () => {
    expect(ROLES.map((r) => r.id)).toEqual(["client-director", "associate-client-director", "solutions-architect", "inside-sales"]);
    expect(canSee("inside-sales", "opp.amount")).toBe(false);
    expect(canSee("client-director", "opp.amount")).toBe(true);
    expect(exportHiddenFor("inside-sales")).toContain("opportunities.pipeline.amount");
    expect(exportHiddenFor("associate-client-director")).toEqual([]);
    expect(canSee("unknown-role", "notes")).toBe(true); // falls back to the default role
  });
});

describe("pack schema", () => {
  it("gates sections by role and dependencies", () => {
    expect(DEFAULT_PACK_SECTIONS).toEqual(["profile", "evidence", "contacts"]);
    expect(effectiveSections(["opportunities", "amounts", "notes"], "inside-sales")).toEqual(["opportunities"]);
    expect(effectiveSections(["amounts", "contactNames"], "client-director")).toEqual([]);
    expect(effectiveSections(["contacts", "contactNames", "bogus"], "client-director")).toEqual(["contacts", "contactNames"]);
  });
  it("validates packs and rejects other formats", () => {
    const ok = { format: "acc-pack", version: 1, title: "T", createdAt: "2026-11-06T00:00:00Z", createdBy: { name: "A", role: "B" }, sections: [], accounts: [{ ref: "a", identity: { name: "Example Co" } }] };
    expect(PackSchema.safeParse(ok).success).toBe(true);
    expect(PackSchema.safeParse({ ...ok, format: "other" }).success).toBe(false);
    expect(PackSchema.safeParse({ ...ok, accounts: [] }).success).toBe(false);
  });
  it("maps confidence and names files", () => {
    expect(proposalConfidence("user")).toBe("medium");
    expect(proposalConfidence("verified")).toBe("high");
    expect(packFileName("Healthcare: Q4!", new Date("2026-11-06T10:00:00Z"))).toBe("acc-pack-healthcare-q4-2026-11-06.json");
  });
});
