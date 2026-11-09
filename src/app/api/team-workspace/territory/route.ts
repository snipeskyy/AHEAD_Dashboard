import { handler, json } from "@/lib/server/http";
import { territoryPlan } from "@/lib/server/team-workspace";

/** Shared territory plan: open account plan items and every mutual action plan with its health. */
export const GET = handler(async () => json(await territoryPlan()));
