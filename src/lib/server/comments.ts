import "server-only";
import { z } from "zod";
import { currentActor } from "@/lib/auth/actor";
import { ensureLocalUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { findMentions } from "@/lib/team/mentions";
import { HttpError } from "./http";

export const CommentBody = z.object({
  entityType: z.enum(["account", "opportunity"]),
  entityId: z.string().min(1),
  body: z.string().trim().min(1).max(4000),
  parentId: z.string().nullish(),
});

async function resolveAccount(entityType: string, entityId: string) {
  if (entityType === "account") {
    const a = await db.account.findUnique({ where: { id: entityId }, select: { id: true, name: true } });
    if (!a) throw new HttpError(404, "Account not found");
    return { accountId: a.id, label: a.name, href: `/accounts/${a.id}?tab=overview#comments` };
  }
  const o = await db.opportunity.findUnique({ where: { id: entityId }, select: { id: true, name: true, accountId: true } });
  if (!o) throw new HttpError(404, "Opportunity not found");
  return { accountId: o.accountId, label: o.name, href: `/opportunities?focus=${o.id}` };
}

export async function listComments(entityType: string, entityId: string) {
  const [rows, users] = await Promise.all([
    db.comment.findMany({ where: { entityType, entityId }, orderBy: { createdAt: "asc" } }),
    db.user.findMany({ select: { id: true, displayName: true } }),
  ]);
  const names = new Map(users.map((u) => [u.id, u.displayName]));
  return rows.map((c) => ({
    ...c,
    authorName: names.get(c.authorId) ?? c.authorName ?? "Unknown",
    mentionNames: (c.mentions as string[]).map((id) => names.get(id)).filter(Boolean) as string[],
  }));
}

/** Notify the local user when a comment mentions them (e.g. a teammate's comment arriving in a pack). */
export async function notifyMentions(mentions: string[], who: string, target: { label: string; href: string }) {
  const me = await ensureLocalUser();
  if (!mentions.includes(me.id)) return;
  await db.notification.create({ data: { kind: "mention", title: `${who} mentioned you on ${target.label}`, href: target.href } });
}

export async function createComment(input: z.infer<typeof CommentBody>) {
  const me = await ensureLocalUser();
  const target = await resolveAccount(input.entityType, input.entityId);
  const users = await db.user.findMany({ select: { id: true, displayName: true } });
  const mentions = findMentions(input.body, users);
  const actor = currentActor();
  const c = await db.comment.create({
    data: { ...input, parentId: input.parentId ?? null, accountId: target.accountId, mentions, authorId: actor.id, authorName: actor.id === me.id ? me.displayName : null },
  });
  // Mentions of yourself (rare) don't notify; mentions of teammates are stored for when the workspace is shared.
  if (actor.id !== me.id) await notifyMentions(mentions, c.authorName ?? "A teammate", target);
  return c;
}

export async function updateComment(id: string, body: string) {
  const c = await db.comment.findUnique({ where: { id } });
  if (!c) throw new HttpError(404, "Comment not found");
  if (c.authorId !== currentActor().id) throw new HttpError(403, "You can only edit your own comments");
  const users = await db.user.findMany({ select: { id: true, displayName: true } });
  return db.comment.update({ where: { id }, data: { body, mentions: findMentions(body, users), editedAt: new Date() } });
}

export async function deleteComment(id: string) {
  const c = await db.comment.findUnique({ where: { id } });
  if (!c) throw new HttpError(404, "Comment not found");
  if (c.authorId !== currentActor().id) throw new HttpError(403, "You can only delete your own comments");
  await db.comment.deleteMany({ where: { OR: [{ id }, { parentId: id }] } });
}
