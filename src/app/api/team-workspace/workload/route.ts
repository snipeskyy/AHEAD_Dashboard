import { handler, json } from "@/lib/server/http";
import { teamWorkload } from "@/lib/server/team-workspace";

/** Open tasks by teammate (unassigned = you), with overdue / due this week / done this week. */
export const GET = handler(async () => json(await teamWorkload()));
