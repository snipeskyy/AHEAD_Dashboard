"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { Candidate } from "@/lib/enrich/identity";
import type { EnrichStatus } from "@/lib/enrich/status";

export interface OverviewRow {
  accountId: string;
  status: EnrichStatus;
  completeness: number;
  pending: number;
  topMissing: string[];
}

export interface FieldRow {
  id: string;
  field: string;
  value: unknown;
  source: string;
  sourceUrl: string | null;
  confidence: string;
  fetchedAt: string | null;
  locked: boolean;
  updatedAt: string;
}
export interface Proposal {
  id: string;
  field: string;
  value: unknown;
  enricherId: string;
  source: string;
  sourceUrl: string;
  confidence: "high" | "medium" | "low";
  evidenceSnippet: string | null;
  fetchedAt: string;
}
export interface AccountEnrichment {
  identity: {
    cik: string | null;
    ticker: string | null;
    lei: string | null;
    wikidataId: string | null;
    domain: string | null;
    legalName: string | null;
    jobBoard: { provider: string; slug: string } | null;
  } | null;
  identityConfirmedAt: string | null;
  fields: FieldRow[];
  proposals: Proposal[];
  financials: Array<{
    metric: "revenue" | "netIncome" | "capex";
    fiscalYear: number;
    periodEnd: string;
    value: number;
    sourceUrl: string;
  }>;
  relations: Array<{
    id: string;
    relation: string;
    name: string;
    lei: string | null;
    wikidataId: string | null;
    country: string | null;
    source: string;
    sourceUrl: string;
    linkedAccountId: string | null;
  }>;
  hiringHistory: Array<{
    at: string;
    value: { total: number; byFunction: Record<string, number>; asOf: string };
  }>;
  job: { status: string; error: string | null } | null;
  status: EnrichStatus;
  completeness: number;
  missing: Array<{ id: string; label: string; weight: number; manual: boolean; prompt?: string }>;
  enrichers: Array<{
    id: string;
    label: string;
    source: string;
    optional: boolean;
    enabled: boolean;
    blocked: string | null;
    ttlDays: number;
    lastRun: {
      ok: boolean;
      finishedAt: string | null;
      error: string | null;
      proposals: number;
    } | null;
  }>;
}

export const useEnrichmentOverview = () =>
  useQuery({
    queryKey: ["enrichment", "overview"],
    queryFn: () => api<{ items: OverviewRow[] }>("/api/enrichment/overview").then((r) => r.items),
    refetchInterval: 10_000,
  });

export const useAccountEnrichment = (id: string) =>
  useQuery({
    queryKey: ["enrichment", "account", id],
    queryFn: () => api<AccountEnrichment>(`/api/accounts/${id}/enrichment`),
    refetchInterval: (q) =>
      q.state.data && ["queued", "running"].includes(q.state.data.status) ? 3000 : false,
  });

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["enrichment"] });
    qc.invalidateQueries({ queryKey: ["accounts"] });
    qc.invalidateQueries({ queryKey: ["account"] });
  };
}

/** Queue "Fetch public data" for some/all accounts. */
export function useEnqueue() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (b: { accountIds?: string[]; all?: boolean; force?: boolean }) =>
      api<{ queued: number; alreadyQueued: number }>("/api/enrichment/queue", {
        method: "POST",
        json: { action: "enqueue", force: true, ...b },
      }),
    onSuccess: (r) => {
      toast.success(
        r.queued
          ? `Queued ${r.queued} account${r.queued === 1 ? "" : "s"} for enrichment`
          : "Already queued",
        {
          description: r.alreadyQueued
            ? `${r.alreadyQueued} already in the queue`
            : "Public sources run in the background; results appear for review.",
        },
      );
      inv();
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useDecideProposals(accountId: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (b: { action: "accept" | "reject"; ids?: string[]; section?: string }) =>
      api<{ accepted?: number; rejected?: number }>(`/api/accounts/${accountId}/proposals`, {
        method: "POST",
        json: b,
      }),
    onSuccess: (r) => {
      if ((r.accepted ?? 0) + (r.rejected ?? 0) > 1)
        toast.success(r.accepted ? `Accepted ${r.accepted}` : `Rejected ${r.rejected}`);
      inv();
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useSetField(accountId: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (b: { field: string; value?: unknown; locked?: boolean }) =>
      api(`/api/accounts/${accountId}/fields`, { method: "PUT", json: b }),
    onSuccess: inv,
    onError: (e) => toast.error(e.message),
  });
}

export const useIdentityCandidates = (accountId: string, enabled: boolean) =>
  useQuery({
    queryKey: ["enrichment", "identity", accountId],
    queryFn: () =>
      api<{ candidates: Candidate[]; defaultKey: string | null; notes: string[] }>(
        `/api/accounts/${accountId}/identity`,
      ),
    enabled,
    staleTime: 5 * 60_000,
  });

export function useConfirmIdentity(accountId: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (ids: Record<string, string | null | undefined>) =>
      api(`/api/accounts/${accountId}/identity`, { method: "POST", json: ids }),
    onSuccess: () => {
      toast.success("Identity confirmed", {
        description: "Public data is being fetched for this account.",
      });
      inv();
    },
    onError: (e) => toast.error(e.message),
  });
}
