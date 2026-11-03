/** Generic demand-gen plays aligned to practice areas (no proprietary content). */
export interface SeedPlay {
  slug: string;
  name: string;
  practiceArea: string;
  targetPersonas: string[];
  triggerKeywords: string[];
  triggerSignalTypes: string[];
  valueHypothesis: string;
  talkTrack: string[];
  sequence: Array<{ day: number; channel: string; description: string }>;
  assetsNeeded: string[];
  successMetrics: string[];
}

const seq = (...steps: Array<[number, string, string]>) =>
  steps.map(([day, channel, description]) => ({ day, channel, description }));

export const SEED_PLAYS: SeedPlay[] = [
  {
    slug: "ai-readiness-assessment",
    name: "AI infrastructure readiness assessment",
    practiceArea: "ai-infra",
    targetPersonas: [
      "Chief Technology Officer",
      "Head of AI Platform",
      "VP, Infrastructure & Operations",
    ],
    triggerKeywords: ["GPU", "AI", "inference", "HPC"],
    triggerSignalTypes: ["hiring", "funding", "earnings", "news"],
    valueHypothesis:
      "Most AI programs stall on power, cooling, and networking constraints — a readiness assessment de-risks the first cluster.",
    talkTrack: [
      "Where are AI workloads running today?",
      "What's the power/cooling envelope of your current facility?",
      "How are you sizing GPU capacity vs. demand?",
    ],
    sequence: seq(
      [0, "email", "Readiness point-of-view + evidence"],
      [3, "linkedin", "Share AI infrastructure checklist"],
      [7, "call", "Discovery call opener"],
      [14, "email", "Offer workshop slots"],
    ),
    assetsNeeded: ["Readiness checklist", "Reference architecture", "Workshop agenda"],
    successMetrics: ["Workshop booked", "Assessment SOW"],
  },
  {
    slug: "dc-consolidation",
    name: "Data center consolidation & modernization",
    practiceArea: "modern-dc",
    targetPersonas: [
      "Chief Information Officer",
      "Director, Data Center Operations",
      "Chief Financial Officer",
    ],
    triggerKeywords: ["data center", "consolidation", "colocation", "lease"],
    triggerSignalTypes: ["m-and-a", "earnings", "filing", "news"],
    valueHypothesis:
      "Consolidation funds modernization: exiting a facility can self-fund refresh and reduce operational risk.",
    talkTrack: [
      "What's the timeline on your facility leases?",
      "Where is utilization lowest?",
      "How is refresh being funded?",
    ],
    sequence: seq(
      [0, "email", "Consolidation economics note"],
      [5, "call", "CFO-angle opener"],
      [12, "meeting", "Footprint review"],
    ),
    assetsNeeded: ["TCO model template", "Migration wave plan example"],
    successMetrics: ["Footprint review held", "Opportunity created"],
  },
  {
    slug: "pre-integrated-racks",
    name: "Pre-integrated rack delivery",
    practiceArea: "integration-facility",
    targetPersonas: [
      "VP, Infrastructure & Operations",
      "Director, Data Center Operations",
      "Director, IT Procurement",
    ],
    triggerKeywords: ["rack", "deployment", "lead times", "supply chain", "GPU"],
    triggerSignalTypes: ["expansion", "hiring", "news"],
    valueHypothesis:
      "Racks that arrive built, cabled, and tested cut deployment time from weeks to days and reduce on-site risk.",
    talkTrack: [
      "How long does a rack take from dock to production today?",
      "Who does burn-in and validation?",
      "What happens when parts are DOA?",
    ],
    sequence: seq(
      [0, "email", "Time-to-production story"],
      [4, "linkedin", "Integration facility tour invite"],
      [10, "call", "Ops-focused opener"],
    ),
    assetsNeeded: ["Integration process overview", "Tour invite"],
    successMetrics: ["Facility tour", "Pilot rack order"],
  },
  {
    slug: "finops",
    name: "Cloud cost optimization / FinOps",
    practiceArea: "cloud",
    targetPersonas: ["Chief Financial Officer", "VP, Cloud Platform", "Chief Information Officer"],
    triggerKeywords: ["cloud spend", "FinOps", "cost"],
    triggerSignalTypes: ["earnings", "filing", "news", "hiring"],
    valueHypothesis:
      "A focused FinOps sprint typically finds double-digit savings without slowing delivery.",
    talkTrack: [
      "Who owns the cloud bill?",
      "How are commitments and rightsizing managed?",
      "What's the target run-rate?",
    ],
    sequence: seq(
      [0, "email", "Savings benchmark"],
      [3, "call", "Finance-angle opener"],
      [9, "email", "Sprint proposal"],
    ),
    assetsNeeded: ["Savings benchmark one-pager", "Sprint outline"],
    successMetrics: ["Bill review", "Sprint SOW"],
  },
  {
    slug: "ransomware-resilience",
    name: "Security posture & ransomware resilience",
    practiceArea: "security",
    targetPersonas: [
      "Chief Information Security Officer",
      "Manager, Security Operations",
      "Chief Information Officer",
    ],
    triggerKeywords: ["ransomware", "breach", "zero trust", "incident"],
    triggerSignalTypes: ["incident", "regulatory", "exec-change", "filing"],
    valueHypothesis:
      "Recovery, not prevention alone, determines business impact — tested recovery is the fastest risk reduction.",
    talkTrack: [
      "When did you last test full recovery?",
      "Are backups immutable and isolated?",
      "How would new reporting rules affect you?",
    ],
    sequence: seq(
      [0, "email", "Recovery readiness note"],
      [2, "linkedin", "Share tabletop exercise outline"],
      [7, "call", "CISO opener"],
    ),
    assetsNeeded: ["Tabletop exercise outline", "Recovery maturity model"],
    successMetrics: ["Tabletop booked", "Assessment SOW"],
  },
  {
    slug: "esm-expansion",
    name: "ServiceNow / ESM expansion",
    practiceArea: "esm",
    targetPersonas: ["Director, IT Service Management", "Chief Information Officer"],
    triggerKeywords: ["ServiceNow", "ITSM", "service management", "workflow"],
    triggerSignalTypes: ["hiring", "news", "m-and-a"],
    valueHypothesis:
      "Extending the platform beyond IT turns a cost center tool into an enterprise workflow backbone.",
    talkTrack: [
      "Which teams still run on email and spreadsheets?",
      "What's the roadmap after ITSM?",
      "How healthy is the instance?",
    ],
    sequence: seq(
      [0, "email", "Instance health check offer"],
      [5, "call", "ITSM leader opener"],
      [12, "meeting", "Roadmap session"],
    ),
    assetsNeeded: ["Health check scope", "Roadmap template"],
    successMetrics: ["Health check", "Expansion opp"],
  },
  {
    slug: "platform-engineering",
    name: "Platform engineering & automation",
    practiceArea: "automation",
    targetPersonas: [
      "Chief Technology Officer",
      "VP, Cloud Platform",
      "Director, Enterprise Architecture",
    ],
    triggerKeywords: ["platform engineering", "DevOps", "Kubernetes", "automation"],
    triggerSignalTypes: ["hiring", "news"],
    valueHypothesis:
      "Golden paths and self-service infrastructure raise developer throughput while improving governance.",
    talkTrack: [
      "How long does it take a team to get an environment?",
      "What's standardized vs. bespoke?",
      "Where is toil highest?",
    ],
    sequence: seq(
      [0, "linkedin", "Platform maturity post"],
      [3, "email", "Golden-path example"],
      [8, "call", "Engineering leader opener"],
    ),
    assetsNeeded: ["Platform maturity model"],
    successMetrics: ["Maturity assessment", "Pilot"],
  },
  {
    slug: "exec-briefing",
    name: "Executive briefing / roundtable invite",
    practiceArea: "ai-infra",
    targetPersonas: ["Chief Information Officer", "Chief Technology Officer"],
    triggerKeywords: ["AI", "strategy"],
    triggerSignalTypes: ["exec-change", "earnings"],
    valueHypothesis:
      "Peer roundtables create executive access and surface priorities faster than cold outreach.",
    talkTrack: [
      "What are peers doing about AI infrastructure?",
      "Which outcomes matter most this year?",
    ],
    sequence: seq(
      [0, "email", "Personal invite"],
      [5, "call", "Follow-up call"],
      [10, "email", "Final reminder + agenda"],
    ),
    assetsNeeded: ["Invite", "Agenda"],
    successMetrics: ["Attendance", "1:1 follow-up"],
  },
  {
    slug: "partner-event-follow-up",
    name: "Partner co-sell event follow-up",
    practiceArea: "modern-dc",
    targetPersonas: ["VP, Infrastructure & Operations", "Director, Enterprise Architecture"],
    triggerKeywords: ["partnership", "event"],
    triggerSignalTypes: ["partnership"],
    valueHypothesis:
      "Joint follow-up within a week converts event interest into a scoped conversation.",
    talkTrack: ["What stood out from the session?", "Which workload would you pilot first?"],
    sequence: seq(
      [1, "email", "Recap + resources"],
      [4, "call", "Scoping call"],
      [10, "meeting", "Joint workshop"],
    ),
    assetsNeeded: ["Event recap", "Joint workshop outline"],
    successMetrics: ["Workshop held", "Opportunity created"],
  },
  {
    slug: "new-exec-90-days",
    name: "New executive first-90-days",
    practiceArea: "managed-services",
    targetPersonas: [
      "Chief Information Officer",
      "Chief Information Security Officer",
      "Chief Technology Officer",
    ],
    triggerKeywords: ["names new", "appointed"],
    triggerSignalTypes: ["exec-change"],
    valueHypothesis:
      "New leaders reassess the roadmap in their first 90 days — offer a fast, independent baseline.",
    talkTrack: ["What did you inherit?", "What would make your first year a success?"],
    sequence: seq(
      [0, "linkedin", "Congratulations note"],
      [7, "email", "Baseline assessment offer"],
      [14, "call", "Intro call"],
    ),
    assetsNeeded: ["Baseline assessment outline"],
    successMetrics: ["Intro meeting"],
  },
  {
    slug: "data-platform",
    name: "Data platform modernization",
    practiceArea: "data-analytics",
    targetPersonas: ["VP, Data & Analytics", "Chief Technology Officer"],
    triggerKeywords: ["data platform", "analytics", "lakehouse", "data engineers"],
    triggerSignalTypes: ["hiring", "news", "m-and-a"],
    valueHypothesis:
      "A governed data platform is the prerequisite for AI — consolidation reduces cost and risk.",
    talkTrack: ["How many warehouses do you run?", "How is AI getting access to governed data?"],
    sequence: seq([0, "email", "Data-for-AI point of view"], [5, "call", "Data leader opener"]),
    assetsNeeded: ["Reference architecture"],
    successMetrics: ["Architecture session"],
  },
  {
    slug: "liquid-cooling",
    name: "Liquid cooling readiness",
    practiceArea: "modern-dc",
    targetPersonas: ["Director, Data Center Operations", "VP, Infrastructure & Operations"],
    triggerKeywords: ["liquid cooling", "rack density", "GPU"],
    triggerSignalTypes: ["expansion", "news", "hiring"],
    valueHypothesis:
      "Next-generation accelerators exceed air-cooling limits; planning now avoids costly retrofits.",
    talkTrack: ["What's your max kW per rack today?", "Has facilities evaluated direct-to-chip?"],
    sequence: seq([0, "email", "Density planning note"], [6, "call", "Facilities opener"]),
    assetsNeeded: ["Density planning guide"],
    successMetrics: ["Facilities walkthrough"],
  },
  {
    slug: "managed-ops",
    name: "Managed infrastructure operations",
    practiceArea: "managed-services",
    targetPersonas: ["VP, Infrastructure & Operations", "Chief Information Officer"],
    triggerKeywords: ["managed services", "staff", "outage", "24x7"],
    triggerSignalTypes: ["incident", "hiring", "exec-change"],
    valueHypothesis: "Shifting day-2 operations frees scarce engineers for transformation work.",
    talkTrack: [
      "Where does your team spend nights and weekends?",
      "Which roles are hardest to hire?",
    ],
    sequence: seq([0, "email", "Ops capacity note"], [4, "call", "Infra leader opener"]),
    assetsNeeded: ["Service catalog overview"],
    successMetrics: ["Scoping call"],
  },
  {
    slug: "post-incident-review",
    name: "Post-incident resilience review",
    practiceArea: "security",
    targetPersonas: ["Chief Information Security Officer", "Chief Information Officer"],
    triggerKeywords: ["outage", "incident", "disruption", "breach"],
    triggerSignalTypes: ["incident"],
    valueHypothesis:
      "After an incident, an outside resilience review helps leadership show the board a credible plan.",
    talkTrack: ["What did the post-incident review find?", "What does the board want to see next?"],
    sequence: seq(
      [2, "email", "Thoughtful, non-opportunistic note"],
      [10, "call", "Offer resilience review"],
    ),
    assetsNeeded: ["Resilience review outline"],
    successMetrics: ["Review booked"],
  },
  {
    slug: "m-and-a-integration",
    name: "M&A IT integration",
    practiceArea: "cloud",
    targetPersonas: ["Chief Information Officer", "Director, Enterprise Architecture"],
    triggerKeywords: ["acquire", "acquisition", "merger"],
    triggerSignalTypes: ["m-and-a"],
    valueHypothesis:
      "Integration speed determines deal value; a repeatable integration playbook reduces risk.",
    talkTrack: ["What's the Day-1 / Day-100 plan?", "Which platforms will you standardize on?"],
    sequence: seq(
      [0, "email", "Integration playbook note"],
      [5, "call", "CIO opener"],
      [12, "meeting", "Integration workshop"],
    ),
    assetsNeeded: ["Integration playbook"],
    successMetrics: ["Workshop", "Opportunity created"],
  },
];
