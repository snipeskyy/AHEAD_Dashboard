import { setSetting } from "@/lib/settings/server";
import { handler, json } from "@/lib/server/http";

/** "Mark all seen": signals after this moment rank first on My Day. */
export const POST = handler(async () => json({ lastSeenAt: await setSetting("myDay.lastSeenAt", new Date().toISOString()) }));
