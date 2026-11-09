import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/db-extensions";
import type { Contract } from "@/lib/contract/schema";
import { getSetting, setSetting } from "@/lib/settings/server";
import { exportContract } from "./contract/export";
import { HttpError } from "./http";

/**
 * Local read-only API (Phase 13): `/api/v1/*`, GET only, off by default, Bearer-token protected.
 * Writing stays file-based (contract import with preview and undo). No CORS headers are sent, so other
 * web origins can't read responses from a browser.
 */
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export async function localApiStatus() {
  const s = await getSetting("api.local");
  return {
    enabled: s.enabled,
    hasToken: !!s.tokenHash,
    tokenHint: s.tokenHint,
    createdAt: s.createdAt,
  };
}

export async function setLocalApiEnabled(enabled: boolean) {
  const s = await getSetting("api.local");
  await setSetting("api.local", { ...s, enabled });
  await audit(db, {
    action: enabled ? "api.enable" : "api.disable",
    entityType: "setting",
    entityId: "api.local",
    summary: `Local read-only API turned ${enabled ? "on" : "off"}`,
  });
  return localApiStatus();
}

/** Creates a new token (replacing any old one). The plain token is returned once and never stored. */
export async function generateToken() {
  const token = `acc_${randomBytes(32).toString("base64url")}`;
  const s = await getSetting("api.local");
  await setSetting("api.local", {
    ...s,
    tokenHash: sha(token),
    tokenHint: token.slice(-4),
    createdAt: new Date().toISOString(),
  });
  await audit(db, {
    action: "api.token",
    entityType: "setting",
    entityId: "api.local",
    summary: "Generated a new local API token (previous token revoked)",
  });
  return { token, status: await localApiStatus() };
}

export async function revokeToken() {
  const s = await getSetting("api.local");
  await setSetting("api.local", { ...s, tokenHash: null, tokenHint: null, createdAt: null });
  await audit(db, {
    action: "api.revoke",
    entityType: "setting",
    entityId: "api.local",
    summary: "Revoked the local API token",
  });
  return localApiStatus();
}

/** Settings changes must come from the app's own pages (blocks cross-site form posts from other origins). */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host || new URL(origin).host !== host)
    throw new HttpError(403, "Cross-origin request refused");
}

/** 403 when the API is off, 401 without a valid `Authorization: Bearer <token>`. */
export async function requireApiToken(req: Request) {
  const s = await getSetting("api.local");
  if (!s.enabled)
    throw new HttpError(403, "The local API is off. Turn it on in Settings → Data contract & API.");
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "");
  if (!m || !s.tokenHash) throw new HttpError(401, "Missing or invalid API token");
  const a = Buffer.from(sha(m[1]), "hex");
  const b = Buffer.from(s.tokenHash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b))
    throw new HttpError(401, "Missing or invalid API token");
}

const Query = z.object({
  visibility: z.enum(["internal", "customer-safe"]).default("internal"),
  account: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(5000).default(500),
  offset: z.coerce.number().int().min(0).default(0),
});

/** Shared body of the v1 list routes: authenticate, export (role + visibility redaction), page one entity. */
export async function v1List(req: Request, key: keyof Contract["entities"]) {
  await requireApiToken(req);
  const q = Query.parse(Object.fromEntries(new URL(req.url).searchParams));
  const c = await exportContract({
    visibility: q.visibility,
    accountIds: q.account ? [q.account] : undefined,
    quiet: true,
  });
  const all = c.entities[key] as unknown[];
  return {
    format: c.format,
    version: c.version,
    visibility: c.visibility,
    total: all.length,
    offset: q.offset,
    limit: q.limit,
    items: all.slice(q.offset, q.offset + q.limit),
  };
}

/** One account with its related records (a read model for an assistant or another tool). */
export async function v1Account(req: Request, id: string) {
  await requireApiToken(req);
  const q = Query.parse(Object.fromEntries(new URL(req.url).searchParams));
  const c = await exportContract({ visibility: q.visibility, accountIds: [id], quiet: true });
  const account = c.entities.accounts[0];
  if (!account) throw new HttpError(404, "Account not found");
  const { accounts: _a, ...related } = c.entities;
  return { format: c.format, version: c.version, visibility: c.visibility, account, ...related };
}
