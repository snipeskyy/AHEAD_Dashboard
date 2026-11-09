import { CONTRACT_EXAMPLE } from "@/lib/contract/example";
import { handler } from "@/lib/server/http";

/** A fictional example file showing every entity type. */
export const GET = handler(
  async () =>
    new Response(JSON.stringify(CONTRACT_EXAMPLE, null, 2), {
      headers: {
        "content-type": "application/json",
        "content-disposition": 'attachment; filename="example.acc-data.json"',
      },
    }),
);
