import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LeiRecord } from "../../gleif";
import { isAllowedByRobots } from "../../robots";
import { SubmissionsSchema, recentFilings } from "../../sec";
import type { Entity } from "../../wikidata";
import { normalizeDns } from "../dns/normalize";
import { normalizeLei } from "../gleif/normalize";
import { normalizeBoard } from "../hiring/boards";
import { fnFor, normalizeHiring } from "../hiring/normalize";
import { matchOrg, normalizePeering } from "../peeringdb/normalize";
import { mineFiling, splitSections } from "../sec-filings-text/normalize";
import {
  FactsSchema,
  latestFinancialProposals,
  normalizeFacts,
  normalizeSubmissions,
} from "../sec-edgar/normalize";
import { displayName, officerProposals, parseOwnershipXml } from "../sec-officers/normalize";
import { normalizeAwards } from "../usaspending/normalize";
import { detectJobBoard, normalizeHomepage } from "../website/normalize";
import { labelIds, normalizeEntity } from "../wikidata/normalize";

const fx = (f: string) => readFileSync(path.join(__dirname, "../__fixtures__", f), "utf8");
const byField = (ps: Array<{ field: string }>, f: string) =>
  ps.find((p) => p.field === f) as
    { field: string; value: unknown; confidence: string; sourceUrl: string } | undefined;

describe("website", () => {
  const r = normalizeHomepage({
    url: "https://www.halvorsen.example/",
    html: fx("homepage.html"),
    headers: { "cf-ray": "abc", server: "cloudflare" },
  });
  it("reads schema.org profile, links, feed and job board", () => {
    expect(byField(r.proposals, "firmographics.description")?.confidence).toBe("high");
    expect(byField(r.proposals, "identity.legalName")?.value).toBe(
      "Halvorsen Mutual Insurance Company",
    );
    expect(byField(r.proposals, "firmographics.hqAddress")?.value).toMatchObject({
      city: "Springfield",
      region: "IL",
    });
    expect(byField(r.proposals, "web.careersUrl")?.value).toBe(
      "https://www.halvorsen.example/careers/",
    );
    expect(byField(r.proposals, "web.newsroomRss")?.value).toBe(
      "https://www.halvorsen.example/newsroom/feed.xml",
    );
    expect(byField(r.proposals, "web.jobBoard")?.value).toEqual({
      provider: "greenhouse",
      slug: "halvorsenexample",
    });
    expect(byField(r.proposals, "web.social")?.value).toMatchObject({
      linkedin: expect.stringContaining("linkedin.com/company/"),
    });
  });
  it("labels web technology as hypotheses with evidence", () => {
    const tech = r.proposals
      .filter((p) => p.field.startsWith("tech:"))
      .map((p) => (p.value as { technology: string }).technology);
    expect(tech).toEqual(
      expect.arrayContaining([
        "Cloudflare",
        "WordPress",
        "Google Tag Manager",
        "OneTrust",
        "ServiceNow",
      ]),
    );
    expect(r.proposals.find((p) => p.field.startsWith("tech:"))!.evidenceSnippet).toMatch(
      /^Hypothesis/,
    );
  });
  it("detects job boards across providers", () => {
    expect(detectJobBoard('<a href="https://jobs.lever.co/example-co">')).toEqual({
      provider: "lever",
      slug: "example-co",
    });
    expect(detectJobBoard('<a href="https://jobs.ashbyhq.com/example">')).toEqual({
      provider: "ashby",
      slug: "example",
    });
    expect(detectJobBoard('<a href="https://jobs.smartrecruiters.com/ExampleCo/123">')).toEqual({
      provider: "smartrecruiters",
      slug: "exampleco",
    });
  });
});

describe("robots.txt", () => {
  const txt =
    "User-agent: *\nDisallow: /private\nAllow: /private/ok\n\nUser-agent: AccountCommandCenter\nDisallow: /no-acc\n";
  it("applies the most specific group and longest rule", () => {
    expect(isAllowedByRobots(txt, "/", "AccountCommandCenter/1.0")).toBe(true);
    expect(isAllowedByRobots(txt, "/no-acc/x", "AccountCommandCenter/1.0")).toBe(false);
    expect(isAllowedByRobots(txt, "/private/x", "OtherBot")).toBe(false);
    expect(isAllowedByRobots(txt, "/private/ok", "OtherBot")).toBe(true);
    expect(isAllowedByRobots("User-agent: *\nDisallow: /", "/")).toBe(false);
    expect(isAllowedByRobots("", "/anything")).toBe(true);
  });
});

