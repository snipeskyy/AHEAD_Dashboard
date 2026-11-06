import { NextResponse } from "next/server";
import { exportPlays } from "@/lib/server/packs/plays";
import { handler } from "@/lib/server/http";

export const GET = handler(async (req: Request) => {
  const ids = new URL(req.url).searchParams.get("ids")?.split(",").filter(Boolean);
  const pack = await exportPlays(ids);
  return new NextResponse(JSON.stringify(pack, null, 2), {
    headers: { "content-type": "application/json", "content-disposition": `attachment; filename="acc-plays-${pack.createdAt.slice(0, 10)}.json"` },
  });
});
