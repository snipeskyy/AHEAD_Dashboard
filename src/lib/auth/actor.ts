import { AsyncLocalStorage } from "node:async_hooks";

/**
 * The user a write is attributed to. Single-user mode: always the local profile ("local").
 * The worker runs as "system". A future multi-user AuthProvider wraps each request in `runAs()`.
 */
export interface Actor {
  id: string;
  teamId: string;
}

export const LOCAL_USER_ID = "local";
export const LOCAL_TEAM_ID = "local-team";
export const SYSTEM_ACTOR: Actor = { id: "system", teamId: LOCAL_TEAM_ID };

const store = new AsyncLocalStorage<Actor>();
let fallback: Actor = { id: LOCAL_USER_ID, teamId: LOCAL_TEAM_ID };

export const currentActor = (): Actor => store.getStore() ?? fallback;
export const runAs = <T>(actor: Actor, fn: () => T): T => store.run(actor, fn);
/** Process-wide default (the worker sets SYSTEM_ACTOR at start-up). */
export const setDefaultActor = (a: Actor) => {
  fallback = a;
};
