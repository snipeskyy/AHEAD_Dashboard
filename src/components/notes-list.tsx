"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";

interface Note {
  id: string;
  body: string;
  internalOnly: boolean;
  createdAt: string;
}

/** Notes thread for any entity (account, opportunity, signal, …). */
export function NotesList({
  entityType,
  entityId,
  compact = false,
}: {
  entityType: string;
  entityId: string;
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const key = ["notes", entityType, entityId];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () =>
      api<{ items: Note[] }>(`/api/notes?entityType=${entityType}&entityId=${entityId}`).then(
        (r) => r.items,
      ),
  });
  const [body, setBody] = useState("");
  const add = useMutation({
    mutationFn: () => api("/api/notes", { method: "POST", json: { entityType, entityId, body } }),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["account"] });
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="grid gap-3">
      <form
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) add.mutate();
        }}
      >
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={compact ? 2 : 3}
          placeholder="Add a note…"
          aria-label="New note"
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={!body.trim() || add.isPending}>
            Add note
          </Button>
        </div>
      </form>
      {isLoading ? null : !data?.length ? (
        <p className="text-muted-foreground text-sm">No notes yet.</p>
      ) : (
        <ul className="grid gap-2" data-field="notes">
          {data.map((n) => (
            <li
              key={n.id}
              className="bg-card rounded-md border p-3"
              data-internal-only={n.internalOnly ? "true" : undefined}
            >
              <p className="text-[13px] whitespace-pre-wrap">{n.body}</p>
              <div className="text-muted-foreground mt-1.5 flex items-center gap-1.5 text-[11px]">
                {n.internalOnly && <Lock className="size-3" aria-label="Internal only" />}
                {formatDistanceToNowStrict(new Date(n.createdAt), { addSuffix: true })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
