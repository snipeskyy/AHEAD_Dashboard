import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/** Append to the ActivityLog that powers "What changed since you last looked". */
export function logActivity(entry: {
  entityType: string;
  entityId: string;
  action: string;
  summary: string;
  diff?: Prisma.InputJsonValue;
}) {
  return db.activityLog.create({ data: entry });
}
