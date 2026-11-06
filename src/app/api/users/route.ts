import { TeammateBody, teamOverview } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { handler, json, readJson } from "@/lib/server/http";

/** Local team list: your profile plus teammates you added by name (for @mentions and ownership). */
export const GET = handler(async () => json(await teamOverview()));

export const POST = handler(async (req: Request) => {
  const body = TeammateBody.parse(await readJson(req));
  return json({ user: await db.user.create({ data: { ...body, isSelf: false } }) }, { status: 201 });
});
