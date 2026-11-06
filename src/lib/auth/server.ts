import "server-only";
import { z } from "zod";
import { DEFAULT_ROLE, ROLE_IDS } from "@/config/roles";
import { db } from "@/lib/db";
import { LOCAL_TEAM_ID, LOCAL_USER_ID } from "./actor";
import { AuthNotConfiguredError, type AuthProvider, type SessionUser } from "./provider";

/** Creates the local profile and team on first use. */
export async function ensureLocalUser() {
  await db.team.upsert({ where: { id: LOCAL_TEAM_ID }, create: { id: LOCAL_TEAM_ID, name: "My team" }, update: {} });
  return db.user.upsert({
    where: { id: LOCAL_USER_ID },
    create: { id: LOCAL_USER_ID, displayName: "Me", role: DEFAULT_ROLE, teamId: LOCAL_TEAM_ID, isSelf: true },
    update: {},
  });
}

const toSession = (u: { id: string; displayName: string; title: string | null; role: string; teamId: string }): SessionUser => ({
  id: u.id, displayName: u.displayName, title: u.title, role: u.role, teamId: u.teamId,
});

export const localAuthProvider: AuthProvider = {
  id: "local",
  label: "Local (single user)",
  requiresSignIn: false,
  currentUser: async () => toSession(await ensureLocalUser()),
};

/** Placeholder for the hosted version: deliberately not implemented. */
export const ssoAuthProvider: AuthProvider = {
  id: "sso",
  label: "Company SSO (not configured)",
  requiresSignIn: true,
  currentUser: async () => {
    throw new AuthNotConfiguredError("SSO");
  },
};

/** `ACC_AUTH=sso` selects the SSO slot (which throws until configured); anything else is local. */
export const getAuthProvider = (): AuthProvider => (process.env.ACC_AUTH === "sso" ? ssoAuthProvider : localAuthProvider);
export const currentUser = (req?: Request) => getAuthProvider().currentUser(req);

export const ProfileBody = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  title: z.string().trim().max(120).nullish(),
  role: z.enum(ROLE_IDS).optional(),
});
export const TeammateBody = z.object({
  displayName: z.string().trim().min(1).max(80),
  title: z.string().trim().max(120).nullish(),
  role: z.enum(ROLE_IDS).default(DEFAULT_ROLE),
});

export async function teamOverview() {
  const me = await ensureLocalUser();
  const [team, users] = await Promise.all([
    db.team.findUnique({ where: { id: me.teamId } }),
    db.user.findMany({ orderBy: [{ isSelf: "desc" }, { displayName: "asc" }] }),
  ]);
  return { team, users };
}
