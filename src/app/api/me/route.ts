import { exportHiddenFor, roleById } from "@/config/roles";
import { currentUser, ensureLocalUser, getAuthProvider, ProfileBody } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { handler, json, readJson } from "@/lib/server/http";

export const GET = handler(async (req: Request) => {
  const user = await currentUser(req);
  const role = roleById(user.role);
  return json({ user, role: { id: role.id, label: role.label, hidden: role.hidden, exportHidden: exportHiddenFor(role.id) }, auth: { id: getAuthProvider().id, label: getAuthProvider().label } });
});

export const PATCH = handler(async (req: Request) => {
  const body = ProfileBody.parse(await readJson(req));
  const me = await ensureLocalUser();
  const user = await db.user.update({ where: { id: me.id }, data: body });
  return json({ user });
});
