"use client";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  Lightbulb,
  Play as PlayIcon,
  Radio,
  Target,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AccountPicker } from "@/components/account-picker";
import { CardSkeleton, EmptyState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { practiceLabel } from "@/config/practice-areas";
import { api } from "@/lib/api-client";
import type { Reason } from "@/lib/demand-gen/recommender";
import { cn } from "@/lib/utils";
import type { Play, Recommendation } from "../hooks/use-demand-gen";
import { LaunchPlayDialog } from "./launch-play-dialog";

const REASON_ICON: Record<Reason["kind"], typeof Target> = {
  whitespace: Target,
  initiative: Lightbulb,
  signal: Radio,
  committee: Users,
  penalty: AlertTriangle,
};

/** Explainable play recommendations: per account, or the top pick across the portfolio. */
export function RecommenderView({
  initialAccount,
  highlightPractice,
}: {
  initialAccount: { id: string; name: string } | null;
  highlightPractice: string | null;
}) {
  const [account, setAccount] = useState(initialAccount);
  const [launch, setLaunch] = useState<{
    play: Play;
    account: { id: string; name: string };
  } | null>(null);
  const one = useQuery({
    queryKey: ["recommend", account?.id],
    queryFn: () =>
      api<{ account: { id: string; name: string }; items: Recommendation[] }>(
        `/api/plays/recommend?accountId=${account!.id}&max=6`,
      ),
    enabled: !!account,
  });
  const portfolio = useQuery({
    queryKey: ["recommend", "portfolio"],
    queryFn: () =>
      api<{
        items: Array<{ account: { id: string; name: string; tier: string }; top: Recommendation }>;
      }>("/api/plays/recommend-portfolio"),
    enabled: !account,
  });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-72">
          <AccountPicker value={account} onChange={setAccount} />
        </div>
        <p className="text-muted-foreground text-xs">
          {account
            ? "Ranked from whitespace, initiatives, recent signals and buying-committee gaps."
            : "Pick an account, or review the top play for each priority account below."}
        </p>
      </div>
      {account ? (
        one.isLoading ? (
          <CardSkeleton lines={6} />
        ) : !one.data?.items.length ? (
          <EmptyState
            icon={Lightbulb}
            title="No strong recommendation"
            description="This account has little whitespace or evidence right now. Add initiatives or wait for new signals."
          />
        ) : (
          <ol className="grid gap-3">
            {one.data.items.map((r, i) => (
              <li
                key={r.play.id}
                className={cn(
                  "bg-card rounded-lg border p-4",
                  highlightPractice &&
                    r.play.practiceArea === highlightPractice &&
                    "border-primary/60 ring-primary/30 ring-1",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground tabular text-xs">#{i + 1}</span>
                      <h3 className="text-sm font-semibold">{r.play.name}</h3>
                      <Badge variant="secondary" className="font-normal">
                        {practiceLabel(r.play.practiceArea, true)}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">{r.play.valueHypothesis}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <ScoreBar score={r.score} />
                    <Button size="sm" onClick={() => setLaunch({ play: r.play, account: account })}>
                      <PlayIcon /> Launch
                    </Button>
                  </div>
                </div>
                <ul className="mt-3 grid gap-1.5 border-t pt-3" aria-label="Why this play">
                  {r.reasons.map((x, j) => {
                    const Icon = REASON_ICON[x.kind];
                    return (
                      <li
                        key={j}
                        className={cn(
                          "flex items-start gap-2 text-xs",
                          x.points < 0 && "text-critical-text",
                        )}
                      >
                        <Icon
                          className="text-muted-foreground mt-0.5 size-3.5 shrink-0"
                          aria-hidden
                        />
                        <span className="flex-1">
                          {x.evidenceId ? (
                            <Link
                              href={`/signals?focus=${x.evidenceId}`}
                              className="hover:underline"
                            >
                              {x.text}
                            </Link>
                          ) : (
                            x.text
                          )}
                        </span>
                        <span className="tabular text-muted-foreground shrink-0">
                          {x.points > 0 ? "+" : ""}
                          {x.points}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        )
      ) : portfolio.isLoading ? (
        <CardSkeleton lines={8} />
      ) : (
        <div className="bg-card overflow-x-auto rounded-lg border">
          <table className="w-full text-[13px]">
            <caption className="sr-only">Top recommended play per priority account</caption>
            <thead className="text-muted-foreground text-xs">
              <tr className="border-b">
                <th scope="col" className="px-4 py-2 text-left font-medium">
                  Account
                </th>
                <th scope="col" className="px-4 py-2 text-left font-medium">
                  Top play
                </th>
                <th scope="col" className="px-4 py-2 text-left font-medium">
                  Why
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Score
                </th>
                <th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {portfolio.data?.items.map((r) => (
                <tr key={r.account.id} className="border-b last:border-0">
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 font-medium hover:underline"
                      onClick={() => setAccount(r.account)}
                    >
                      <Building2 className="text-muted-foreground size-3.5" />
                      {r.account.name}
                    </button>
                    <div className="text-muted-foreground text-xs">{r.account.tier}</div>
                  </td>
                  <td className="px-4 py-2">{r.top.play.name}</td>
                  <td className="text-muted-foreground max-w-md px-4 py-2 text-xs">
                    {r.top.reasons
                      .slice(0, 2)
                      .map((x) => x.text)
                      .join(" · ")}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <ScoreBar score={r.top.score} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => setLaunch({ play: r.top.play, account: r.account })}
                    >
                      Launch
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <LaunchPlayDialog
        play={launch?.play ?? null}
        account={launch?.account}
        onClose={() => setLaunch(null)}
      />
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center gap-2" aria-label={`Fit score ${score} of 100`}>
      <span className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
        <span className="bg-primary block h-full rounded-full" style={{ width: `${score}%` }} />
      </span>
      <span className="tabular w-6 text-right text-xs font-semibold">{score}</span>
    </span>
  );
}
