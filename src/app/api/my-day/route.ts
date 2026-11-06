import { handler, json } from "@/lib/server/http";
import { myDay } from "@/lib/server/my-day";

export const GET = handler(async () => json(await myDay()));
