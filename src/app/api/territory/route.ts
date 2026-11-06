import { handler, json } from "@/lib/server/http";
import { territory } from "@/lib/server/territory";

export const GET = handler(async () => json(await territory()));
