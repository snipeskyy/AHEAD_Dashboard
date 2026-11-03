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
