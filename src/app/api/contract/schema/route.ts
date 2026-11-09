import { contractJsonSchema } from "@/lib/contract/schema";
import { handler } from "@/lib/server/http";

/** The ACC Data Contract v1 JSON Schema (same as docs/contract/acc-data-v1.schema.json). */
export const GET = handler(
  async () =>
    new Response(JSON.stringify(contractJsonSchema(), null, 2), {
      headers: {
        "content-type": "application/schema+json",
        "content-disposition": 'attachment; filename="acc-data-v1.schema.json"',
      },
    }),
);
