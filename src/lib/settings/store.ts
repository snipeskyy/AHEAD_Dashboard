import type { PrismaClient } from "@prisma/client";
import { SETTINGS, type SettingKey, type SettingValue } from "./schema";

/** DB-agnostic helpers (usable from Next, the worker, and the seed script). */
export async function readSetting<K extends SettingKey>(
  db: PrismaClient,
  key: K,
): Promise<SettingValue<K>> {
  const row = await db.setting.findUnique({ where: { key } });
  const def = SETTINGS[key];
  if (!row) return def.defaults as SettingValue<K>;
  const parsed = def.schema.safeParse(row.value);
  return (parsed.success ? parsed.data : def.defaults) as SettingValue<K>;
}

export async function writeSetting<K extends SettingKey>(
  db: PrismaClient,
  key: K,
  value: unknown,
): Promise<SettingValue<K>> {
  const parsed = SETTINGS[key].schema.parse(value) as SettingValue<K>;
  const json = parsed as unknown as object;
  await db.setting.upsert({
    where: { key },
    create: { key, value: json },
    update: { value: json },
  });
  return parsed;
}
