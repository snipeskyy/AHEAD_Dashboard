import type { Enricher } from "../../types";
import { boardUrl, fetchBoard } from "./boards";
import { normalizeHiring } from "./normalize";

/** Public job boards: open roles by function (trend over time), practice-area initiative evidence, tech hypotheses. */
const hiring: Enricher = {
  id: "hiring",
  label: "Hiring (public job boards)",
  source: "Job board",
  description:
    "Greenhouse, Lever, Ashby or SmartRecruiters public postings: open roles by function, hiring-based initiative evidence and tech-stack hypotheses.",
  requires: ["jobBoard"],
  produces: ["hiring.snapshot", "evidence.initiative:*", "tech:*"],
  ttlDays: 7,
  defaultEnabled: true,
  async run(id, ctx) {
    const { provider, slug } = id.jobBoard!;
    const postings = await fetchBoard(ctx, provider, slug);
    return {
      proposals: normalizeHiring(
        postings,
        { provider, slug, url: boardUrl(provider, slug) },
        ctx.now,
      ),
    };
  },
};
export default hiring;
