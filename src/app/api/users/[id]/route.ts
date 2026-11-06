import { ProfileBody } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { HttpError, handler, json, readJson } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  return json({ user: await db.user.update({ where: { id }, data: ProfileBody.parse(await readJson(req)) }) });
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const u = await db.user.findUnique({ where: { id } });
  if (!u) throw new HttpError(404, "Not found");
  if (u.isSelf) throw new HttpError(400, "You can't remove your own profile");
  await db.user.delete({ where: { id } });
  return json({ ok: true });
});
