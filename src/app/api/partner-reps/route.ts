import { db } from "@/lib/db";
import { logActivity } from "@/lib/server/activity";
import { handler, json, readJson } from "@/lib/server/http";
import { RepBody } from "@/lib/server/partners";

export const GET = handler(async () =>
  json({ items: await db.partnerRep.findMany({ orderBy: [{ partnerCompany: "asc" }, { name: "asc" }], select: { id: true, name: true, partnerCompany: true, title: true } }) }),
);

export const POST = handler(async (req: Request) => {
  const { accountIds, ...b } = RepBody.parse(await readJson(req));
  const r = await db.partnerRep.create({ data: { ...b, accounts: { create: (accountIds ?? []).map((accountId) => ({ accountId })) } } });
  await logActivity({ entityType: "partner-rep", entityId: r.id, action: "partner-rep.created", summary: `Partner rep ${r.name} (${r.partnerCompany})` });
  return json(r, { status: 201 });
});
