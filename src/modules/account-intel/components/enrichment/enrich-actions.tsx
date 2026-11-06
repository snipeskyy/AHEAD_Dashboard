"use client";
import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAccountEnrichment, useEnqueue } from "../../hooks/use-enrichment";
import { IdentityDialog } from "./identity-dialog";

/** Account 360 header: "Fetch public data" (queues all enabled sources, ignoring TTL) + identity resolution. */
export function EnrichActions({
  accountId,
  accountName,
  isDemo,
}: {
  accountId: string;
  accountName: string;
  isDemo: boolean;
}) {
  const router = useRouter();
  const { data } = useAccountEnrichment(accountId);
  const enqueue = useEnqueue();
  if (isDemo) return null;
  const busy = data?.status === "queued" || data?.status === "running";
  return (
    <>
      <IdentityDialog
        accountId={accountId}
        accountName={accountName}
        identity={data?.identity ?? null}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={busy || enqueue.isPending}
        onClick={() =>
          enqueue.mutate(
            { accountIds: [accountId] },
            {
              onSuccess: () =>
                router.replace(`/accounts/${accountId}?tab=profile`, { scroll: false }),
            },
          )
        }
      >
        {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
        {busy ? (data?.status === "queued" ? "Queued…" : "Fetching…") : "Fetch public data"}
      </Button>
    </>
  );
}
