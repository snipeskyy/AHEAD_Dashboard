import { handler, json } from "@/lib/server/http";
import { accountPartners, partnerOverview } from "@/lib/server/partners";

/** Co-sell overview by partner company, or ?accountId= for one account's engaged reps. */
export const GET = handler(async (req: Request) => {
  const accountId = new URL(req.url).searchParams.get("accountId");
  return json(accountId ? await accountPartners(accountId) : { items: await partnerOverview() });
});
