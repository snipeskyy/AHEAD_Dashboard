/**
 * Spec §2 / §11: never invent facts about real companies. Intelligence on a non-demo account
 * must either cite a public source URL or be explicitly marked as a user-entered hypothesis.
 */
export function intelPolicyViolation(
  account: { isDemo: boolean },
  item: { source: string; sourceUrl?: string | null },
): string | null {
  if (account.isDemo) return null;
  if (item.source === "seed")
    return "Seed (synthetic) intelligence cannot be attached to a real account";
  if (item.source === "user-hypothesis") return null;
  if (!item.sourceUrl || !/^https?:\/\//i.test(item.sourceUrl))
    return "Intelligence on a real account must link to its public source or be marked as a user hypothesis";
  return null;
}
