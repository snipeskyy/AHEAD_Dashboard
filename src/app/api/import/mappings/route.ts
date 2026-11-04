import { db } from "@/lib/db";
import { KindSchema, MappingBody } from "@/lib/import/schemas";
import { handler, HttpError, json, readJson } from "@/lib/server/http";

/** Saved column mappings, reused when a file with the same headers comes back. */
export const GET = handler(async (req: Request) => {
  const kind = KindSchema.parse(new URL(req.url).searchParams.get("kind"));
  const items = await db.importMapping.findMany({
    where: { kind },
    orderBy: { updatedAt: "desc" },
  });
  return json({ items });
});

export const POST = handler(async (req: Request) => {
  const b = MappingBody.parse(await readJson(req));
  const m = await db.importMapping.upsert({
    where: { kind_name: { kind: b.kind, name: b.name } },
    create: b,
    update: { mapping: b.mapping },
  });
  return json(m, { status: 201 });
});

export const DELETE = handler(async (req: Request) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) throw new HttpError(400, "id is required");
  await db.importMapping.deleteMany({ where: { id } });
  return json({ ok: true });
});
