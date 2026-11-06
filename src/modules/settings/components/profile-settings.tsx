"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLES, VISIBILITY_FIELDS } from "@/config/roles";
import { useMe } from "@/hooks/use-me";
import { api } from "@/lib/api-client";
import { SettingsSection } from "./section";

interface U { id: string; displayName: string; title: string | null; role: string; isSelf: boolean }
const sel = "border-input dark:bg-input/30 h-8 rounded-md border bg-transparent px-2 text-sm";

/** Local profile, role (field visibility) and teammates by name (for @mentions and ownership). */
export function ProfileSettings() {
  const qc = useQueryClient();
  const me = useMe();
  const team = useQuery({ queryKey: ["users"], queryFn: () => api<{ team: { name: string } | null; users: U[] }>("/api/users") });
  const done = () => { qc.invalidateQueries({ queryKey: ["me"] }); qc.invalidateQueries({ queryKey: ["users"] }); };
  const save = useMutation({ mutationFn: (b: Partial<U>) => api("/api/me", { method: "PATCH", json: b }), onSuccess: () => { done(); toast.success("Profile saved"); } });
  const add = useMutation({ mutationFn: (b: { displayName: string; role: string }) => api("/api/users", { method: "POST", json: b }), onSuccess: done });
  const del = useMutation({ mutationFn: (id: string) => api(`/api/users/${id}`, { method: "DELETE" }), onSuccess: done });
  const rename = useMutation({ mutationFn: (name: string) => api("/api/team", { method: "PATCH", json: { name } }), onSuccess: done });
  const self = team.data?.users.find((u) => u.isSelf);
  const [name, setName] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [mate, setMate] = useState("");
  const [mateRole, setMateRole] = useState<string>(ROLES[0].id);
  if (!self || !me.data) return <p className="text-muted-foreground text-sm">Loading…</p>;
  const role = ROLES.find((r) => r.id === self.role) ?? ROLES[1];
  return (
    <div className="grid gap-4">
      <SettingsSection title="Your profile" description={`Stored only in this workspace. Sign-in: ${me.data.auth.label}.`}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5"><Label htmlFor="pf-name">Display name</Label><Input id="pf-name" value={name ?? self.displayName} onChange={(e) => setName(e.target.value)} onBlur={() => name !== null && name !== self.displayName && save.mutate({ displayName: name })} /></div>
          <div className="grid gap-1.5"><Label htmlFor="pf-title">Title</Label><Input id="pf-title" value={title ?? self.title ?? ""} onChange={(e) => setTitle(e.target.value)} onBlur={() => title !== null && save.mutate({ title })} /></div>
          <div className="grid gap-1.5">
            <Label htmlFor="pf-role">Role</Label>
            <select id="pf-role" className={sel} value={self.role} onChange={(e) => save.mutate({ role: e.target.value })}>
              {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4 text-[13px]" aria-live="polite">
          <p className="font-medium">What the {role.label} role sees</p>
          <ul className="mt-1 grid gap-0.5 sm:grid-cols-2">
            {Object.entries(VISIBILITY_FIELDS).map(([k, f]) => {
              const hidden = (role.hidden as readonly string[]).includes(k);
              return <li key={k} className={hidden ? "text-muted-foreground line-through" : ""}>{hidden ? "Hidden: " : "Visible: "}{f.label}</li>;
            })}
          </ul>
          <p className="text-muted-foreground mt-2 text-xs">Applied on screen, in exports and in shareable packs. Roles are defined in <code>src/config/roles.ts</code>.</p>
        </div>
      </SettingsSection>
      <SettingsSection title="Team" description="Teammates are names only, for @mentions and record ownership. No contact details are stored.">
        <div className="mb-3 flex items-end gap-2">
          <div className="grid gap-1.5"><Label htmlFor="tm-name">Team name</Label><Input id="tm-name" defaultValue={team.data?.team?.name ?? ""} onBlur={(e) => e.target.value.trim() && rename.mutate(e.target.value.trim())} className="w-60" /></div>
        </div>
        <ul className="divide-y rounded-md border" aria-label="Team members">
          {team.data!.users.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-2 px-3 py-2 text-[13px]">
              <span><span className="font-medium">{u.displayName}</span>{u.isSelf && <span className="text-muted-foreground"> (you)</span>} <span className="text-muted-foreground text-xs">· {ROLES.find((r) => r.id === u.role)?.label ?? u.role}</span></span>
              {!u.isSelf && <Button variant="ghost" size="icon-xs" aria-label={`Remove ${u.displayName}`} onClick={() => del.mutate(u.id)}><Trash2 /></Button>}
            </li>
          ))}
        </ul>
        <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (mate.trim()) { add.mutate({ displayName: mate.trim(), role: mateRole }); setMate(""); } }}>
          <div className="grid gap-1.5"><Label htmlFor="tm-add">Add teammate</Label><Input id="tm-add" value={mate} onChange={(e) => setMate(e.target.value)} placeholder="Name" className="w-56" /></div>
          <select aria-label="Teammate role" className={sel} value={mateRole} onChange={(e) => setMateRole(e.target.value)}>{ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select>
          <Button type="submit" size="sm" variant="outline" disabled={!mate.trim()}><UserPlus /> Add</Button>
        </form>
      </SettingsSection>
    </div>
  );
}
