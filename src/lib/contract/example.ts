import type { Contract } from "./schema";

/** A fictional example file (invented company, .example domain). Shipped in docs/contract/ for integrators. */
export const CONTRACT_EXAMPLE: Contract = {
  format: "acc-data",
  version: "1.0",
  exportedAt: "2026-11-09T12:00:00.000Z",
  source: { system: "example-system", note: "Fictional sample showing every entity type." },
  visibility: "internal",
  entities: {
    accounts: [
      {
        externalId: "A-1001",
        name: "Example Holdings Inc.",
        domain: "holdings.example",
        industry: "Manufacturing",
        hq: "Springfield",
        tier: "Strategic",
      },
    ],
    contacts: [
      {
        externalId: "C-1",
        account: { externalId: "A-1001" },
        displayName: "Pat Example",
        title: "Chief Information Officer",
        function: "IT",
        seniority: "C-Level",
        buyingRole: "EconomicBuyer",
        engagement: "Engaged",
      },
      {
        externalId: "C-2",
        account: { domain: "holdings.example" },
        title: "Director, Infrastructure",
        seniority: "Director",
        buyingRole: "Champion",
      },
    ],
    opportunities: [
      {
        externalId: "O-77",
        account: { externalId: "A-1001" },
        name: "Data center refresh",
        practiceArea: "modern-dc",
        stage: "Discover",
        amount: 450000,
        closeDate: "2027-03-31",
        nextStep: "Architecture workshop",
        nextStepDate: "2026-11-20",
      },
    ],
    activities: [
      {
        externalId: "T-9",
        account: { externalId: "A-1001" },
        channel: "meeting",
        persona: "Chief Information Officer",
        date: "2026-11-04",
        completed: true,
        outcome: "meeting",
        summary: "Discussed refresh timing",
      },
    ],
    notes: [
      {
        externalId: "N-3",
        account: { externalId: "A-1001" },
        body: "Budget cycle starts in Q1.",
        date: "2026-11-04",
      },
    ],
    tasks: [
      {
        externalId: "K-5",
        account: { externalId: "A-1001" },
        title: "Send workshop agenda",
        dueDate: "2026-11-15",
        priority: "high",
        status: "open",
      },
    ],
    partnerReps: [
      {
        externalId: "P-2",
        partnerCompany: "Compute OEM A",
        name: "Riley Example",
        title: "Partner manager",
        accounts: [{ externalId: "A-1001" }],
      },
    ],
  },
};
