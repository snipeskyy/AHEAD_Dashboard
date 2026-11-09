import { z } from "zod";
import { renderPdf } from "@/lib/export/pdf";
import { handler } from "@/lib/server/http";
import { HttpError } from "@/lib/server/http";
import { auditPlanShare, getPlan } from "@/lib/server/action-plans";

type Ctx = { params: Promise<{ id: string }> };
const Q = z.object({ audience: z.enum(["customer", "internal"]).default("customer") });

/** PDF of the plan, printed by headless Chromium from /print/plan/<oppId>. Customer audience by default. */
export const GET = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { audience } = Q.parse(Object.fromEntries(new URL(req.url).searchParams));
  const plan = await getPlan(id);
  if (!plan) throw new HttpError(404, "No plan for this opportunity");
  const origin = new URL(req.url).origin;
  const pdf = await renderPdf(`${origin}/print/plan/${id}?audience=${audience}`, {
    left: plan.title,
    right: audience === "customer" ? "Mutual action plan" : "Mutual action plan · internal",
  });
  await auditPlanShare(id, audience);
  const name =
    plan.title
      .replace(/[^\w\- ]+/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) || "action-plan";
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${name}-action-plan.pdf"`,
    },
  });
});
