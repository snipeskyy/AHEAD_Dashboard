import { NextResponse } from "next/server";
import { z } from "zod";
import { buildPack } from "@/lib/server/packs/export";
import { handler, readJson } from "@/lib/server/http";
import { packFileName } from "@/lib/team/pack-schema";

/** Build a shareable pack and return it as a JSON download. */
export const POST = handler(async (req: Request) => {
  const body = z.object({ accountIds: z.array(z.string()).min(1).max(1000), sections: z.array(z.string()).max(20), title: z.string().max(200).optional() }).parse(await readJson(req));
  const pack = await buildPack(body);
  return new NextResponse(JSON.stringify(pack, null, 2), {
    headers: { "content-type": "application/json", "content-disposition": `attachment; filename="${packFileName(pack.title)}"` },
  });
});
