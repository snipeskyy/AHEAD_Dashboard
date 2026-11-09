import { handler, json } from "@/lib/server/http";
import { stageContract } from "@/lib/server/contract/staging";
import { readStagingRequest } from "@/lib/server/local-api";

/**
 * Phase 15: a tool holding the API token (e.g. a Glean action) sends an acc-data file. It is only STAGED: a person
 * reviews and applies it in Settings → Data contract & API. Off unless the API and staging are both turned on.
 */
export const POST = handler(async (req: Request) => {
  const raw = await readStagingRequest(req);
  const name = req.headers.get("x-acc-file-name")?.slice(0, 120) ?? null;
  const r = await stageContract(raw, "api", name);
  return json(
    {
      ...r,
      status: "pending-review",
      review: "Settings → Data contract & API → Waiting for review",
    },
    { status: 202 },
  );
});
