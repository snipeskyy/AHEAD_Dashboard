import { z } from "zod";
import { deleteComment, updateComment } from "@/lib/server/comments";
import { handler, json, readJson } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { body } = z.object({ body: z.string().trim().min(1).max(4000) }).parse(await readJson(req));
  return json({ comment: await updateComment(id, body) });
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  await deleteComment(id);
  return json({ ok: true });
});
