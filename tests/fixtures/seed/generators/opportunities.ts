import { DEFAULT_PRACTICE_AREAS } from "../../../../src/config/practice-areas";
import {
  MEDDPICC_KEYS,
  OPEN_STAGES,
  STAGE_DEFAULT_PROBABILITY,
  type Meddpicc,
  type Stage,
} from "../../../../src/lib/domain/enums";
import { GENERIC_COMPETITORS, GENERIC_PARTNERS, NAME_ROOTS } from "../names";
import { daysFrom, type Rng } from "../rng";

const PROJECTS: Record<string, string[]> = {
  "ai-infra": [
    "GPU cluster phase 1",
    "Inference platform",
    "AI pilot environment",
    "Model training capacity",
  ],
  "modern-dc": [
    "Compute refresh",
    "Storage modernization",
    "Network fabric upgrade",
    "DC consolidation wave 1",
  ],
  cloud: ["Landing zone build", "FinOps sprint", "Workload migration", "Hybrid cloud platform"],
  "data-analytics": ["Lakehouse migration", "Data governance program", "Analytics platform"],
  security: ["Zero-trust roadmap", "Ransomware recovery", "SOC modernization", "Identity program"],
  automation: ["Internal developer platform", "IaC pipelines", "Kubernetes platform"],
  esm: ["ITSM expansion", "HR service delivery", "ITOM rollout", "Instance health remediation"],
  "managed-services": ["Managed infrastructure ops", "24x7 monitoring", "Managed backup"],
  "integration-facility": [
    "Pre-integrated racks",
    "Rack-scale AI delivery",
    "Edge kit integration",
  ],
};

const AMOUNT_RANGE: Record<string, [number, number]> = {
  "ai-infra": [250_000, 6_000_000],
  "modern-dc": [150_000, 3_500_000],
  cloud: [60_000, 1_200_000],
  "data-analytics": [80_000, 1_000_000],
  security: [60_000, 1_500_000],
  automation: [60_000, 800_000],
  esm: [50_000, 900_000],
  "managed-services": [120_000, 2_500_000],
  "integration-facility": [200_000, 4_000_000],
};

function meddpiccFor(rng: Rng, stageIdx: number): Meddpicc {
  // Later stages → more fields confirmed. stageIdx: 0..4 open, 5 = closed.
  const p = 0.15 + stageIdx * 0.16;
  return Object.fromEntries(
    MEDDPICC_KEYS.map((k) => {
      const x = rng.next();
      const status = x < p ? "confirmed" : x < p + 0.3 ? "partial" : "unknown";
      return [k, { status, notes: "" }];
    }),
  ) as Meddpicc;
}

export interface SeedOpp {
  id: string;
  accountId: string;
  name: string;
  practiceArea: string;
  stage: Stage;
  amount: number;
  closeDate: Date;
  probability: number;
  forecastCategory: string;
  nextStep: string | null;
  nextStepDate: Date | null;
  meddpicc: Meddpicc;
  partners: string[];
  competitors: string[];
  closeDatePushes: number;
  stageChangedAt: Date;
  closedAt: Date | null;
  closeReason: string | null;
  createdAt: Date;
  history: Array<{ fromStage: Stage | null; toStage: Stage; changedAt: Date }>;
}

const NEXT_STEPS = [
  "Schedule technical deep-dive",
  "Send revised proposal",
  "Confirm budget with finance",
  "Executive alignment meeting",
  "Workshop with architecture team",
  "Security review",
  "Procurement redlines",
  "Pilot success criteria sign-off",
];

