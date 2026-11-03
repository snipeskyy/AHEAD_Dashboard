"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { AlertTriangle, Copy, Send, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AccountPicker } from "@/components/account-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { practiceLabel } from "@/config/practice-areas";
import { api } from "@/lib/api-client";
import { getAiProvider } from "@/lib/ai/provider";
import { MESSAGE_TEMPLATES, renderMessage, type MessageChannel } from "@/lib/demand-gen/messages";
import type { Account360 } from "@/modules/account-intel/hooks/use-accounts";
import type { SignalRow } from "@/modules/signals/hooks/use-signals";
import { useInvalidateDemandGen, type Recommendation } from "../hooks/use-demand-gen";

const sel =
  "h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30";
const SENDER_KEY = "acc.senderName";
const readSender = () => {
  try {
    return localStorage.getItem(SENDER_KEY) ?? "";
  } catch {
    return "";
  }
};

/** Template-based drafts filled from account context and a chosen piece of evidence (no AI). */
export function MessageBuilder({
  initialAccount,
  initialPersona,
  initialChannel,
}: {
  initialAccount: { id: string; name: string } | null;
  initialPersona: string | null;
  initialChannel: MessageChannel | null;
}) {
  const [account, setAccount] = useState(initialAccount);
  return (
    <div className="grid gap-4">
      <div className="w-72">
        <AccountPicker value={account} onChange={setAccount} />
      </div>
      {account ? (
        <Builder
          key={account.id}
          accountId={account.id}
          initialPersona={initialPersona}
          initialChannel={initialChannel ?? "email"}
        />
      ) : (
        <p className="text-muted-foreground text-sm">Pick an account to start a draft.</p>
      )}
    </div>
  );
}

