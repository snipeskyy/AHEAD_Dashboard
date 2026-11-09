import { getVersion } from "@/lib/server/business-cases";
import { handler, json } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string; version: string }> };

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const { id, version } = await params;
  return json(await getVersion(id, Number(version)));
});