describe("SEC EDGAR", () => {
  const s = SubmissionsSchema.parse(JSON.parse(fx("sec-submissions.json")));
  it("maps submissions to identity, industry, HQ and fiscal year end", () => {
    const p = normalizeSubmissions(s);
    expect(byField(p, "identity.ticker")?.value).toBe("CRHX");
    expect(byField(p, "financials.fiscalYearEnd")?.value).toBe("0630");
    expect(byField(p, "firmographics.industry")?.value).toBe("Services-Hospitals");
    expect(byField(p, "firmographics.hqAddress")?.value).toMatchObject({
      city: "Columbus",
      region: "OH",
    });
    expect(byField(p, "web.investorUrl")?.value).toBe("https://ir.crestline.example");
    expect(byField(p, "firmographics.website")).toBeUndefined(); // empty website is not proposed
  });
  it("keeps annual 10-K values only, latest filing per period", () => {
    const rows = normalizeFacts(FactsSchema.parse(JSON.parse(fx("sec-facts.json"))), "999001");
    const capex = rows.filter((r) => r.metric === "capex");
    expect(capex.map((r) => r.value)).toEqual([420_000_000, 310_000_000]);
    expect(rows.filter((r) => r.metric === "revenue")).toHaveLength(2); // 10-Q excluded
    expect(byField(latestFinancialProposals(rows), "firmographics.revenue")?.value).toBe(
      4_450_000_000,
    );
  });
  it("finds 10-K and Form 4 filings with archive URLs", () => {
    expect(recentFilings(s, ["10-K"])[0].url).toBe(
      "https://www.sec.gov/Archives/edgar/data/999001/000099900126000031/crhx-20260630.htm",
    );
    expect(recentFilings(s, ["4"])[0].primaryDocument).toBe("xslF345X05/form4.xml");
  });
});

describe("10-K text mining", () => {
  it("skips the table of contents and cites short snippets with sections", () => {
    const html = fx("tenk.html");
    const secs = splitSections(html.replace(/<[^>]+>/g, "\n"));
    expect(secs.map((s) => s.id)).toEqual(expect.arrayContaining(["1", "1A", "7"]));
    const p = mineFiling(html, {
      url: "https://www.sec.gov/x.htm",
      form: "10-K",
      filed: "2026-08-20",
    });
    const ids = p.map((x) => x.field);
    expect(ids).toEqual(
      expect.arrayContaining([
        "evidence.initiative:ai",
        "evidence.initiative:data-center",
        "evidence.initiative:consolidation",
        "evidence.initiative:cloud",
        "evidence.initiative:security",
        "evidence.initiative:cost",
        "evidence.initiative:mna",
      ]),
    );
    const ai = byField(p, "evidence.initiative:ai")!;
    expect(ai.value).toMatchObject({ practiceAreas: ["ai-infra"], kind: "filing" });
    expect((ai.value as { section: string }).section).toMatch(/Item 1 \(Business\)/);
    for (const x of p) expect((x.evidenceSnippet ?? "").length).toBeLessThanOrEqual(301);
  });
});

describe("SEC officers", () => {
  it("keeps officers with titles, reorders names, and suggests the CEO", () => {
    const o = parseOwnershipXml(fx("form4.xml"));
    expect(o).toEqual([
      { ownerCik: "0001900001", name: "Avery J. Quill", title: "Chief Executive Officer" },
    ]);
    expect(displayName("MARSH DANA")).toBe("Dana Marsh");
    const p = officerProposals(
      o.map((x) => ({ ...x, url: "https://www.sec.gov/a/", filed: "2026-08-10", form: "4" })),
    );
    expect(p.map((x) => x.field)).toEqual(["contact:0001900001", "firmographics.ceo"]);
  });
});

describe("GLEIF", () => {
  it("maps legal entity, HQ and hierarchy", () => {
    const rec = LeiRecord.parse(JSON.parse(fx("gleif-record.json")).data);
    const child = {
      ...rec,
      id: "C1",
      attributes: {
        ...rec.attributes,
        lei: "5299000CHILD00000001",
        entity: { ...rec.attributes.entity, legalName: { name: "Aurelian Freight LLC" } },
      },
    };
    const r = normalizeLei(rec, { parent: null, ultimate: null, children: [child] }, "exact-name");
    expect(byField(r.proposals, "identity.lei")?.confidence).toBe("medium");
    expect(byField(r.proposals, "firmographics.hqAddress")?.value).toMatchObject({
      city: "Memphis",
    });
    expect(r.relations).toEqual([
      expect.objectContaining({
        relation: "subsidiary",
        name: "Aurelian Freight LLC",
        source: "GLEIF",
      }),
    ]);
  });
});

describe("Wikidata", () => {
  const e = JSON.parse(fx("wikidata-entity.json")).entities.Q999001 as Entity;
  it("prefers preferred-rank, then latest point-in-time claims; ignores deprecated", () => {
    expect(labelIds(e)).toEqual(
      expect.arrayContaining(["Q999100", "Q999200", "Q999300", "Q999400"]),
    );
    expect(labelIds(e)).not.toContain("Q999301");
    const labels = new Map([
      ["Q999100", "Rowan Ellis"],
      ["Q999200", "freight transport"],
      ["Q999300", "Ostrander Rail"],
      ["Q999400", "Ostrander Group"],
    ]);
    const r = normalizeEntity(e, labels, {
      extract: "Ostrander Freight is a fictional American freight company founded in 1958.",
      url: "https://en.wikipedia.org/wiki/x",
    });
    expect(byField(r.proposals, "firmographics.employeeCount")?.value).toBe(12_500);
    expect(byField(r.proposals, "firmographics.revenue")).toMatchObject({
      value: 3_200_000_000,
      confidence: "low",
    });
    expect(byField(r.proposals, "firmographics.founded")?.value).toBe(1958);
    expect(byField(r.proposals, "firmographics.ceo")?.value).toBe("Rowan Ellis");
    expect(byField(r.proposals, "firmographics.industry")?.value).toBe("Freight transport");
    expect(r.relations.map((x) => x.relation)).toEqual(["direct-parent", "subsidiary"]);
  });
});

