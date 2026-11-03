"use client";
import { useMemo } from "react";
import { registry } from "@/modules/registry";
import { useSetting } from "./use-setting";

/** A module's settings with defaults from its settingsSchema applied (memoized). */
export function useModuleSettings<T extends Record<string, unknown>>(moduleId: string): T {
  const { data } = useSetting("modules.settings");
  const stored = data?.[moduleId];
  return useMemo(() => {
    const schema = registry.get(moduleId)?.settingsSchema;
    if (!schema) return (stored ?? {}) as T;
    const parsed = schema.safeParse(stored ?? {});
    return (parsed.success ? parsed.data : schema.parse({})) as T;
  }, [moduleId, stored]);
}
