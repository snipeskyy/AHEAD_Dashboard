import { CONTRACT_VERSION } from "@/lib/contract/schema";
import { handler, json } from "@/lib/server/http";
import { requireApiToken } from "@/lib/server/local-api";

/** Local read-only API index. */
export const GET = handler(async (req: Request) => {
  await requireApiToken(req);
  return json({
    api: "acc-local",
    contract: { format: "acc-data", version: CONTRACT_VERSION },
    readOnly: true,
    staging: "POST /api/v1/staged-imports (review queue only; separate switch)",
    endpoints: [
      "/api/v1/accounts",
      "/api/v1/accounts/{id}",
      "/api/v1/contacts",
      "/api/v1/opportunities",
      "/api/v1/activities",
      "/api/v1/tasks",
      "/api/v1/export",
    ],
  });
});
