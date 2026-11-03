"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSaveSetting, useSetting } from "@/hooks/use-setting";
import { SettingsSection } from "./section";

/** User-editable generic partner/OEM and competitor lists (no vendor brands are shipped). */
export function PipelineLists() {
  const { data } = useSetting("pipeline.lists");
  return data ? <Editor key={JSON.stringify(data)} saved={data} /> : null;
}

function Editor({ saved }: { saved: { partners: string[]; competitors: string[] } }) {
  const save = useSaveSetting("pipeline.lists");
  const [partners, setPartners] = useState(saved.partners.join("\n"));
  const [competitors, setCompetitors] = useState(saved.competitors.join("\n"));
  const lines = (s: string) => [
    ...new Set(
      s
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  ];
  return (
    <SettingsSection
      title="Partners & competitors"
      description="Suggestions offered on opportunities. One per line."
      actions={
        <Button
          size="sm"
          onClick={() =>
            save.mutate(
              { partners: lines(partners), competitors: lines(competitors) },
              {
                onSuccess: () => toast.success("Lists saved"),
                onError: (e) => toast.error(e.message),
              },
            )
          }
        >
          Save lists
        </Button>
      }
    >
      <div className="grid items-start gap-4 md:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="pl-partners">Partners / OEMs</Label>
          <Textarea
            id="pl-partners"
            rows={8}
            value={partners}
            onChange={(e) => setPartners(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pl-comp">Competitors</Label>
          <Textarea
            id="pl-comp"
            rows={8}
            value={competitors}
            onChange={(e) => setCompetitors(e.target.value)}
          />
        </div>
      </div>
    </SettingsSection>
  );
}