function Builder({
  accountId,
  initialPersona,
  initialChannel,
}: {
  accountId: string;
  initialPersona: string | null;
  initialChannel: MessageChannel;
}) {
  const inv = useInvalidateDemandGen();
  const { data: a } = useQuery({
    queryKey: ["account", accountId],
    queryFn: () => api<Account360>(`/api/accounts/${accountId}`),
  });
  const { data: sigs } = useQuery({
    queryKey: ["signals", "mb", accountId],
    queryFn: () =>
      api<{ items: SignalRow[] }>(
        `/api/signals?accountId=${accountId}&sort=relevance&sinceDays=90&limit=12`,
      ).then((r) => r.items),
  });
  const { data: recs } = useQuery({
    queryKey: ["recommend", accountId],
    queryFn: () =>
      api<{ items: Recommendation[] }>(`/api/plays/recommend?accountId=${accountId}&max=6`).then(
        (r) => r.items,
      ),
  });

  const [channel, setChannel] = useState<MessageChannel>(initialChannel);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [persona, setPersona] = useState(initialPersona ?? "");
  const [firstName, setFirstName] = useState("");
  const [sender, setSender] = useState(readSender);
  const [playId, setPlayId] = useState<string | null>(null);
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [edited, setEdited] = useState<string | null>(null);

  const templates = MESSAGE_TEMPLATES.filter((t) => t.channel === channel);
  const template = templates.find((t) => t.id === templateId) ?? templates[0];
  const personas = useMemo(() => [...new Set((a?.contacts ?? []).map((c) => c.title))], [a]);
  const play = recs?.find((r) => r.play.id === playId)?.play ?? recs?.[0]?.play;
  const evidence = useMemo(() => {
    const fromSignals = (sigs ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      url: s.url,
      when: formatDistanceToNowStrict(new Date(s.publishedAt), { addSuffix: true }),
      practice: s.practiceTags[0],
      label: `Signal · ${s.title}`,
    }));
    const fromInit = (a?.initiatives ?? []).map((i) => ({
      id: i.id,
      title: `your ${i.title.toLowerCase()} initiative`,
      url: i.sourceUrl,
      when: "",
      practice: i.practiceAreas[0],
      label: `Initiative · ${i.title}`,
    }));
    return [...fromSignals, ...fromInit];
  }, [sigs, a]);
  // Default evidence follows the chosen play's practice so the story stays coherent.
  const ev =
    evidence.find((e) => e.id === evidenceId) ??
    evidence.find((e) => e.practice === play?.practiceArea) ??
    evidence[0];
  const effPersona = persona || personas[0] || "";

  const rendered = a
    ? renderMessage(template, {
        firstName: firstName || undefined,
        persona: effPersona,
        account: a.account.name,
        industry: a.account.industry,
        practice: practiceLabel(play?.practiceArea ?? ev?.practice ?? "ai-infra"),
        playName: play?.name,
        valueHypothesis: play?.valueHypothesis,
        talkTrack1: play?.talkTrack[0],
        evidenceTitle: ev?.title,
        evidenceUrl: ev?.url ?? undefined,
        evidenceWhen: ev?.when || undefined,
        senderName: sender || undefined,
      })
    : null;
  const body = edited ?? rendered?.body ?? "";
  const text = rendered?.subject ? `Subject: ${rendered.subject}\n\n${body}` : body;

  const logTouch = useMutation({
    mutationFn: (completed: boolean) =>
      api("/api/touches", {
        method: "POST",
        json: {
          accountId,
          channel,
          persona: effPersona,
          angle: `${template.name}: ${(rendered?.subject ?? body).slice(0, 180)}`,
          scheduledAt: new Date().toISOString(),
          completed,
        },
      }),
    onSuccess: (_d, completed) => {
      toast.success(completed ? "Touch logged" : "Touch planned for today");
      inv();
    },
    onError: (e) => toast.error(e.message),
  });

  const reset = () => setEdited(null);
  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <section className="bg-card grid content-start gap-3 rounded-lg border p-4">
        <div
          className="bg-muted grid grid-cols-3 gap-1 rounded-md p-0.5"
          role="radiogroup"
          aria-label="Channel"
        >
          {(["email", "linkedin", "call"] as MessageChannel[]).map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={channel === c}
              onClick={() => {
                setChannel(c);
                setTemplateId(null);
                reset();
              }}
              className={`rounded px-2 py-1 text-xs font-medium capitalize ${channel === c ? "bg-card shadow-xs" : "text-muted-foreground"}`}
            >
              {c === "call" ? "Call opener" : c === "linkedin" ? "LinkedIn" : "Email"}
            </button>
          ))}
        </div>
        <Field id="mb-template" label="Template">
          <select
            id="mb-template"
            className={sel}
            value={template.id}
            onChange={(e) => {
              setTemplateId(e.target.value);
              reset();
            }}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="mb-persona" label="Persona">
          <Input
            id="mb-persona"
            list="mb-personas"
            value={effPersona}
            onChange={(e) => {
              setPersona(e.target.value);
              reset();
            }}
          />
          <datalist id="mb-personas">
            {personas.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Field>
        <Field id="mb-first" label="First name (optional, typed by you)">
          <Input
            id="mb-first"
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
              reset();
            }}
          />
        </Field>
        <Field id="mb-play" label="Play (value story)">
          <select
            id="mb-play"
            className={sel}
            value={play?.id ?? ""}
            onChange={(e) => {
              setPlayId(e.target.value);
              setEvidenceId(null);
              reset();
            }}
          >
            {(recs ?? []).map((r) => (
              <option key={r.play.id} value={r.play.id}>
                {r.play.name} · fit {r.score}
              </option>
            ))}
          </select>
        </Field>
        <Field id="mb-evidence" label="Evidence to reference">
          <select
            id="mb-evidence"
            className={sel}
            value={ev?.id ?? ""}
            onChange={(e) => {
              setEvidenceId(e.target.value);
              reset();
            }}
          >
            {evidence.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label.slice(0, 90)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="mb-sender" label="Your name (saved in this browser)">
          <Input
            id="mb-sender"
            value={sender}
            onChange={(e) => {
              setSender(e.target.value);
              reset();
              try {
                localStorage.setItem(SENDER_KEY, e.target.value);
              } catch {
                /* storage unavailable */
              }
            }}
          />
        </Field>
      </section>
      <section className="bg-card grid content-start gap-3 rounded-lg border p-4">
        {rendered?.subject && (
          <div className="grid gap-1">
            <Label className="text-muted-foreground text-xs">Subject</Label>
            <p className="text-[13px] font-medium">{rendered.subject}</p>
          </div>
        )}
        <Label htmlFor="mb-body" className="text-muted-foreground text-xs">
          Draft (editable)
        </Label>
        <Textarea
          id="mb-body"
          rows={14}
          value={body}
          onChange={(e) => setEdited(e.target.value)}
          className="font-mono text-[13px] leading-relaxed"
        />
        <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
          <span
            className={
              channel === "linkedin" && template.id === "linkedin-connect" && body.length > 300
                ? "text-critical-text"
                : ""
            }
          >
            {body.length} characters
            {channel === "linkedin" && template.id === "linkedin-connect" ? " / 300" : ""}
          </span>
          {rendered && rendered.missing.length > 0 && (
            <span className="text-warning-text inline-flex items-center gap-1">
              <AlertTriangle className="size-3.5" /> Fill in: {rendered.missing.join(", ")}
            </span>
          )}
          {edited !== null && (
            <button type="button" className="text-primary hover:underline" onClick={reset}>
              Reset to template
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() =>
              navigator.clipboard.writeText(text).then(() => toast.success("Copied to clipboard"))
            }
          >
            <Copy /> Copy
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!effPersona || logTouch.isPending}
            onClick={() => logTouch.mutate(true)}
          >
            <Send /> Log as sent
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!effPersona || logTouch.isPending}
            onClick={() => logTouch.mutate(false)}
          >
            Plan for today
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>
                <Button size="sm" variant="ghost" disabled>
                  <Sparkles /> Improve with AI
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-64">
              AI assistant is an optional add-on ({getAiProvider().label.toLowerCase()}). Nothing is
              sent anywhere.
            </TooltipContent>
          </Tooltip>
        </div>
      </section>
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      {children}
    </div>
  );
}
