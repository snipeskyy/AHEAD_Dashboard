import "server-only";
import { db } from "@/lib/db";
import { readSetting, writeSetting } from "./store";
import type { SettingKey, SettingValue } from "./schema";

export const getSetting = <K extends SettingKey>(key: K): Promise<SettingValue<K>> =>
  readSetting(db, key);
export const setSetting = <K extends SettingKey>(
  key: K,
  value: unknown,
): Promise<SettingValue<K>> => writeSetting(db, key, value);

/** A module's settings merged over the defaults declared in its settingsSchema. */
export async function getModuleSettings<T extends Record<string, unknown>>(
  moduleId: string,
): Promise<T> {
  const { registry } = await import("@/modules/registry");
  const schema = registry.get(moduleId)?.settingsSchema;
  const stored = (await getSetting("modules.settings"))[moduleId] ?? {};
  if (!schema) return stored as T;
  const parsed = schema.safeParse(stored);
  return (parsed.success ? parsed.data : schema.parse({})) as T;
}