describe("DNS footprint", () => {
  it("maps MX, SPF and verification records to labeled hypotheses", () => {
    const p = normalizeDns(
      "example.com",
      [{ type: 15, data: "0 example-com.mail.protection.outlook.com." }],
      [
        {
          type: 16,
          data: "v=spf1 include:spf.protection.outlook.com include:_spf.salesforce.com include:mktomail.com -all",
        },
        { type: 16, data: "atlassian-domain-verification=abc" },
        { type: 16, data: "google-site-verification=zzz" },
      ],
    );
    const t = p.map((x) => (x.value as { technology: string }).technology);
    expect(t).toEqual(
      expect.arrayContaining(["Microsoft 365", "Salesforce", "Adobe Marketo Engage", "Atlassian"]),
    );
    expect(byField(p, "tech:Email & collaboration:Microsoft 365")?.confidence).toBe("high"); // MX beats SPF
    expect(p.every((x) => x.evidenceSnippet!.startsWith("Hypothesis from public DNS"))).toBe(true);
  });
});

describe("hiring", () => {
  it("normalizes all four boards and summarizes by function and practice", () => {
    expect(
      normalizeBoard("ashby", {
        jobs: [
          {
            title: "GPU Platform Engineer",
            department: "Engineering",
            isListed: true,
            jobUrl: "u",
          },
          { title: "Hidden", isListed: false },
        ],
      }),
    ).toHaveLength(1);
    expect(
      normalizeBoard("smartrecruiters", {
        content: [
          {
            name: "SOC Analyst",
            department: { label: "Security" },
            location: { city: "Austin", country: "us" },
          },
        ],
      })[0],
    ).toMatchObject({ location: "Austin, US" });
    expect(
      normalizeBoard("greenhouse", {
        jobs: [{ title: "Data Engineer", departments: [{ name: "Data" }] }],
      })[0].department,
    ).toBe("Data");
    expect(
      normalizeBoard("lever", [{ text: "Network Engineer", categories: { team: "IT" } }])[0].title,
    ).toBe("Network Engineer");
    const posts = [
      "GPU Cluster Engineer",
      "HPC Infrastructure Engineer",
      "AI Infrastructure Lead",
      "Kubernetes Platform Engineer",
      "Account Executive",
    ].map((t) => ({ title: t, department: null, location: null, url: null }));
    expect(fnFor(posts[4])).toBe("Sales & marketing");
    const p = normalizeHiring(
      posts,
      { provider: "greenhouse", slug: "x", url: "https://boards.greenhouse.io/x" },
      new Date("2026-11-05T00:00:00Z"),
    );
    expect(byField(p, "hiring.snapshot")?.value).toMatchObject({ total: 5, asOf: "2026-11-05" });
    expect(p.some((x) => x.field === "evidence.initiative:hiring-ai-infra")).toBe(true);
    expect(p.some((x) => x.field === "tech:Containers:Kubernetes")).toBe(true);
  });
});

describe("optional sources", () => {
  it("PeeringDB uses exact org matches only", () => {
    expect(
      matchOrg(
        [
          { id: 1, name: "Example Networks, Inc." },
          { id: 2, name: "Example Networks Europe" },
        ],
        "Example Networks",
      ),
    ).toMatchObject({ id: 1 });
    const p = normalizePeering(
      { id: 1, name: "Example Networks, Inc." },
      [{ id: 9, name: "EXNET", asn: 64500 }],
      [
        { net_id: 9, fac_id: 3, name: "Example DC 1", city: "Dallas" },
        { net_id: 9, fac_id: 3, name: "Example DC 1" },
      ],
    );
    expect(p[0].value).toMatchObject({ asns: [64500], facilities: 1 });
  });
  it("USAspending keeps awards whose recipient matches the account", () => {
    const p = normalizeAwards(
      [
        {
          "Award ID": "A",
          "Recipient Name": "EXAMPLE SYSTEMS INC",
          "Award Amount": 5e6,
          "Awarding Agency": "Department of Example",
        },
        {
          "Award ID": "B",
          "Recipient Name": "OTHER CORP",
          "Award Amount": 9e9,
          "Awarding Agency": "X",
        },
      ],
      "Example Systems",
      "2023-11-05",
    );
    expect(p[0].value).toMatchObject({
      awards: 1,
      totalValue: 5e6,
      topAgencies: [{ agency: "Department of Example", amount: 5e6 }],
    });
  });
});
