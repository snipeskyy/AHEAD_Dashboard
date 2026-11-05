import { SOURCE_CATALOG } from "@/lib/adapters/catalog";
import { computeCoverage, runnableCount } from "@/lib/adapters/coverage";
import { SIGNAL_ADAPTERS } from "@/lib/adapters";
import type { AccountSourceConfig } from "@/lib/adapters/types";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings/server";
import { handler, json } from "@/lib/server/http";

/** Per-source health for Settings → Data sources. Never returns secret values, only whether they are set. */
export const GET = handler(async () => {
  const [enabled, interval] = await Promise.all([
    getSetting("sources.enabled"),
    getSetting("scheduler.intervalMinutes"),
  ]);
  const runs = await Promise.all(
    SOURCE_CATALOG.map((s) =>
      db.sourceRun.findFirst({ where: { adapterId: s.id }, orderBy: { startedAt: "desc" } }),
    ),
  );
  const env = {
    SEC_USER_AGENT: Boolean(process.env.SEC_USER_AGENT?.trim()),
    PUBLIC_FETCH_ENABLED: process.env.PUBLIC_FETCH_ENABLED !== "false",
  };
  const accounts = await db.account.findMany({
    select: {
      id: true,
      name: true,
      domain: true,
      ticker: true,
      cik: true,
      isDemo: true,
      tier: true,
      sourceConfig: true,
    },
  });
  const coverage = computeCoverage({
    adapters: SIGNAL_ADAPTERS,
    accounts: accounts.map((a) => ({
      ...a,
      sourceConfig: (a.sourceConfig ?? {}) as AccountSourceConfig,
    })),
    enabled,
    env: { secUserAgent: env.SEC_USER_AGENT, publicFetch: env.PUBLIC_FETCH_ENABLED },
  });
  const pending = await db.jobRequest.count({
    where: { kind: "fetch-now", status: { in: ["pending", "running"] } },
  });
  return json({
    fetching: pending > 0,
    intervalMinutes: interval,
    publicFetchEnabled: env.PUBLIC_FETCH_ENABLED,
    coverage,
    runnable: runnableCount(coverage),
    sources: SOURCE_CATALOG.map((s, i) => {
      const missing = s.requires && !env[s.requires as keyof typeof env] ? s.requires : null;
      const lastRun = runs[i];
      return {
        ...s,
        enabled: s.kind === "private-future" ? false : (enabled[s.id] ?? s.defaultEnabled),
        missingConfig: missing,
        status:
          s.kind === "private-future"
            ? "not-configured"
            : s.kind === "manual"
              ? "available"
              : missing
                ? "needs-config"
                : !lastRun
                  ? "idle"
                  : lastRun.ok
                    ? "healthy"
                    : "error",
        lastRun: lastRun
          ? {
              startedAt: lastRun.startedAt,
              ok: lastRun.ok,
              itemsNew: lastRun.itemsNew,
              error: lastRun.error,
            }
          : null,
      };
    }),
  });
});
