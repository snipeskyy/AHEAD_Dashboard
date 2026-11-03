import "server-only";
import { db } from "@/lib/db";
import { DEFAULT_LAYOUTS } from "@/lib/dashboard/layouts";

/** Creates the default layouts the first time (or after all are deleted). */
export async function ensureDefaultLayouts() {
  const count = await db.dashboardLayout.count();
  if (count > 0) return;
  await db.dashboardLayout.createMany({
    data: DEFAULT_LAYOUTS.map((l, i) => ({
      name: l.name,
      widgets: l.widgets,
      isDefault: i === 0,
      sortOrder: i,
    })),
  });
}
