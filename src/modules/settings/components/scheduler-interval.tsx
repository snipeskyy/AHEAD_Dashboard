"use client";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSaveSetting, useSetting } from "@/hooks/use-setting";
import { SettingsRow, SettingsSection } from "./section";

const OPTIONS = [15, 30, 60, 120, 360, 1440];

export function SchedulerInterval({
  fetching,
  onFetchAll,
}: {
  fetching: boolean;
  onFetchAll: () => void;
}) {
  const { data } = useSetting("scheduler.intervalMinutes");
  const save = useSaveSetting("scheduler.intervalMinutes");
  return (
    <SettingsSection
      title="Scheduler"
      description="The background worker fetches every enabled public source on this interval. Failing sources back off automatically."
      actions={
        <Button size="sm" variant="outline" disabled={fetching} onClick={onFetchAll}>
          <RefreshCw className={fetching ? "animate-spin" : ""} />{" "}
          {fetching ? "Fetching…" : "Fetch all now"}
        </Button>
      }
    >
      <SettingsRow label="Fetch interval" htmlFor="sched-int">
        <select
          id="sched-int"
          className="border-input dark:bg-input/30 h-8 rounded-md border bg-transparent px-2 text-sm"
          value={data ?? 30}
          onChange={(e) =>
            save.mutate(Number(e.target.value), {
              onSuccess: () => toast.success("Interval saved"),
            })
          }
        >
          {OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m < 60
                ? `Every ${m} minutes`
                : m === 60
                  ? "Every hour"
                  : m === 1440
                    ? "Once a day"
                    : `Every ${m / 60} hours`}
            </option>
          ))}
        </select>
      </SettingsRow>
    </SettingsSection>
  );
}
