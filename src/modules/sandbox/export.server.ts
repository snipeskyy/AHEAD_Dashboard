import "server-only";
import type { SectionBuilders } from "@/lib/export/builder-types";

/** Stub: the Data Center Sandbox add-on will contribute scenario views and capacity tables here. */
export const builders: SectionBuilders = {
  "sandbox.views": async () => [
    {
      kind: "callout",
      text: "Data Center Sandbox views will appear here once the add-on is installed.",
      tone: "info",
      field: "screenshots",
    },
  ],
  "sandbox.capacity": async () => [
    {
      kind: "callout",
      text: "Capacity tables will appear here once the add-on is installed.",
      tone: "info",
      field: "capacity",
    },
  ],
};
