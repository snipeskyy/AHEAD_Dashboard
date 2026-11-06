"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Trash2 } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useMe } from "@/hooks/use-me";
import { api } from "@/lib/api-client";
import { activeMentionQuery, insertMention } from "@/lib/team/mentions";
import { cn } from "@/lib/utils";

interface C { id: string; body: string; authorId: string; authorName: string; mentionNames: string[]; createdAt: string; editedAt: string | null }
interface U { id: string; displayName: string; isSelf: boolean }

/** Render @Name tokens for known mentions as highlighted text. */
function Body({ text, names }: { text: string; names: string[] }) {
  if (!names.length) return <>{text}</>;
  const re = new RegExp(`(@(?:${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}))`, "gi");
  return <>{text.split(re).map((part, i) => (i % 2 ? <span key={i} className="text-primary font-medium">{part}</span> : part))}</>;
}

/** Comments with @mentions on an account or opportunity. Stored locally; teammates are names from Settings → Profile & team. */
export function CommentThread({ entityType, entityId }: { entityType: "account" | "opportunity"; entityId: string }) {
  const qc = useQueryClient();
  const key = ["comments", entityType, entityId];
  const me = useMe().data?.user;
  const { data } = useQuery({ queryKey: key, queryFn: () => api<{ items: C[] }>(`/api/comments?entityType=${entityType}&entityId=${entityId}`).then((r) => r.items) });
  const users = useQuery({ queryKey: ["users"], queryFn: () => api<{ users: U[] }>("/api/users").then((r) => r.users) }).data ?? [];
  const [text, setText] = useState("");
  const [mq, setMq] = useState<{ start: number; query: string } | null>(null);
  const [sel, setSel] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const add = useMutation({
    mutationFn: () => api("/api/comments", { method: "POST", json: { entityType, entityId, body: text } }),
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey: key }); },
    onError: (e) => toast.error(e.message),
  });
  const del = useMutation({ mutationFn: (id: string) => api(`/api/comments/${id}`, { method: "DELETE" }), onSuccess: () => qc.invalidateQueries({ queryKey: key }) });
  const matches = mq ? users.filter((u) => !u.isSelf && u.displayName.toLowerCase().startsWith(mq.query.toLowerCase())).slice(0, 6) : [];

  const update = (value: string, caret: number) => {
    setText(value);
    setMq(activeMentionQuery(value, caret));
    setSel(0);
  };
  const pick = (u: U) => {
    const el = ref.current!;
    const r = insertMention(text, mq!.start, el.selectionStart, u.displayName);
    setText(r.text);
    setMq(null);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(r.caret, r.caret); });
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (matches.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => (s + 1) % matches.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => (s - 1 + matches.length) % matches.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(matches[sel]); return; }
      if (e.key === "Escape") { setMq(null); return; }
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) add.mutate();
  };

  return (
    <section className="grid gap-3" aria-label="Comments" id="comments">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold"><MessageSquare className="size-4" aria-hidden /> Comments{data?.length ? <span className="text-muted-foreground font-normal"> · {data.length}</span> : null}</h3>
      <ul className="grid gap-2">
        {data?.map((c) => (
          <li key={c.id} className="bg-card group rounded-md border p-3 text-[13px]">
            <div className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs">
              <span className="text-foreground font-medium">{c.authorName}</span>· {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}{c.editedAt && " · edited"}
              {me && c.authorId === me.id && (
                <Button variant="ghost" size="icon-xs" className="ml-auto opacity-0 group-hover:opacity-100 focus-visible:opacity-100" aria-label="Delete comment" onClick={() => del.mutate(c.id)}><Trash2 /></Button>
              )}
            </div>
            <p className="whitespace-pre-wrap"><Body text={c.body} names={c.mentionNames} /></p>
          </li>
        ))}
        {data && !data.length && <li className="text-muted-foreground text-xs">No comments yet. Type @ to mention a teammate.</li>}
      </ul>
      <div className="relative grid gap-2">
        <Textarea
          ref={ref}
          rows={2}
          value={text}
          aria-label="New comment"
          placeholder="Add a comment… (@ to mention, ⌘↵ to post)"
          aria-autocomplete="list"
          aria-expanded={matches.length > 0}
          aria-controls={matches.length ? "mention-list" : undefined}
          onChange={(e) => update(e.target.value, e.target.selectionStart)}
          onKeyDown={onKey}
        />
        {matches.length > 0 && (
          <ul id="mention-list" role="listbox" aria-label="Mention a teammate" className="bg-popover absolute top-full left-0 z-20 mt-1 w-60 rounded-md border p-1 shadow-md">
            {matches.map((u, i) => (
              <li key={u.id} role="option" aria-selected={i === sel} className={cn("cursor-pointer rounded px-2 py-1 text-[13px]", i === sel && "bg-muted")} onMouseDown={(e) => { e.preventDefault(); pick(u); }}>
                {u.displayName}
              </li>
            ))}
          </ul>
        )}
        <Button size="sm" className="w-fit justify-self-end" disabled={!text.trim() || add.isPending} onClick={() => add.mutate()}>Comment</Button>
      </div>
    </section>
  );
}
