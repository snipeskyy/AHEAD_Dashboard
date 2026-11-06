import { handler, json } from "@/lib/server/http";
import { fixItQueue } from "@/lib/server/territory";

/** The Fix-it queue: most valuable missing fields across real accounts. */
export const GET = handler(async () => json({ items: await fixItQueue() }));
