import "server-only";
import type { SectionBuilders } from "@/lib/export/builder-types";

export const builders: SectionBuilders = {
  "exports.cover": async (ctx) => {
    const n = ctx.accounts.length;
    const industries = [...new Set(ctx.accounts.map((a) => a.industry))];
    const scope =
      ctx.scope === "portfolio"
        ? `the full portfolio of ${n} accounts`
        : n === 1
          ? ctx.accounts[0].name
          : `${n} selected accounts`;
    return [
      {
        kind: "paragraph",
        text: `This summary covers ${scope}${industries.length <= 3 ? ` (${industries.join(", ")})` : ` across ${industries.length} industries`}. Every intelligence item links to its public source or is labeled as a hypothesis.`,
      },
    ];
  },
};
