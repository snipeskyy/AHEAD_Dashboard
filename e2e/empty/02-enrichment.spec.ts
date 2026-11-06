import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

/**
 * Phase 6 review flows on the TEST database. Runs after first-run.spec (which imported "Example Holdings Inc.").
 * Enricher output is inserted directly (no live calls in tests); the identity search API is mocked.
 */
const testDbUrl = `file:${path.join(process.cwd(), "prisma", (process.env.DATABASE_URL_TEST ?? "file:./test.db").replace(/^file:\.?\/?/, ""))}`;
test.describe.configure({ mode: "serial" });

let accountId = "";
const now = new Date();

test.beforeAll(async () => {
  const db = new PrismaClient({ datasourceUrl: testDbUrl });
  const a = await db.account.findFirstOrThrow({ where: { domain: "example.com" } });
  accountId = a.id;
  const base = {
    accountId,
    enricherId: "sec-edgar",
    source: "SEC EDGAR",
    fetchedAt: now,
    status: "pending",
  };
  await db.fieldProposal.createMany({
    data: [
      {
        ...base,
        field: "firmographics.industry",
        value: "Insurance Carriers",
        sourceUrl: "https://www.sec.gov/example",
        confidence: "medium",
      },
      {
        ...base,
        enricherId: "sec-filings-text",
        source: "SEC 10-K",
        field: "evidence.initiative:ai",
        value: {
          title: "AI and accelerated computing",
          practiceAreas: ["ai-infra"],
          section: "10-K Item 1 (Business)",
          kind: "filing",
        },
        sourceUrl: "https://www.sec.gov/example-10k",
        confidence: "high",
        evidenceSnippet: "We are expanding generative AI pilots across claims processing.",
      },
      {
        ...base,
        enricherId: "sec-officers",
        source: "SEC insider filings",
        field: "contact:0000000001",
        value: { name: "Avery Quill", title: "Chief Information Officer" },
        sourceUrl: "https://www.sec.gov/example-form4",
        confidence: "high",
      },
      {
        ...base,
        enricherId: "dns",
        source: "Public DNS",
        field: "tech:Email & collaboration:Microsoft 365",
        value: { category: "Email & collaboration", technology: "Microsoft 365", kind: "dns" },
        sourceUrl: "https://dns.google/query?name=example.com&rr_type=MX",
        confidence: "high",
        evidenceSnippet: "Hypothesis from public DNS: MX → example-com.mail.protection.outlook.com",
      },
    ],
  });
  await db.accountField.create({
    data: {
      accountId,
      field: "financials.fiscalYearEnd",
      value: "0630",
      source: "sec-edgar",
      sourceUrl: "https://www.sec.gov/example",
      confidence: "high",
      fetchedAt: now,
    },
  });
  await db.account.update({ where: { id: accountId }, data: { fiscalYearEnd: "0630" } });
  await db.financialFact.createMany({
    data: [2024, 2025, 2026].map((y, i) => ({
      accountId,
      metric: "capex",
      fiscalYear: y,
      periodEnd: new Date(`${y}-06-30`),
      value: 3e8 + i * 5e7,
      sourceUrl: "https://www.sec.gov/example",
    })),
  });
  await db.corporateRelation.create({
    data: {
      accountId,
      relation: "subsidiary",
      name: "Example Holdings Services LLC",
      source: "GLEIF",
      sourceUrl: "https://search.gleif.org/#/record/EXAMPLE",
    },
  });
  await db.enrichmentRun.create({
    data: {
      accountId,
      enricherId: "sec-edgar",
      startedAt: now,
      finishedAt: now,
      ok: true,
      proposals: 2,
    },
  });
  await db.$disconnect();
});

test("Accounts tab shows status and completeness; review needed", async ({ page }) => {
  await page.goto("/accounts");
  const row = page.getByRole("row", { name: /Example Holdings Inc\./ });
  await expect(row.getByText(/Review needed \(4\)/)).toBeVisible();
  await expect(row.getByText(/\d+%/)).toBeVisible();
});

