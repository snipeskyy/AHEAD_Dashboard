"use client";
import { AlertTriangle, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BUYING_ROLES,
  BUYING_ROLE_LABELS,
  ENGAGEMENT_LEVELS,
  SENIORITIES,
  type BuyingRole,
} from "@/lib/domain/enums";
import { api } from "@/lib/api-client";
import { buildOrgTree, committeeGaps, type OrgNode } from "@/lib/intel/committee";
import { cn } from "@/lib/utils";
import type { Account360 } from "../../hooks/use-accounts";
import { useAccountMutation } from "../../hooks/use-accounts";

type Contact = Account360["contacts"][number];

const ROLE_STYLE: Record<BuyingRole, string> = {
  EconomicBuyer: "border-primary/50 bg-brand-soft text-primary",
  Champion: "border-good/50 text-good-text",
  Technical: "border-border text-foreground",
  Influencer: "border-border text-muted-foreground",
  Blocker: "border-critical/50 text-critical-text",
};
const ENGAGEMENT_DOTS: Record<string, number> = { None: 0, Light: 1, Engaged: 2, Strong: 3 };

export function CommitteeTab({ d }: { d: Account360 }) {
  const [editing, setEditing] = useState<Contact | "new" | null>(null);
  const del = useAccountMutation(
    d.account.id,
    (cid: string) => api(`/api/contacts/${cid}`, { method: "DELETE" }),
    "Persona removed",
  );
  const gaps = committeeGaps(d.contacts);
  const tree = buildOrgTree(d.contacts);
  const counts = BUYING_ROLES.map((r) => ({
    role: r,
    n: d.contacts.filter((c) => c.buyingRole === r).length,
  }));

  return (
    <div className="grid gap-4" data-internal-only="true">
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <section className="bg-card min-w-0 rounded-lg border p-4">
          <header className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Persona map</h2>
              <p className="text-muted-foreground text-xs">
                Roles and reporting lines. Personas are titles, not scraped individuals.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
              <Plus /> Add persona
            </Button>
          </header>
          {tree.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-[13px]">
              No personas mapped yet. Start with the Economic Buyer and a Champion.
            </p>
          ) : (
            <div className="overflow-x-auto pb-2">
              <ul
                className="flex min-w-max gap-6"
                role="tree"
                aria-label="Buying committee org chart"
              >
                {tree.map((n) => (
                  <li key={n.persona.id} role="treeitem" aria-selected={false}>
                    <OrgBranch node={n} onEdit={setEditing} onDelete={(id) => del.mutate(id)} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
        <aside className="grid content-start gap-4">
          <section className="bg-card rounded-lg border p-4">
            <h2 className="mb-2 text-sm font-semibold">Coverage gaps</h2>
            {gaps.length === 0 ? (
              <p className="text-good-text text-[13px]">All core roles identified and engaged.</p>
            ) : (
              <ul className="grid gap-1.5">
                {gaps.map((g) => (
                  <li
                    key={g.message}
                    className={cn(
                      "flex items-start gap-1.5 text-[13px]",
                      g.severity === "critical" ? "text-critical-text" : "text-warning-text",
                    )}
                  >
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    <span>
                      <span className="sr-only">{g.severity}: </span>
                      {g.message}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="bg-card rounded-lg border p-4">
            <h2 className="mb-2 text-sm font-semibold">Roles</h2>
            <ul className="grid gap-1.5 text-[13px]">
              {counts.map((c) => (
                <li key={c.role} className="flex items-center justify-between">
                  <Badge variant="outline" className={cn("font-normal", ROLE_STYLE[c.role])}>
                    {BUYING_ROLE_LABELS[c.role]}
                  </Badge>
                  <span className="tabular">{c.n}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
      <PersonaDialog
        accountId={d.account.id}
        contacts={d.contacts}
        editing={editing}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

/** Top-down org chart: each child draws its own vertical stub + its share of the horizontal rail. */
function OrgBranch({
  node,
  onEdit,
  onDelete,
}: {
  node: OrgNode<Contact>;
  onEdit: (c: Contact) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex flex-col items-center">
      <PersonaCard c={node.persona} onEdit={onEdit} onDelete={onDelete} />
      {node.children.length > 0 && (
        <>
          <span className="bg-border h-4 w-px" aria-hidden />
          <ul role="group" className="flex">
            {node.children.map((ch) => (
              <li
                key={ch.persona.id}
                role="treeitem"
                aria-selected={false}
                className="before:bg-border after:bg-border relative flex flex-col items-center px-2 pt-4 before:absolute before:top-0 before:left-1/2 before:h-4 before:w-px after:absolute after:top-0 after:right-0 after:left-0 after:h-px first:after:left-1/2 last:after:right-1/2 only:after:hidden"
              >
                <OrgBranch node={ch} onEdit={onEdit} onDelete={onDelete} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function PersonaCard({
  c,
  onEdit,
  onDelete,
}: {
  c: Contact;
  onEdit: (c: Contact) => void;
  onDelete: (id: string) => void;
}) {
  const role = c.buyingRole as BuyingRole;
  const dots = ENGAGEMENT_DOTS[c.engagement] ?? 0;
  return (
    <div className="group bg-card relative w-52 rounded-md border p-2.5 shadow-xs">
      <div className="flex items-start gap-2">
        <span className="bg-muted text-muted-foreground grid size-7 shrink-0 place-items-center rounded-full">
          <UserRound className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xs leading-snug font-medium">{c.title}</div>
          {c.displayName && (
            <div className="text-muted-foreground truncate text-[11px]">{c.displayName}</div>
          )}
          <div className="text-muted-foreground text-[11px]">{c.function}</div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <Badge variant="outline" className={cn("h-5 font-normal", ROLE_STYLE[role])}>
          {BUYING_ROLE_LABELS[role] ?? c.buyingRole}
        </Badge>
        <span
          className="flex items-center gap-0.5"
          aria-label={`Engagement: ${c.engagement}`}
          title={`Engagement: ${c.engagement}`}
        >
          {[1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn("size-1.5 rounded-full", i <= dots ? "bg-primary" : "bg-muted")}
            />
          ))}
        </span>
      </div>
      <div className="bg-card absolute top-1.5 right-1.5 flex gap-0.5 rounded-md opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Edit ${c.title}`}
          onClick={() => onEdit(c)}
        >
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Remove ${c.title}`}
          onClick={() => onDelete(c.id)}
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  );
}

const sel =
  "h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30";

function PersonaDialog({
  accountId,
  contacts,
  editing,
  onClose,
}: {
  accountId: string;
  contacts: Contact[];
  editing: Contact | "new" | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {editing && (
          <PersonaForm
            key={editing === "new" ? "new" : editing.id}
            accountId={accountId}
            contacts={contacts}
            editing={editing}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PersonaForm({
  accountId,
  contacts,
  editing,
  onClose,
}: {
  accountId: string;
  contacts: Contact[];
  editing: Contact | "new";
  onClose: () => void;
}) {
  const init =
    editing === "new"
      ? {
          title: "",
          function: "",
          seniority: "Director",
          buyingRole: "Champion",
          engagement: "None",
          displayName: "",
          reportsToId: "",
        }
      : {
          ...editing,
          displayName: editing.displayName ?? "",
          reportsToId: editing.reportsToId ?? "",
        };
  const [f, setF] = useState(init);
  const save = useAccountMutation(
    accountId,
    () => {
      const body = {
        title: f.title,
        function: f.function,
        seniority: f.seniority,
        buyingRole: f.buyingRole,
        engagement: f.engagement,
        displayName: f.displayName || null,
        reportsToId: f.reportsToId || null,
      };
      return editing === "new"
        ? api(`/api/accounts/${accountId}/contacts`, { method: "POST", json: body })
        : api(`/api/contacts/${editing.id}`, { method: "PATCH", json: body });
    },
    "Persona saved",
  );
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(undefined, { onSuccess: onClose });
      }}
    >
      <DialogHeader>
        <DialogTitle>{editing === "new" ? "Add persona" : "Edit persona"}</DialogTitle>
        <DialogDescription>
          Role-based personas. A name is optional and only ever entered by you.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="p-title">Title</Label>
        <Input
          id="p-title"
          value={f.title}
          onChange={set("title")}
          placeholder="VP, Infrastructure & Operations"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="p-fn">Function</Label>
          <Input
            id="p-fn"
            value={f.function}
            onChange={set("function")}
            placeholder="Infrastructure"
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="p-sen">Seniority</Label>
          <select id="p-sen" className={sel} value={f.seniority} onChange={set("seniority")}>
            {SENIORITIES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="p-role">Buying role</Label>
          <select id="p-role" className={sel} value={f.buyingRole} onChange={set("buyingRole")}>
            {BUYING_ROLES.map((r) => (
              <option key={r} value={r}>
                {BUYING_ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="p-eng">Engagement</Label>
          <select id="p-eng" className={sel} value={f.engagement} onChange={set("engagement")}>
            {ENGAGEMENT_LEVELS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="p-reports">Reports to</Label>
        <select id="p-reports" className={sel} value={f.reportsToId} onChange={set("reportsToId")}>
          <option value="">—</option>
          {contacts
            .filter((c) => editing === "new" || c.id !== editing.id)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="p-name">Name (optional, user-entered)</Label>
        <Input id="p-name" value={f.displayName} onChange={set("displayName")} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={f.title.length < 2 || !f.function || save.isPending}>
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}
