import type { Enricher } from "../../types";
import { detectJobBoard, normalizeHomepage } from "./normalize";

/** Company website: schema.org/meta profile, key links, RSS, job board and web-tech hypotheses. robots.txt honored. */
const website: Enricher = {
  id: "website",
  label: "Company website",
  source: "Company website",
  description:
    "Homepage (and careers page) profile, newsroom/IR/careers links, RSS feeds, job board, web technology hypotheses.",
  requires: ["domain"],
  produces: ["firmographics.description", "firmographics.hqAddress", "web.*", "tech:*"],
  ttlDays: 30,
  defaultEnabled: true,
  async run(id, ctx) {
    const home =
      (await ctx.http.page(`https://${id.domain}/`)) ??
      (await ctx.http.page(`https://www.${id.domain}/`));
    if (!home) {
      ctx.log("homepage not reachable or disallowed by robots.txt");
      return { proposals: [] };
    }
    const r = normalizeHomepage({ url: home.url, html: home.body, headers: home.headers });
    // Careers page often links the job board when the homepage doesn't.
    if (!r.hasBoard && r.careersUrl) {
      const careers = await ctx.http.page(r.careersUrl).catch(() => null);
      const board = careers && detectJobBoard(careers.body);
      if (board)
        r.proposals.push({
          field: "web.jobBoard",
          value: board,
          sourceUrl: careers.url,
          confidence: "high",
          evidenceSnippet: `Careers page links to ${board.provider} board "${board.slug}"`,
        });
    }
    return { proposals: r.proposals };
  },
};
export default website;
