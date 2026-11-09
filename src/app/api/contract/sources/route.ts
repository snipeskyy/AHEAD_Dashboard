import { handler, json } from "@/lib/server/http";
import { sourcesOverview } from "@/lib/server/contract/staging";

/** Systems that have sent data (e.g. glean), with imports, linked records and pending files. */
export const GET = handler(async () => json({ items: await sourcesOverview() }));
