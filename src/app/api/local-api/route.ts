import { z } from "zod";
import { handler, json, readJson } from "@/lib/server/http";
import {
  assertSameOrigin,
  generateToken,
  localApiStatus,
  revokeToken,
  setLocalApiEnabled,
} from "@/lib/server/local-api";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("enable") }),
  z.object({ action: z.literal("disable") }),
  z.object({ action: z.literal("generate-token") }),
  z.object({ action: z.literal("revoke-token") }),
]);

/** Status of the local read-only API (never the token or its hash). */
export const GET = handler(async () => json(await localApiStatus()));

/** Turn the API on/off, or generate (shown once) / revoke the token. */
export const POST = handler(async (req: Request) => {
  assertSameOrigin(req);
  const b = Body.parse(await readJson(req));
  if (b.action === "enable") return json({ status: await setLocalApiEnabled(true) });
  if (b.action === "disable") return json({ status: await setLocalApiEnabled(false) });
  if (b.action === "revoke-token") return json({ status: await revokeToken() });
  return json(await generateToken());
});