export function generateOpportunity(
  rng: Rng,
  index: number,
  accountId: string,
  accountName: string,
  anchor: Date,
): SeedOpp {
  const practice = rng.pick(DEFAULT_PRACTICE_AREAS).id;
  const outcome = rng.weighted<"open" | "won" | "lost">([
    ["open", 65],
    ["won", 20],
    ["lost", 15],
  ]);
  const [lo, hi] = AMOUNT_RANGE[practice];
  const amount = rng.amount(lo, hi);
  let stage: Stage;
  let createdAt: Date;
  let stageChangedAt: Date;
  let closeDate: Date;
  let closedAt: Date | null = null;

  if (outcome === "open") {
    stage = rng.weighted<Stage>([
      ["Qualify", 23],
      ["Discover", 23],
      ["Solution", 22],
      ["Proposal", 18],
      ["Negotiate", 14],
    ]);
    const idx = OPEN_STAGES.indexOf(stage as (typeof OPEN_STAGES)[number]);
    createdAt = daysFrom(anchor, -rng.int(10 + idx * 15, 60 + idx * 45));
    const sinceCreated = (anchor.getTime() - createdAt.getTime()) / 86_400_000;
    stageChangedAt = daysFrom(
      anchor,
      -rng.int(0, Math.max(1, Math.min(sinceCreated - 1, rng.bool(0.25) ? 75 : 35))),
    );
    closeDate = daysFrom(
      anchor,
      rng.bool(0.08) ? -rng.int(1, 25) : rng.int(5, 40 + (4 - idx) * 50),
    );
  } else {
    stage = outcome === "won" ? "ClosedWon" : "ClosedLost";
    closedAt = daysFrom(anchor, -rng.int(1, 365));
    createdAt = daysFrom(closedAt, -rng.int(35, 220));
    stageChangedAt = closedAt;
    closeDate = closedAt;
  }

  // Stage history: walk forward from Qualify.
  const history: SeedOpp["history"] = [
    { fromStage: null, toStage: "Qualify", changedAt: createdAt },
  ];
  const finalOpenIdx =
    stage === "ClosedLost"
      ? rng.int(0, 3)
      : stage === "ClosedWon"
        ? 4
        : OPEN_STAGES.indexOf(stage as (typeof OPEN_STAGES)[number]);
  const steps = finalOpenIdx + (outcome === "open" ? 0 : 1);
  const span = stageChangedAt.getTime() - createdAt.getTime();
  for (let i = 1; i <= steps; i++) {
    const to: Stage = i <= finalOpenIdx ? OPEN_STAGES[i] : stage;
    const at =
      i === steps
        ? stageChangedAt
        : new Date(createdAt.getTime() + (span * i) / steps - rng.int(0, 3) * 86_400_000);
    history.push({ fromStage: history[history.length - 1].toStage, toStage: to, changedAt: at });
  }

  const stageIdx = outcome === "open" ? finalOpenIdx : 5;
  const prob =
    outcome === "open"
      ? Math.max(5, Math.min(95, STAGE_DEFAULT_PROBABILITY[stage] + rng.int(-10, 10)))
      : STAGE_DEFAULT_PROBABILITY[stage];
  const forecastCategory =
    outcome !== "open"
      ? "Closed"
      : stage === "Negotiate"
        ? rng.bool(0.75)
          ? "Commit"
          : "BestCase"
        : stage === "Proposal"
          ? rng.bool(0.4)
            ? "Commit"
            : "BestCase"
          : stage === "Solution"
            ? rng.bool(0.3)
              ? "BestCase"
              : "Pipeline"
            : "Pipeline";

  return {
    id: `demo-opp-${String(index).padStart(4, "0")}`,
    accountId,
    name: `${NAME_ROOTS.find((r) => accountName.startsWith(r)) ?? accountName.split(" ")[0]} — ${rng.pick(PROJECTS[practice])}`,
    practiceArea: practice,
    stage,
    amount,
    closeDate,
    probability: prob,
    forecastCategory,
    nextStep: outcome === "open" ? rng.pick(NEXT_STEPS) : null,
    // Deterministic without consuming the RNG (keeps every other fixture value stable); ~20% left undated.
    nextStepDate:
      outcome === "open" && index % 5 !== 0
        ? new Date(anchor.getTime() + (((index * 7) % 27) - 5) * 86_400_000)
        : null,
    meddpicc: meddpiccFor(rng, stageIdx),
    partners: rng.sample(GENERIC_PARTNERS, rng.int(0, 2)),
    competitors: rng.sample(GENERIC_COMPETITORS, rng.int(0, 2)),
    closeDatePushes:
      outcome === "open"
        ? rng.weighted([
            [0, 6],
            [1, 3],
            [2, 1.5],
            [3, 0.6],
          ] as const)
        : rng.int(0, 2),
    stageChangedAt,
    closedAt,
    closeReason: closeReasonFor(outcome, closedAt),
    createdAt,
    history,
  };
}

// Derived from the close date (no RNG draw, so the rest of the fixture stream is unchanged); ~1 in 5 unrecorded.
const WON_REASONS = ["value", "relationship", "technical-fit", "partner"];
const LOST_REASONS = ["competitor", "no-decision", "budget", "timing", "scope-change"];
function closeReasonFor(outcome: string, closedAt: Date | null) {
  if (!closedAt || outcome === "open") return null;
  const n = Math.floor(closedAt.getTime() / 86_400_000);
  if (n % 5 === 0) return null;
  const list = outcome === "won" ? WON_REASONS : LOST_REASONS;
  return list[n % list.length];
}
