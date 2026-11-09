import { CreateCaseBody, createCase, listCases } from "@/lib/server/business-cases";
import { handler, json, readJson } from "@/lib/server/http";

export const GET = handler(async (req: Request) => {
  const p = new URL(req.url).searchParams;
  return json({ items: await listCases({ accountId: p.get("accountId"), opportunityId: p.get("opportunityId") }) });
});

export const POST = handler(async (req: Request) => json(await createCase(CreateCaseBody.parse(await readJson(req))), { status: 201 }));
