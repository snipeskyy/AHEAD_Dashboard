import { z } from "zod";
import { CommentBody, createComment, listComments } from "@/lib/server/comments";
import { handler, json, readJson } from "@/lib/server/http";

export const GET = handler(async (req: Request) => {
  const p = new URL(req.url).searchParams;
  const q = z.object({ entityType: z.enum(["account", "opportunity"]), entityId: z.string().min(1) }).parse({ entityType: p.get("entityType"), entityId: p.get("entityId") });
  return json({ items: await listComments(q.entityType, q.entityId) });
});

export const POST = handler(async (req: Request) => json({ comment: await createComment(CommentBody.parse(await readJson(req))) }, { status: 201 }));
