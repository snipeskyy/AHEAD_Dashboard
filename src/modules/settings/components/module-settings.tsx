"use client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useSaveSetting, useSetting } from "@/hooks/use-setting";
import { registry } from "@/modules/registry";
import { SchemaForm } from "./schema-form";
import { SettingsSection } from "./section";

export function ModuleSettings() {
  const { data: flags = {} } = useSetting("featureFlags");
  const saveFlags = useSaveSetting("featureFlags");
  const { data: moduleSettings = {} } = useSetting("modules.settings");
  const saveModuleSettings = useSaveSetting("modules.settings");

  return (
    <div className="grid gap-6">
      <SettingsSection
        title="Modules"
        description="Every feature is a self-registering module. Toggle optional modules on or off."
      >
        <ul className="divide-y">
          {registry.modules.map((m) => {
            const enabled = m.featureFlag ? flags[m.featureFlag] !== false : true;
            return (
              <li key={m.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span className="bg-muted text-muted-foreground mt-0.5 grid size-8 shrink-0 place-items-center rounded-md">
                  <m.icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-medium">{m.title}</span>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {m.id}
                    </Badge>
                    {m.status === "stub" && <Badge variant="secondary">Add-on stub</Badge>}
                  </div>
                  <p className="text-muted-foreground text-xs">{m.description}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {m.routes?.length ?? 0} routes · {m.widgets?.length ?? 0} widgets ·{" "}
                    {m.exportSections.length} export sections
                  </p>
                </div>
                {m.featureFlag ? (
                  <Switch
                    checked={enabled}
                    aria-label={`Enable ${m.title}`}
                    onCheckedChange={(v) =>
                      saveFlags.mutate(
                        { ...flags, [m.featureFlag!]: v },
                        {
                          onSuccess: () =>
                            toast.success(`${m.title} ${v ? "enabled" : "disabled"}`),
                        },
                      )
                    }
                  />
                ) : (
                  <span className="text-muted-foreground text-xs">Core</span>
                )}
              </li>
            );
          })}
        </ul>
      </SettingsSection>
      {registry.modules
        .filter((m) => m.settingsSchema)
        .map((m) => (
          <SettingsSection
            key={m.id}
            title={`${m.title} settings`}
            description="Generated from the module's settings schema."
          >
            <SchemaForm
              schema={m.settingsSchema!}
              value={moduleSettings[m.id] ?? {}}
              onSave={(v) =>
                saveModuleSettings.mutate(
                  { ...moduleSettings, [m.id]: v },
                  {
                    onSuccess: () => toast.success("Saved"),
                    onError: (e) => toast.error(e.message),
                  },
                )
              }
            />
          </SettingsSection>
        ))}
    </div>
  );
}
