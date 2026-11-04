import "server-only";
import { db } from "@/lib/db";
import { normalizeDomain } from "@/lib/import/normalize";
import { normalizeLegalName } from "@/lib/import/values";

export interface IndexedAccount {
  id: string;
  name: string;
  domain: string | null;
}

/** Looks up existing accounts by domain first, then by normalized legal name. */
export async function buildAccountIndex() {
  const all = await db.account.findMany({ select: { id: true, name: true, domain: true } });
  const byDomain = new Map<string, IndexedAccount>();
  const byName = new Map<string, IndexedAccount>();
  for (const a of all) {
    if (a.domain) byDomain.set(a.domain.toLowerCase(), a);
    const n = normalizeLegalName(a.name);
    if (n && !byName.has(n)) byName.set(n, a);
  }
  return {
    /** Dedupe for account rows: domain match wins over name match. */
    match(name: string, domain: string | null) {
      if (domain && byDomain.has(domain))
        return { account: byDomain.get(domain)!, by: "domain" as const };
      const n = normalizeLegalName(name);
      if (n && byName.has(n)) return { account: byName.get(n)!, by: "name" as const };
      return null;
    },
    /** Child rows reference an account by domain or name. */
    resolve(ref: string): IndexedAccount | null {
      const d = /\./.test(ref) && !/\s/.test(ref.trim()) ? normalizeDomain(ref) : null;
      if (d && byDomain.has(d)) return byDomain.get(d)!;
      return byName.get(normalizeLegalName(ref)) ?? null;
    },
  };
}
export type AccountIndex = Awaited<ReturnType<typeof buildAccountIndex>>;
