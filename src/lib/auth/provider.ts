import { LOCAL_TEAM_ID, LOCAL_USER_ID } from "./actor";

/** The signed-in user as the app sees it. Never carries contact details. */
export interface SessionUser {
  id: string;
  displayName: string;
  title: string | null;
  role: string;
  teamId: string;
}

/**
 * Auth abstraction (Phase 8). Single-user local mode today; an SSO provider (OIDC/SAML via the company IdP)
 * plugs in here later without touching callers. See docs/TEAM_DEPLOYMENT.md.
 */
export interface AuthProvider {
  id: "local" | "sso";
  label: string;
  /** Resolve the user for a request. Local mode ignores the request. */
  currentUser(req?: Request): Promise<SessionUser>;
  /** Whether a sign-in screen is needed (false in local mode). */
  requiresSignIn: boolean;
}

export class AuthNotConfiguredError extends Error {
  constructor(what: string) {
    super(`${what} is not configured. Hosted multi-user mode waits for company approval (docs/TEAM_DEPLOYMENT.md).`);
    this.name = "AuthNotConfiguredError";
  }
}

export const LOCAL_FALLBACK: SessionUser = { id: LOCAL_USER_ID, displayName: "Me", title: null, role: "associate-client-director", teamId: LOCAL_TEAM_ID };
