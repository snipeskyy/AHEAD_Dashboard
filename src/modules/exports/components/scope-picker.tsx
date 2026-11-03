"use client";
import { X } from "lucide-react";
import { AccountPicker } from "@/components/account-picker";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ExportConfig } from "@/lib/export/config";

export function ScopePicker({
  config,
  names,
  onChange,
}: {
  config: ExportConfig;
  names: Record<string, string>;
  onChange: (c: ExportConfig, names?: Record<string, string>) => void;
}) {
  const s = config.scope;
  return (
    <div className="grid gap-2">
      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        value={s.type}
        onValueChange={(v) =>
          v &&
          onChange({
            ...config,
            scope: {
              type: v as ExportConfig["scope"]["type"],
              accountIds:
                v === "account" ? s.accountIds.slice(0, 1) : v === "portfolio" ? [] : s.accountIds,
            },
          })
        }
        aria-label="Scope"
      >
        <ToggleGroupItem value="account">One account</ToggleGroupItem>
        <ToggleGroupItem value="accounts">Account set</ToggleGroupItem>
        <ToggleGroupItem value="portfolio">Portfolio</ToggleGroupItem>
      </ToggleGroup>
      {s.type === "account" && (
        <AccountPicker
          value={
            s.accountIds[0]
              ? { id: s.accountIds[0], name: names[s.accountIds[0]] ?? "Account" }
              : null
          }
          onChange={(a) =>
            onChange(
              { ...config, scope: { type: "account", accountIds: a ? [a.id] : [] } },
              a ? { [a.id]: a.name } : undefined,
            )
          }
        />
      )}
      {s.type === "accounts" && (
        <>
          <AccountPicker
            key={s.accountIds.join(",")}
            value={null}
            placeholder="Add an account…"
            onChange={(a) =>
              a &&
              !s.accountIds.includes(a.id) &&
              onChange(
                { ...config, scope: { type: "accounts", accountIds: [...s.accountIds, a.id] } },
                { [a.id]: a.name },
              )
            }
          />
          <ul className="flex flex-wrap gap-1">
            {s.accountIds.map((id) => (
              <li key={id}>
                <Badge variant="secondary" className="gap-1 pr-1 font-normal">
                  {names[id] ?? id}
                  <button
                    type="button"
                    aria-label={`Remove ${names[id] ?? id}`}
                    onClick={() =>
                      onChange({
                        ...config,
                        scope: {
                          type: "accounts",
                          accountIds: s.accountIds.filter((x) => x !== id),
                        },
                      })
                    }
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              </li>
            ))}
          </ul>
        </>
      )}
      {s.type === "portfolio" && (
        <p className="text-muted-foreground text-xs">
          Every account in the workspace (account-level sections show the first 10).
        </p>
      )}
    </div>
  );
}
