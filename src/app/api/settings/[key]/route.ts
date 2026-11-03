import { isSettingKey } from "@/lib/settings/schema";
import { getSetting, setSetting } from "@/lib/settings/server";
import { HttpError, handler, json, readJson } from "@/lib/server/http";
import { logActivity } from "@/lib/server/activity";

type Ctx = { params: Promise<{ key: string }> };

async function keyFrom(ctx: Ctx) {
  const { key } = await ctx.params;
  if (!isSettingKey(key)) throw new HttpError(404, `Unknown setting "${key}"`);
  return key;
}

export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const key = await keyFrom(ctx);
  return json({ key, value: await getSetting(key) });
});

export const PUT = handler(async (req: Request, ctx: Ctx) => {
  const key = await keyFrom(ctx);
  const body = (await readJson(req)) as { value?: unknown };
  const value = await setSetting(key, body.value);
  if (key !== "ui.lastSeenAt") {
    await logActivity({
      entityType: "setting",
      entityId: key,
      action: "setting.updated",
      summary: `Updated setting ${key}`,
    });
  }
  return json({ key, value });
});
