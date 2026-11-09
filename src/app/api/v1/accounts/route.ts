import { handler, json } from "@/lib/server/http";
import { v1List } from "@/lib/server/local-api";

/** Local read-only API: accounts in the data contract format (?visibility=, ?limit=, ?offset=). */
export const GET = handler(async (req: Request) => json(await v1List(req, "accounts")));
