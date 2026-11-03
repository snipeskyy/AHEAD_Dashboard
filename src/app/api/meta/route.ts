import { db } from "@/lib/db";
import { handler, json } from "@/lib/server/http";

/** Workspace metadata for the shell: demo-data presence, counts, data freshness. */
export const GET = handler(async () => {
  const [demoAccounts, realAccounts, opportunities, signals, unread] = await Promise.all([
    db.account.count({ where: { isDemo: true } }),
    db.account.count({ where: { isDemo: false } }),
    db.opportunity.count(),
    db.signal.count(),
    db.notification.count({ where: { read: false } }),
  ]);
  return json({
    demo: demoAccounts > 0,
    counts: { demoAccounts, realAccounts, opportunities, signals },
    unreadNotifications: unread,
  });
});