test("Profile tab: accept / reject proposals, provenance, manual lock, hierarchy, financials", async ({
  page,
}) => {
  await page.goto(`/accounts/${accountId}?tab=profile`);
  await expect(page.getByRole("heading", { name: "Proposed updates (4)" })).toBeVisible();
  await expect(page.getByText("Capex · FY2026")).toBeVisible();
  await expect(page.getByText("Example Holdings Services LLC")).toBeVisible();
  await page.screenshot({ path: "screenshots/light/account-360-profile.png", fullPage: true });

  await page.getByRole("button", { name: "Accept Industry" }).click();
  await expect(page.getByRole("heading", { name: "Proposed updates (3)" })).toBeVisible();
  await page.getByRole("button", { name: "Accept AI and accelerated computing" }).click();
  await page.getByRole("button", { name: "Accept Avery Quill, Chief Information Officer" }).click();
  await page.getByRole("button", { name: "Reject Microsoft 365 (Email & collaboration)" }).click();
  await expect(page.getByRole("heading", { name: /Proposed updates/ })).toHaveCount(0);

  // Manual entry locks the field against enrichment.
  await page.getByRole("button", { name: "Edit Employees" }).click();
  await page.getByRole("textbox", { name: "Employees" }).fill("12000");
  await page.getByRole("button", { name: "Save" }).first().click();
  await expect(page.getByRole("button", { name: /Unlock Employees/ })).toBeVisible();

  await page.goto(`/accounts/${accountId}?tab=intelligence`);
  await expect(
    page.getByText("We are expanding generative AI pilots across claims processing.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.goto(`/accounts/${accountId}?tab=committee`);
  await expect(page.getByText("Avery Quill").first()).toBeVisible();
});

test("identity dialog confirms identifiers and queues enrichment; queue can be cancelled", async ({
  page,
}) => {
  await page.route(`**/api/accounts/${accountId}/identity`, (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          json: {
            candidates: [
              {
                key: "Q1",
                label: "Example Holdings Inc.",
                facts: ["Springfield, US-IL", "LEI 5299000EXAMPLE0000A1"],
                identifiers: {
                  lei: "5299000EXAMPLE0000A1",
                  wikidataId: "Q1",
                  domain: "example.com",
                  legalName: "Example Holdings Inc.",
                },
                sources: [{ source: "GLEIF", url: "https://search.gleif.org" }],
                score: 92,
                reasons: ["Name match 100%", "Website matches the account domain"],
              },
            ],
            defaultKey: "Q1",
            notes: [],
          },
        })
      : route.continue(),
  );
  await page.goto(`/accounts/${accountId}?tab=profile`);
  await page.getByRole("button", { name: "Resolve identity" }).click();
  await expect(page.getByRole("radio", { name: /Example Holdings Inc\./ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page.getByLabel("LEI", { exact: true })).toHaveValue("5299000EXAMPLE0000A1");
  await page.getByRole("button", { name: "Confirm identity & enrich" }).click();
  await expect(page.getByText("Identity confirmed").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Queued…|Fetching…/ })).toBeVisible();

  await page.goto("/accounts");
  await page.getByRole("button", { name: /Enriching \d|Enrichment queue/ }).click();
  await expect(page.getByRole("dialog").getByText("Example Holdings Inc.")).toBeVisible();
  await page.getByRole("button", { name: "Cancel queued" }).click();
  await expect(page.getByRole("dialog").getByText("cancelled").first()).toBeVisible();
});

test("bulk: select accounts and enrich selected", async ({ page }) => {
  await page.goto("/accounts");
  await page.getByRole("checkbox", { name: "Select Sample Logistics" }).click();
  await page.getByRole("button", { name: "Enrich selected" }).click();
  await expect(page.getByText(/Queued 1 account/)).toBeVisible();
  await expect(
    page.getByRole("row", { name: /Sample Logistics/ }).getByText("Queued"),
  ).toBeVisible();
});
